#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TERRITORY = "madrid";
const DEFAULT_RAW_ROOT = "data/captacion/raw";
const DEFAULT_INDEX_ROOT = "data/captacion/indexes";
const DEFAULT_ACTIVE_OUTPUT = "data/captacion/catastro-residential-units.jsonl";
const BUILD_SCRIPT_PATH = "scripts/build-captacion-catastro-units.mjs";

const usage = () =>
	`
Usage:
  pnpm captacion:sync-index -- --territory madrid

Options:
  --territory <slug>        Defaults to madrid.
  --raw-dir <path>          Defaults to data/captacion/raw/<territory>.
  --index-root <path>       Defaults to data/captacion/indexes.
  --active-output <path>    Defaults to ${DEFAULT_ACTIVE_OUTPUT}.
  --source-version <id>     Defaults to the source hash.
  --force                   Rebuild even when the raw source hash is unchanged.
  --require-input           Fail instead of no-op when no raw CAT files exist.
`.trim();

const parseArgs = () => {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	const parsed = {
		activeOutput: DEFAULT_ACTIVE_OUTPUT,
		force: false,
		indexRoot: DEFAULT_INDEX_ROOT,
		requireInput: false,
		territory: DEFAULT_TERRITORY,
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === "--help" || arg === "-h") {
			console.info(usage());
			process.exit(0);
		}

		if (arg === "--force") {
			parsed.force = true;
			continue;
		}

		if (arg === "--require-input") {
			parsed.requireInput = true;
			continue;
		}

		if (!arg?.startsWith("--")) {
			throw new Error(`Unexpected argument: ${arg ?? ""}`);
		}

		const next = args[index + 1];
		if (!next || next.startsWith("--")) {
			throw new Error(`Missing value for ${arg}`);
		}

		const key = arg.slice(2);
		if (
			![
				"active-output",
				"index-root",
				"raw-dir",
				"source-version",
				"territory",
			].includes(key)
		) {
			throw new Error(`Unknown option: ${arg}`);
		}

		const normalizedKey =
			key === "active-output"
				? "activeOutput"
				: key === "index-root"
					? "indexRoot"
					: key === "raw-dir"
						? "rawDir"
						: key === "source-version"
							? "sourceVersion"
							: key;
		parsed[normalizedKey] = next;
		index += 1;
	}

	parsed.rawDir ??= path.join(DEFAULT_RAW_ROOT, parsed.territory);

	return parsed;
};

const listInputFiles = async (inputPath) => {
	let inputStat;

	try {
		inputStat = await stat(inputPath);
	} catch (error) {
		if (error?.code === "ENOENT") {
			return [];
		}
		throw error;
	}

	if (inputStat.isFile()) {
		return [inputPath];
	}

	if (!inputStat.isDirectory()) {
		throw new Error(`Input is neither a file nor a directory: ${inputPath}`);
	}

	const entries = await readdir(inputPath, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const entryPath = path.join(inputPath, entry.name);
			if (entry.isDirectory()) {
				return listInputFiles(entryPath);
			}
			return Promise.resolve([entryPath]);
		}),
	);

	return nested
		.flat()
		.filter((filePath) => /\.(cat|txt|gz)$/i.test(filePath))
		.sort();
};

const hashInputFiles = async (files, rawDir) => {
	const hash = createHash("sha256");

	for (const filePath of files) {
		const relativePath = path.relative(rawDir, filePath);
		const contents = await readFile(filePath);

		hash.update(relativePath);
		hash.update("\0");
		hash.update(contents);
		hash.update("\0");
	}

	return hash.digest("hex");
};

const readJsonIfExists = async (filePath) => {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") {
			return null;
		}
		throw error;
	}
};

const writeJsonAtomic = async (filePath, value) => {
	const tempPath = `${filePath}.${process.pid}.tmp`;

	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	await rename(tempPath, filePath);
};

const copyFileAtomic = async (fromPath, toPath) => {
	const tempPath = `${toPath}.${process.pid}.tmp`;

	await mkdir(path.dirname(toPath), { recursive: true });
	await copyFile(fromPath, tempPath);
	await rename(tempPath, toPath);
};

const countRows = async (filePath) => {
	const contents = await readFile(filePath, "utf8");

	return contents.split(/\n/).filter((line) => line.trim().length > 0).length;
};

const runBuildIndex = async (input) => {
	const args = [
		BUILD_SCRIPT_PATH,
		"--input",
		input.rawDir,
		"--output",
		input.outputPath,
		"--territory",
		input.territory,
		"--source-version",
		input.sourceVersion,
	];
	const result = await execFileAsync(process.execPath, args, {
		cwd: process.cwd(),
		maxBuffer: 1024 * 1024 * 128,
	});

	if (result.stdout.trim()) {
		console.info(result.stdout.trim());
	}

	if (result.stderr.trim()) {
		console.error(result.stderr.trim());
	}
};

const main = async () => {
	const args = parseArgs();
	const inputFiles = await listInputFiles(args.rawDir);

	if (inputFiles.length === 0) {
		const message = `No raw CAT files found in ${args.rawDir}`;
		if (args.requireInput) {
			throw new Error(message);
		}

		console.info(
			JSON.stringify({
				event: "captacion_index_sync_noop",
				reason: "no_raw_files",
				rawDir: args.rawDir,
				territory: args.territory,
			}),
		);
		return;
	}

	const sourceHash = await hashInputFiles(inputFiles, args.rawDir);
	const territoryIndexRoot = path.join(args.indexRoot, args.territory);
	const latestManifestPath = path.join(territoryIndexRoot, "latest.json");
	const latestManifest = await readJsonIfExists(latestManifestPath);
	const activeOutputExists = await stat(args.activeOutput)
		.then(() => true)
		.catch((error) => {
			if (error?.code === "ENOENT") {
				return false;
			}
			throw error;
		});

	if (
		!args.force &&
		latestManifest?.sourceHash === sourceHash &&
		activeOutputExists
	) {
		console.info(
			JSON.stringify({
				event: "captacion_index_sync_skipped",
				reason: "source_unchanged",
				sourceHash,
				territory: args.territory,
			}),
		);
		return;
	}

	const shortHash = sourceHash.slice(0, 16);
	const versionedOutputPath = path.join(
		territoryIndexRoot,
		`${shortHash}.jsonl`,
	);
	const sourceVersion = args.sourceVersion ?? sourceHash;

	await runBuildIndex({
		outputPath: versionedOutputPath,
		rawDir: args.rawDir,
		sourceVersion,
		territory: args.territory,
	});

	const rowCount = await countRows(versionedOutputPath);
	const generatedAt = new Date().toISOString();
	const manifest = {
		activeOutput: args.activeOutput,
		generatedAt,
		inputFileCount: inputFiles.length,
		indexPath: versionedOutputPath,
		rowCount,
		sourceHash,
		sourceVersion,
		territory: args.territory,
	};

	await writeJsonAtomic(latestManifestPath, manifest);
	await copyFileAtomic(versionedOutputPath, args.activeOutput);

	console.info(
		JSON.stringify({
			event: "captacion_index_sync_published",
			...manifest,
		}),
	);
};

main().catch((error) => {
	if (String(error?.message ?? error).includes("Usage:")) {
		console.error(error.message);
	} else {
		console.error(error instanceof Error ? error.stack : error);
	}
	process.exit(1);
});
