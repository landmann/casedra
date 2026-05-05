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
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

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
  --s3-bucket <bucket>      Defaults to CAPTACION_S3_BUCKET.
  --s3-prefix <prefix>      Defaults to CAPTACION_S3_PREFIX or captacion.
  --force                   Rebuild even when the raw source hash is unchanged.
  --require-input           Fail instead of no-op when no raw CAT files exist.
`.trim();

const normalizePrefix = (value) =>
	value?.replace(/^\/+|\/+$/g, "") || "captacion";

const getS3Key = (s3Prefix, ...parts) =>
	[normalizePrefix(s3Prefix), ...parts]
		.map((part) => part.replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");

const parseArgs = () => {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	const parsed = {
		activeOutput: DEFAULT_ACTIVE_OUTPUT,
		force: false,
		indexRoot: DEFAULT_INDEX_ROOT,
		requireInput: false,
		s3Bucket: process.env.CAPTACION_S3_BUCKET,
		s3Prefix: process.env.CAPTACION_S3_PREFIX ?? "captacion",
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
				"s3-bucket",
				"s3-prefix",
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
						: key === "s3-bucket"
							? "s3Bucket"
							: key === "s3-prefix"
								? "s3Prefix"
								: key === "source-version"
									? "sourceVersion"
									: key;
		parsed[normalizedKey] = next;
		index += 1;
	}

	parsed.rawDir ??= path.join(DEFAULT_RAW_ROOT, parsed.territory);
	parsed.s3Prefix = normalizePrefix(parsed.s3Prefix);

	return parsed;
};

const createS3Client = () =>
	new S3Client({
		region: process.env.AWS_REGION,
		credentials:
			process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
				? {
						accessKeyId: process.env.AWS_ACCESS_KEY_ID,
						secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					}
				: undefined,
	});

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

const readS3JsonIfExists = async (input) => {
	try {
		const result = await createS3Client().send(
			new GetObjectCommand({
				Bucket: input.bucket,
				Key: input.key,
			}),
		);
		const body = await result.Body?.transformToString("utf8");
		return body ? JSON.parse(body) : null;
	} catch (error) {
		if (["NoSuchKey", "NotFound"].includes(error?.name)) {
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

const putS3Object = async (input) => {
	await createS3Client().send(
		new PutObjectCommand({
			Bucket: input.bucket,
			Key: input.key,
			Body: input.body,
			ContentType: input.contentType,
		}),
	);
};

const listS3RawObjects = async (input) => {
	const client = createS3Client();
	const objects = [];
	let continuationToken;

	do {
		const result = await client.send(
			new ListObjectsV2Command({
				Bucket: input.bucket,
				ContinuationToken: continuationToken,
				Prefix: input.prefix,
			}),
		);

		for (const object of result.Contents ?? []) {
			if (object.Key && /\.(cat|txt|gz)$/i.test(object.Key)) {
				objects.push(object);
			}
		}
		continuationToken = result.NextContinuationToken;
	} while (continuationToken);

	return objects.sort((left, right) => left.Key.localeCompare(right.Key));
};

const downloadS3RawObjects = async (input) => {
	const client = createS3Client();
	const rawDir = path.join(
		os.tmpdir(),
		`captacion-${input.territory}-${process.pid}-${Date.now()}`,
	);

	await mkdir(rawDir, { recursive: true });

	for (const object of input.objects) {
		const result = await client.send(
			new GetObjectCommand({
				Bucket: input.bucket,
				Key: object.Key,
			}),
		);
		const byteArray = await result.Body?.transformToByteArray();
		const fileName = path.basename(object.Key);

		if (!byteArray) {
			throw new Error(`S3 object ${object.Key} did not return a body.`);
		}

		await writeFile(path.join(rawDir, fileName), Buffer.from(byteArray));
	}

	return rawDir;
};

const hashS3RawObjects = (objects) => {
	const hash = createHash("sha256");

	for (const object of objects) {
		hash.update(object.Key);
		hash.update("\0");
		hash.update(object.ETag ?? "");
		hash.update("\0");
		hash.update(String(object.Size ?? ""));
		hash.update("\0");
		hash.update(object.LastModified?.toISOString() ?? "");
		hash.update("\0");
	}

	return hash.digest("hex");
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
	const s3Mode = Boolean(args.s3Bucket);
	const s3RawPrefix = getS3Key(args.s3Prefix, "raw", args.territory);
	const s3RawObjects = s3Mode
		? await listS3RawObjects({
				bucket: args.s3Bucket,
				prefix: s3RawPrefix,
			})
		: [];
	const inputFiles = s3Mode ? [] : await listInputFiles(args.rawDir);

	if (!s3Mode && inputFiles.length === 0) {
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

	if (s3Mode && s3RawObjects.length === 0) {
		const message = `No raw CAT files found in s3://${args.s3Bucket}/${s3RawPrefix}`;
		if (args.requireInput) {
			throw new Error(message);
		}

		console.info(
			JSON.stringify({
				event: "captacion_index_sync_noop",
				reason: "no_raw_files",
				rawDir: `s3://${args.s3Bucket}/${s3RawPrefix}`,
				territory: args.territory,
			}),
		);
		return;
	}

	const sourceHash = s3Mode
		? hashS3RawObjects(s3RawObjects)
		: await hashInputFiles(inputFiles, args.rawDir);
	const territoryIndexRoot = path.join(args.indexRoot, args.territory);
	const latestManifestPath = path.join(territoryIndexRoot, "latest.json");
	const s3LatestManifestKey = getS3Key(
		args.s3Prefix,
		"indexes",
		args.territory,
		"latest.json",
	);
	const latestManifest = s3Mode
		? await readS3JsonIfExists({
				bucket: args.s3Bucket,
				key: s3LatestManifestKey,
			})
		: await readJsonIfExists(latestManifestPath);
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
		(s3Mode || activeOutputExists)
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
	const localBuildRoot = s3Mode
		? path.join(os.tmpdir(), `captacion-index-${process.pid}-${Date.now()}`)
		: territoryIndexRoot;
	const versionedOutputPath = path.join(localBuildRoot, `${shortHash}.jsonl`);
	const sourceVersion = args.sourceVersion ?? sourceHash;
	const rawDir = s3Mode
		? await downloadS3RawObjects({
				bucket: args.s3Bucket,
				objects: s3RawObjects,
				territory: args.territory,
			})
		: args.rawDir;

	await runBuildIndex({
		outputPath: versionedOutputPath,
		rawDir,
		sourceVersion,
		territory: args.territory,
	});

	const rowCount = await countRows(versionedOutputPath);
	const generatedAt = new Date().toISOString();
	const indexKey = getS3Key(
		args.s3Prefix,
		"indexes",
		args.territory,
		`${shortHash}.jsonl`,
	);
	const manifest = {
		activeOutput: args.activeOutput,
		generatedAt,
		indexKey: s3Mode ? indexKey : undefined,
		indexPath: s3Mode ? undefined : versionedOutputPath,
		inputFileCount: s3Mode ? s3RawObjects.length : inputFiles.length,
		rowCount,
		sourceHash,
		sourceVersion,
		storageMode: s3Mode ? "s3" : "local",
		territory: args.territory,
	};

	if (s3Mode) {
		await putS3Object({
			bucket: args.s3Bucket,
			key: indexKey,
			body: await readFile(versionedOutputPath),
			contentType: "application/x-ndjson; charset=utf-8",
		});
		await putS3Object({
			bucket: args.s3Bucket,
			key: s3LatestManifestKey,
			body: `${JSON.stringify(manifest, null, 2)}\n`,
			contentType: "application/json; charset=utf-8",
		});
	} else {
		await writeJsonAtomic(latestManifestPath, manifest);
	}

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
