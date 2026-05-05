import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";

const DEFAULT_TERRITORY = "madrid";
const LOCAL_RAW_ROOT = path.join(process.cwd(), "data/captacion/raw");
const LOCAL_INDEX_ROOT = path.join(process.cwd(), "data/captacion/indexes");

const normalizePrefix = (value?: string) =>
	value?.replace(/^\/+|\/+$/g, "") ?? "captacion";

const safeFileName = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120) || "catastro.cat";

export const normalizeCaptacionTerritory = (value?: string) => {
	const normalized = value
		?.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalized || DEFAULT_TERRITORY;
};

export const isSupportedCaptacionArchiveFileName = (fileName: string) =>
	/\.(cat|txt|gz)$/i.test(fileName);

const createS3Client = () => {
	const { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY } = env;

	if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
		throw new Error("El almacenamiento S3 de Captación no está configurado.");
	}

	return new S3Client({
		region: AWS_REGION,
		credentials: {
			accessKeyId: AWS_ACCESS_KEY_ID,
			secretAccessKey: AWS_SECRET_ACCESS_KEY,
		},
	});
};

export const isCaptacionS3Configured = () =>
	Boolean(
		env.CAPTACION_S3_BUCKET &&
			env.AWS_REGION &&
			env.AWS_ACCESS_KEY_ID &&
			env.AWS_SECRET_ACCESS_KEY,
	);

export const getCaptacionS3Prefix = () =>
	normalizePrefix(env.CAPTACION_S3_PREFIX);

export const getCaptacionS3Key = (...parts: string[]) =>
	[getCaptacionS3Prefix(), ...parts]
		.map((part) => part.replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");

const readS3TextObject = async (key: string) => {
	const result = await createS3Client().send(
		new GetObjectCommand({
			Bucket: env.CAPTACION_S3_BUCKET,
			Key: key,
		}),
	);

	return await result.Body?.transformToString("utf8");
};

const readJsonIfExists = async (filePath: string) => {
	try {
		return JSON.parse(await readFile(filePath, "utf8")) as Record<
			string,
			unknown
		>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
};

const readS3JsonIfExists = async (key: string) => {
	try {
		const body = await readS3TextObject(key);
		return body ? (JSON.parse(body) as Record<string, unknown>) : null;
	} catch (error) {
		const name = (error as { name?: string }).name;
		if (name === "NoSuchKey" || name === "NotFound") {
			return null;
		}
		throw error;
	}
};

export const readCaptacionUnitIndexText = async (
	territory = DEFAULT_TERRITORY,
) => {
	const normalizedTerritory = normalizeCaptacionTerritory(territory);

	if (isCaptacionS3Configured()) {
		const latestManifest = await readS3JsonIfExists(
			getCaptacionS3Key("indexes", normalizedTerritory, "latest.json"),
		);
		const indexKey =
			typeof latestManifest?.indexKey === "string"
				? latestManifest.indexKey
				: undefined;

		if (indexKey) {
			return await readS3TextObject(indexKey);
		}
	}

	try {
		return await readFile(
			path.join(
				process.cwd(),
				"data/captacion/catastro-residential-units.jsonl",
			),
			"utf8",
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
};

export const getCaptacionIndexStatus = async (
	territory = DEFAULT_TERRITORY,
) => {
	const normalizedTerritory = normalizeCaptacionTerritory(territory);
	const storageMode = isCaptacionS3Configured()
		? ("s3" as const)
		: ("local" as const);
	let latestManifest: Record<string, unknown> | null = null;
	let statusError: string | undefined;

	try {
		latestManifest =
			storageMode === "s3"
				? await readS3JsonIfExists(
						getCaptacionS3Key("indexes", normalizedTerritory, "latest.json"),
					)
				: await readJsonIfExists(
						path.join(LOCAL_INDEX_ROOT, normalizedTerritory, "latest.json"),
					);
	} catch (error) {
		statusError =
			error instanceof Error ? error.message : "No se pudo leer el índice.";
	}

	return {
		latestManifest,
		rawLocation:
			storageMode === "s3"
				? `s3://${env.CAPTACION_S3_BUCKET}/${getCaptacionS3Key("raw", normalizedTerritory)}`
				: path.join(LOCAL_RAW_ROOT, normalizedTerritory),
		statusError,
		storageMode,
	};
};

export const createCaptacionRawArchiveUploadUrl = async (input: {
	contentType?: string;
	fileName: string;
	sizeBytes?: number;
	territory?: string;
}) => {
	if (!isSupportedCaptacionArchiveFileName(input.fileName)) {
		throw new Error("El archivo debe ser .CAT, .txt o .gz.");
	}

	if (input.sizeBytes !== undefined && input.sizeBytes <= 0) {
		throw new Error("El archivo está vacío.");
	}

	const territory = normalizeCaptacionTerritory(input.territory);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `${timestamp}-${safeFileName(input.fileName)}`;

	if (!isCaptacionS3Configured()) {
		throw new Error("Configura S3 antes de subir archivos CAT desde la app.");
	}

	const key = getCaptacionS3Key("raw", territory, fileName);
	const contentType = input.contentType || "application/octet-stream";
	const uploadUrl = await getSignedUrl(
		createS3Client(),
		new PutObjectCommand({
			Bucket: env.CAPTACION_S3_BUCKET,
			Key: key,
			ContentType: contentType,
		}),
		{ expiresIn: 15 * 60 },
	);

	return {
		headers: {
			"content-type": contentType,
		},
		key,
		location: `s3://${env.CAPTACION_S3_BUCKET}/${key}`,
		storageMode: "s3" as const,
		uploadUrl,
	};
};
