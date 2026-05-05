"use client";

import { Button, Input } from "@casedra/ui";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

type CaptacionUploadResponse = {
	error?: string;
	headers?: Record<string, string>;
	location?: string;
	uploadUrl?: string;
};

const isSupportedArchive = (fileName: string) =>
	/\.(cat|txt|gz)$/i.test(fileName);

export function CaptacionIndexUploadForm({
	storageMode,
	territory,
}: {
	storageMode: "local" | "s3";
	territory: string;
}) {
	const router = useRouter();
	const [status, setStatus] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const uploadEnabled = storageMode === "s3";

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const form = event.currentTarget;
		const formData = new FormData(form);
		const file = formData.get("catArchive");

		if (!(file instanceof File) || file.size === 0) {
			setStatus("Selecciona un archivo CAT.");
			return;
		}

		if (!isSupportedArchive(file.name)) {
			setStatus("El archivo debe ser .CAT, .txt o .gz.");
			return;
		}

		setIsUploading(true);
		setStatus("Preparando subida.");

		try {
			const response = await fetch("/api/localiza/captacion/raw-upload", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					contentType: file.type || "application/octet-stream",
					fileName: file.name,
					sizeBytes: file.size,
					territory,
				}),
			});
			const upload = (await response.json()) as CaptacionUploadResponse;

			if (!response.ok || !upload.uploadUrl) {
				throw new Error(upload.error ?? "No se pudo preparar la subida.");
			}

			setStatus("Subiendo a S3.");

			const uploadResponse = await fetch(upload.uploadUrl, {
				method: "PUT",
				headers: upload.headers ?? {},
				body: file,
			});

			if (!uploadResponse.ok) {
				throw new Error("S3 rechazó la subida.");
			}

			form.reset();
			setStatus(`Subido: ${upload.location ?? file.name}`);
			router.refresh();
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "No se pudo subir el archivo.",
			);
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="grid gap-3">
			<Input
				accept=".cat,.CAT,.txt,.TXT,.gz,.GZ"
				aria-label="Archivo CAT"
				disabled={!uploadEnabled || isUploading}
				name="catArchive"
				type="file"
			/>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="submit"
					disabled={!uploadEnabled || isUploading}
					className="gap-2"
				>
					<Upload className="h-4 w-4" aria-hidden="true" />
					{isUploading ? "Subiendo" : "Subir CAT"}
				</Button>
				{status ? (
					<p className="text-sm text-muted-foreground" aria-live="polite">
						{status}
					</p>
				) : null}
			</div>
			{uploadEnabled ? null : (
				<p className="text-sm text-muted-foreground">
					S3 no está configurado; usa la ruta local del índice.
				</p>
			)}
		</form>
	);
}
