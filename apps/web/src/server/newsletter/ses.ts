import { randomBytes } from "node:crypto";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

import { env } from "@/env";

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const renderBodyHtml = (body: string) =>
	body
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
		.join("");

export const createUnsubscribeToken = () => randomBytes(32).toString("base64url");

export const isSesConfigured = () =>
	Boolean(
		env.AWS_REGION &&
			env.AWS_ACCESS_KEY_ID &&
			env.AWS_SECRET_ACCESS_KEY &&
			env.SES_FROM_EMAIL,
	);

const createSesClient = () => {
	if (!isSesConfigured()) {
		throw new Error("SES no está configurado.");
	}

	return new SESv2Client({
		region: env.AWS_REGION,
		credentials: {
			accessKeyId: env.AWS_ACCESS_KEY_ID!,
			secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		},
	});
};

export const sendNewsletterEmail = async (input: {
	to: string;
	subject: string;
	preheader: string;
	body: string;
	unsubscribeToken: string;
}) => {
	const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
	const unsubscribeUrl = `${appUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
		input.unsubscribeToken,
	)}`;
	const html = `<!doctype html><html><body style="margin:0;background:#FFFBF2;color:#1F1A14;font-family:Georgia,serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(
		input.preheader,
	)}</div><main style="max-width:680px;margin:0 auto;padding:40px 24px"><h1 style="font-size:36px;line-height:1.05;font-weight:400;margin:0 0 24px">${escapeHtml(
		input.subject,
	)}</h1><section style="font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1F1A14">${renderBodyHtml(
		input.body,
	)}</section><hr style="border:0;border-top:1px solid #E8DFCC;margin:32px 0" /><p style="font-family:Arial,sans-serif;color:#6F5E4A;font-size:13px;line-height:1.6">Informe del Comprador de Casedra. Recibes este correo porque pediste recibirlo. <a href="${unsubscribeUrl}" style="color:#9C6137">Darte de baja</a>.</p></main></body></html>`;
	const text = `${input.subject}\n\n${input.preheader}\n\n${input.body}\n\nDarte de baja: ${unsubscribeUrl}`;
	const client = createSesClient();
	const result = await client.send(
		new SendEmailCommand({
			FromEmailAddress: env.SES_FROM_EMAIL,
			ConfigurationSetName: env.SES_CONFIGURATION_SET,
			Destination: {
				ToAddresses: [input.to],
			},
			Content: {
				Simple: {
					Subject: {
						Data: input.subject,
						Charset: "UTF-8",
					},
					Body: {
						Html: {
							Data: html,
							Charset: "UTF-8",
						},
						Text: {
							Data: text,
							Charset: "UTF-8",
						},
					},
				},
			},
		}),
	);

	return {
		messageId: result.MessageId,
	};
};
