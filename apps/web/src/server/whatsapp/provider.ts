import type { ContactKind, LeadKind } from "@casedra/types";

export type WhatsAppProviderName = "twilio_whatsapp" | "meta_whatsapp";

export interface NormalizedWhatsAppAttachment {
	url: string;
	contentType?: string | null;
}

export interface NormalizedWhatsAppInboundMessage {
	channel: {
		externalChannelId: string;
		label: string;
		provider: WhatsAppProviderName;
	};
	contact: {
		kind: ContactKind;
		fullName?: string;
		phone: string;
		preferredLanguage?: string;
		notes?: string;
	};
	lead: {
		kind: LeadKind;
		sourceLabel: string;
		rawPayload?: Record<string, string>;
	};
	message: {
		body: string;
		sentAt: number;
		dedupeKey: string;
		providerMessageId: string;
		externalEventId?: string;
		metadata?: Record<string, unknown>;
	};
}

export interface WhatsAppSendMessageInput {
	to: string;
	body: string;
	mediaUrls?: string[];
	from?: string;
	messagingServiceSid?: string;
	statusCallbackUrl?: string;
}

export interface WhatsAppSendTemplateMessageInput {
	to: string;
	contentSid: string;
	contentVariables?: Record<string, string>;
	from?: string;
	messagingServiceSid?: string;
	statusCallbackUrl?: string;
}

export interface WhatsAppSendResult {
	provider: WhatsAppProviderName;
	providerMessageId: string;
	status: string | null;
	raw: Record<string, unknown>;
}
