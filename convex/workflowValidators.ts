import { v } from "convex/values";

export const agencyStatusValidator = v.union(
	v.literal("active"),
	v.literal("inactive"),
);

export const agencyRoleValidator = v.union(
	v.literal("owner"),
	v.literal("manager"),
	v.literal("agent"),
);

export const agencyMembershipStatusValidator = v.union(
	v.literal("active"),
	v.literal("invited"),
	v.literal("disabled"),
);

export const channelTypeValidator = v.union(
	v.literal("whatsapp"),
	v.literal("portal_email"),
	v.literal("web_form"),
	v.literal("manual"),
);

export const channelStatusValidator = v.union(
	v.literal("active"),
	v.literal("paused"),
	v.literal("disabled"),
);

export const contactKindValidator = v.union(
	v.literal("buyer"),
	v.literal("seller"),
	v.literal("unknown"),
);

export const leadKindValidator = v.union(
	v.literal("buyer_inquiry"),
	v.literal("seller_inquiry"),
	v.literal("valuation_request"),
	v.literal("other"),
);

export const leadStatusValidator = v.union(
	v.literal("new"),
	v.literal("active"),
	v.literal("closed"),
);

export const conversationStateValidator = v.union(
	v.literal("new"),
	v.literal("bot_active"),
	v.literal("awaiting_human"),
	v.literal("human_active"),
	v.literal("closed"),
);

export const conversationOwnerTypeValidator = v.union(
	v.literal("unassigned"),
	v.literal("ai"),
	v.literal("human"),
);

export const messageDirectionValidator = v.union(
	v.literal("inbound"),
	v.literal("outbound"),
	v.literal("internal"),
);

export const messageSenderTypeValidator = v.union(
	v.literal("lead"),
	v.literal("ai"),
	v.literal("user"),
	v.literal("system"),
);

export const messageBodyFormatValidator = v.union(
	v.literal("plain_text"),
	v.literal("markdown"),
);

export const handoffTriggerValidator = v.union(
	v.literal("low_confidence"),
	v.literal("lead_requested_human"),
	v.literal("manual_takeover"),
	v.literal("routing_rule"),
	v.literal("manager_reassign"),
	v.literal("other"),
);

export const performancePeriodTypeValidator = v.union(
	v.literal("day"),
	v.literal("week"),
);
