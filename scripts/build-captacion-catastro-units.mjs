#!/usr/bin/env node

import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

const DEFAULT_OUTPUT = "data/captacion/catastro-residential-units.jsonl";
const PARSER_VERSION = "captacion-catastro-cat15-2026-05-03";
const gunzipAsync = promisify(gunzip);

const usage = () =>
	`
Usage:
  pnpm captacion:build-index -- --input ./raw-cat --territory madrid --source-version 2026-05

Options:
  --input <path>          Required. Official Catastro CAT file or directory.
  --output <path>         Defaults to ${DEFAULT_OUTPUT}.
  --territory <slug>      Required. Example: madrid.
  --source-version <id>   Required. Official file/version label.
`.trim();

const parseArgs = () => {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	const parsed = {
		output: DEFAULT_OUTPUT,
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		const next = args[index + 1];

		if (arg === "--help" || arg === "-h") {
			console.info(usage());
			process.exit(0);
		}

		if (!arg?.startsWith("--")) {
			throw new Error(`Unexpected argument: ${arg ?? ""}`);
		}

		if (!next || next.startsWith("--")) {
			throw new Error(`Missing value for ${arg}`);
		}

		const key = arg.slice(2);
		if (!["input", "output", "territory", "source-version"].includes(key)) {
			throw new Error(`Unknown option: ${arg}`);
		}

		parsed[key === "source-version" ? "sourceVersion" : key] = next;
		index += 1;
	}

	if (!parsed.input || !parsed.territory || !parsed.sourceVersion) {
		throw new Error(usage());
	}

	return parsed;
};

const normalizeReference = (value) =>
	value
		?.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9]/g, "");

const readField = (line, start, length) =>
	line.slice(start - 1, start - 1 + length).trim();

const parseCatNumber = (value) => {
	const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
	return Number.isFinite(parsed) ? parsed : null;
};

const parseCat15ResidentialUnit = (line, context) => {
	if (readField(line, 1, 2) !== "15") {
		return null;
	}

	const useCode = readField(line, 428, 1);
	if (useCode !== "V") {
		return null;
	}

	const buildingReference = normalizeReference(readField(line, 31, 14));
	const chargeNumber = normalizeReference(readField(line, 45, 4));
	const controlCharacters = normalizeReference(readField(line, 49, 2));
	const surfaceM2 = parseCatNumber(readField(line, 442, 10));

	if (!buildingReference || !chargeNumber || !controlCharacters || !surfaceM2) {
		return {
			error: `Malformed residential CAT type 15 row in ${context.filePath}:${context.lineNumber}`,
		};
	}

	return {
		row: {
			buildingReference,
			cadastralReference: buildingReference,
			unitReference: `${buildingReference}${chargeNumber}${controlCharacters}`,
			surfaceM2,
			use: "Vivienda",
			territory: context.territory,
			sourceVersion: context.sourceVersion,
			parserVersion: PARSER_VERSION,
			observedAt: context.observedAt,
		},
	};
};

const listInputFiles = async (inputPath) => {
	const inputStat = await stat(inputPath);

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

const readCatTextFile = async (filePath) => {
	const contents = await readFile(filePath);
	const decoded = /\.gz$/i.test(filePath)
		? await gunzipAsync(contents)
		: contents;

	return decoded.toString("latin1");
};

const main = async () => {
	const args = parseArgs();
	const inputFiles = await listInputFiles(args.input);
	const observedAt = new Date().toISOString();
	const rowsByUnitReference = new Map();
	const errors = [];

	if (inputFiles.length === 0) {
		throw new Error(`No .CAT or .txt files found in ${args.input}`);
	}

	for (const filePath of inputFiles) {
		const contents = await readCatTextFile(filePath);
		const lines = contents.split(/\r?\n/);

		for (const [index, line] of lines.entries()) {
			if (!line.trim()) {
				continue;
			}

			const parsed = parseCat15ResidentialUnit(line, {
				filePath,
				lineNumber: index + 1,
				observedAt,
				sourceVersion: args.sourceVersion,
				territory: args.territory,
			});

			if (!parsed) {
				continue;
			}

			if (parsed.error) {
				errors.push(parsed.error);
				continue;
			}

			rowsByUnitReference.set(parsed.row.unitReference, parsed.row);
		}
	}

	if (errors.length > 0) {
		throw new Error(
			[
				`Refusing to publish Captacion CAT index with ${errors.length} malformed residential rows.`,
				...errors.slice(0, 20),
			].join("\n"),
		);
	}

	const rows = [...rowsByUnitReference.values()].sort((left, right) =>
		left.unitReference.localeCompare(right.unitReference),
	);

	if (rows.length === 0) {
		throw new Error("No residential CAT type 15 rows found.");
	}

	const outputPath = args.output;
	const tempPath = `${outputPath}.${process.pid}.tmp`;

	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(
		tempPath,
		`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
		"utf8",
	);
	await rename(tempPath, outputPath);

	console.info(
		JSON.stringify({
			event: "captacion_index_generated",
			outputPath,
			rowCount: rows.length,
			inputFileCount: inputFiles.length,
			sourceVersion: args.sourceVersion,
			territory: args.territory,
			parserVersion: PARSER_VERSION,
			observedAt,
		}),
	);
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
