import twilio from "twilio";
import { z } from "zod";

import { env } from "@/env";

import type {
	NormalizedWhatsAppAttachment,
	NormalizedWhatsAppInboundMessage,
	WhatsAppSendMessageInput,
	WhatsAppSendResult,
	WhatsAppSendTemplateMessageInput,
} from "./provider";

const TWILIO_WHATSAPP_PROVIDER = "twilio_whatsapp" as const;
const WHATSAPP_PREFIX = "whatsapp:";

const twilioInboundSchema = z
	.object({
		AccountSid: z.string().min(1),
		MessageSid: z.string().min(1),
		From: z.string().min(1),
		To: z.string().min(1),
		Body: z.string().optional().default(""),
		ProfileName: z.string().optional(),
		WaId: z.string().optional(),
		NumMedia: z.string().optional().default("0"),
		MessagingServiceSid: z.string().optional(),
	})
	.passthrough();

export type TwilioWebhookFields = Record<string, string>;

const normalizeWhatsAppPhone = (value?: string | null) => {
	if (!value) {
		return null;
	}

	const normalized = value
		.replace(WHATSAPP_PREFIX, "")
		.replace(/[^+\d]/g, "")
		.trim();

	if (!normalized) {
		return null;
	}

	return normalized.startsWith("+") ? normalized : `+${normalized}`;
};

const resolveWhatsAppAddress = (value: string) =>
	value.startsWith(WHATSAPP_PREFIX) ? value : `${WHATSAPP_PREFIX}${value}`;

const collectMediaAttachments = (
	fields: TwilioWebhookFields,
	count: number,
): NormalizedWhatsAppAttachment[] =>
	Array.from({ length: count }, (_, index) => ({
		url: fields[`MediaUrl${index}`] ?? "",
		contentType: fields[`MediaContentType${index}`] ?? null,
	})).filter((attachment) => attachment.url.length > 0);

const buildMessageBody = (body: string, attachments: NormalizedWhatsAppAttachment[]) => {
	const trimmedBody = body.trim();

	if (!attachments.length) {
		return trimmedBody.length > 0 ? trimmedBody : "Incoming WhatsApp message.";
	}

	const attachmentLine =
		attachments.length === 1
			? "Sent 1 attachment."
			: `Sent ${attachments.length} attachments.`;

	return [trimmedBody, attachmentLine].filter(Boolean).join("\n\n");
};

const getTwilioConfig = (context: string) => {
	if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
		throw new Error(`${context}: Twilio credentials are not configured`);
	}

	return {
		accountSid: env.TWILIO_ACCOUNT_SID,
		authToken: env.TWILIO_AUTH_TOKEN,
	};
};

let twilioClient: ReturnType<typeof twilio> | null = null;

export const isTwilioWhatsAppConfigured = () =>
	Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);

export const getTwilioWebhookValidationUrl = (requestUrl: string) => {
	if (!env.TWILIO_WEBHOOK_BASE_URL) {
		return requestUrl;
	}

	const request = new URL(requestUrl);
	const base = new URL(env.TWILIO_WEBHOOK_BASE_URL);

	return `${base.origin}${request.pathname}${request.search}`;
};

export const formDataToTwilioWebhookFields = (
	formData: FormData,
): TwilioWebhookFields => {
	const fields: TwilioWebhookFields = {};

	for (const [key, value] of formData.entries()) {
		fields[key] = typeof value === "string" ? value : value.name;
	}

	return fields;
};

export const validateTwilioWebhookRequest = (options: {
	signature: string | null;
	url: string;
	params: TwilioWebhookFields;
}) => {
	const { authToken } = getTwilioConfig("Twilio webhook validation");

	if (!options.signature) {
		return false;
	}

	return twilio.validateRequest(
		authToken,
		options.signature,
		options.url,
		options.params,
	);
};

export const normalizeTwilioWhatsAppInboundMessage = (
	fields: TwilioWebhookFields,
): NormalizedWhatsAppInboundMessage => {
	const parsed = twilioInboundSchema.parse(fields);
	const fromPhone =
		normalizeWhatsAppPhone(parsed.From) ?? normalizeWhatsAppPhone(parsed.WaId);
	const toPhone = normalizeWhatsAppPhone(parsed.To);

	if (!fromPhone || !toPhone) {
		throw new Error(
			"Twilio WhatsApp webhook payload is missing a valid WhatsApp phone number",
		);
	}

	const mediaCount = Number.parseInt(parsed.NumMedia, 10);
	const attachments = collectMediaAttachments(
		fields,
		Number.isFinite(mediaCount) && mediaCount > 0 ? mediaCount : 0,
	);

	return {
		channel: {
			externalChannelId: toPhone,
			label: `WhatsApp ${toPhone}`,
			provider: TWILIO_WHATSAPP_PROVIDER,
		},
		contact: {
			kind: "buyer",
			fullName: parsed.ProfileName?.trim() || undefined,
			phone: fromPhone,
		},
		lead: {
			kind: "buyer_inquiry",
			sourceLabel: "WhatsApp",
			rawPayload: fields,
		},
		message: {
			body: buildMessageBody(parsed.Body, attachments),
			sentAt: Date.now(),
			dedupeKey: `twilio:whatsapp:${parsed.MessageSid}`,
			providerMessageId: parsed.MessageSid,
			externalEventId: parsed.MessageSid,
			metadata: {
				accountSid: parsed.AccountSid,
				from: parsed.From,
				to: parsed.To,
				messagingServiceSid: parsed.MessagingServiceSid ?? null,
				profileName: parsed.ProfileName ?? null,
				waId: parsed.WaId ?? null,
				numMedia: attachments.length,
				attachments,
			},
		},
	};
};

export const getTwilioClient = () => {
	const { accountSid, authToken } = getTwilioConfig("Twilio client");

	if (!twilioClient) {
		twilioClient = twilio(accountSid, authToken);
	}

	return twilioClient;
};

export const sendTwilioWhatsAppMessage = async (
	input: WhatsAppSendMessageInput,
): Promise<WhatsAppSendResult> => {
	const client = getTwilioClient();
	const from =
		input.from ??
		(env.TWILIO_MESSAGING_SERVICE_SID ? undefined : env.TWILIO_WHATSAPP_FROM);

	if (!from && !input.messagingServiceSid && !env.TWILIO_MESSAGING_SERVICE_SID) {
		throw new Error(
			"Twilio WhatsApp sending is not configured with a sender or Messaging Service",
		);
	}

	const response = await client.messages.create({
		to: resolveWhatsAppAddress(input.to),
		from: from ? resolveWhatsAppAddress(from) : undefined,
		messagingServiceSid:
			input.messagingServiceSid ?? env.TWILIO_MESSAGING_SERVICE_SID ?? undefined,
		body: input.body,
		mediaUrl: input.mediaUrls?.length ? input.mediaUrls : undefined,
		statusCallback: input.statusCallbackUrl,
	});

	return {
		provider: TWILIO_WHATSAPP_PROVIDER,
		providerMessageId: response.sid,
		status: response.status ?? null,
		raw: {
			sid: response.sid,
			status: response.status ?? null,
			to: response.to ?? null,
			from: response.from ?? null,
			messagingServiceSid: response.messagingServiceSid ?? null,
		},
	};
};

export const sendTwilioWhatsAppTemplateMessage = async (
	input: WhatsAppSendTemplateMessageInput,
): Promise<WhatsAppSendResult> => {
	const client = getTwilioClient();
	const from =
		input.from ??
		(env.TWILIO_MESSAGING_SERVICE_SID ? undefined : env.TWILIO_WHATSAPP_FROM);

	if (!from && !input.messagingServiceSid && !env.TWILIO_MESSAGING_SERVICE_SID) {
		throw new Error(
			"Twilio WhatsApp template sending is not configured with a sender or Messaging Service",
		);
	}

	const response = await client.messages.create({
		to: resolveWhatsAppAddress(input.to),
		from: from ? resolveWhatsAppAddress(from) : undefined,
		messagingServiceSid:
			input.messagingServiceSid ?? env.TWILIO_MESSAGING_SERVICE_SID ?? undefined,
		contentSid: input.contentSid,
		contentVariables: input.contentVariables
			? JSON.stringify(input.contentVariables)
			: undefined,
		statusCallback: input.statusCallbackUrl,
	});

	return {
		provider: TWILIO_WHATSAPP_PROVIDER,
		providerMessageId: response.sid,
		status: response.status ?? null,
		raw: {
			sid: response.sid,
			status: response.status ?? null,
			to: response.to ?? null,
			from: response.from ?? null,
			messagingServiceSid: response.messagingServiceSid ?? null,
			contentSid: input.contentSid,
		},
	};
};
