import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import { hashValue } from "@/server/buyers/forms";
import { createConvexClient } from "@/server/convexClient";

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token")?.trim();
	if (!token) {
		return new NextResponse("Falta el token de baja.", { status: 400 });
	}

	const tokenHash = hashValue(token);
	if (!tokenHash) {
		return new NextResponse("El token de baja no es válido.", { status: 400 });
	}

	const convex = createConvexClient();
	await convex.mutation(api.newsletter.unsubscribeByTokenHash, {
		tokenHash,
		formPath: "/api/newsletter/unsubscribe",
		rawPayload: {
			userAgent: request.headers.get("user-agent") ?? undefined,
		},
	});

	return new NextResponse(
		`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baja confirmada | Casedra</title><style>body{margin:0;background:#FFFBF2;color:#1F1A14;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:32px}section{max-width:560px}h1{font-family:Georgia,serif;font-size:48px;font-weight:400;line-height:.98;margin:0 0 16px}p{color:#6F5E4A;line-height:1.7}a{color:#9C6137}</style></head><body><main><section><h1>Baja confirmada.</h1><p>Casedra no enviará más correos del Informe del Comprador a esta dirección. Si ha sido un error, puedes volver a apuntarte desde una página para compradores.</p><p><a href="/buyers">Volver a Casedra</a></p></section></main></body></html>`,
		{
			headers: {
				"content-type": "text/html; charset=utf-8",
			},
		},
	);
}
