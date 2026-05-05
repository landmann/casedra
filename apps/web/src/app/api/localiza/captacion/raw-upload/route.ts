import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createCaptacionRawArchiveUploadUrl } from "@/server/localiza/captacion-storage";

export const runtime = "nodejs";

type UploadRequestBody = {
	contentType?: unknown;
	fileName?: unknown;
	sizeBytes?: unknown;
	territory?: unknown;
};

const parseBody = async (request: Request): Promise<UploadRequestBody> => {
	try {
		const body = await request.json();
		return body && typeof body === "object" ? body : {};
	} catch {
		return {};
	}
};

export const POST = async (request: Request) => {
	const { userId } = await auth();

	if (!userId) {
		return NextResponse.json({ error: "No autorizado." }, { status: 401 });
	}

	try {
		const body = await parseBody(request);
		const fileName =
			typeof body.fileName === "string" ? body.fileName.trim() : "";

		if (!fileName) {
			return NextResponse.json(
				{ error: "Falta el nombre del archivo." },
				{ status: 400 },
			);
		}

		const upload = await createCaptacionRawArchiveUploadUrl({
			contentType:
				typeof body.contentType === "string" ? body.contentType : undefined,
			fileName,
			sizeBytes:
				typeof body.sizeBytes === "number" ? body.sizeBytes : undefined,
			territory:
				typeof body.territory === "string" ? body.territory : undefined,
		});

		return NextResponse.json(upload);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "No se pudo preparar la subida.",
			},
			{ status: 400 },
		);
	}
};
