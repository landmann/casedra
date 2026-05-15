import { v } from "convex/values";
import {
	type MutationCtx,
	type QueryCtx,
	mutation,
	query,
} from "./_generated/server";

const COPY_REVIEWER_EMAILS = new Set([
	"nlandmanc@gmail.com",
	"debbielandman77@gmail.com",
	"debbielandman88@gmail.com",
]);

const copySuggestionStatusValidator = v.union(
	v.literal("open"),
	v.literal("applied"),
	v.literal("dismissed"),
);

type RequestCtx = QueryCtx | MutationCtx;

const normalizeEmailAddress = (emailAddress?: string | null) =>
	emailAddress?.trim().toLowerCase() ?? null;

const normalizeSelectedText = (value: string) =>
	value.trim().replace(/\s+/g, " ").slice(0, 1200);

const normalizeFreeformText = (value?: string) => {
	const normalized = value?.trim().slice(0, 4000);

	return normalized ? normalized : undefined;
};

const requireCopyReviewIdentity = async (ctx: RequestCtx) => {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("UNAUTHORIZED:Authentication required");
	}

	const emailAddress = normalizeEmailAddress(identity.email);

	if (!emailAddress || !COPY_REVIEWER_EMAILS.has(emailAddress)) {
		throw new Error("FORBIDDEN:Copy review is not available for this user");
	}

	return {
		emailAddress,
		userId: identity.subject,
	};
};

export const submit = mutation({
	args: {
		selectedText: v.string(),
		suggestedText: v.string(),
		note: v.optional(v.string()),
		pagePath: v.string(),
		pageUrl: v.string(),
		pageTitle: v.optional(v.string()),
		contextBefore: v.optional(v.string()),
		contextAfter: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await requireCopyReviewIdentity(ctx);
		const selectedText = normalizeSelectedText(args.selectedText);
		const suggestedText = normalizeFreeformText(args.suggestedText);

		if (!selectedText) {
			throw new Error("BAD_REQUEST:Select text before submitting");
		}

		if (!suggestedText) {
			throw new Error("BAD_REQUEST:Suggested text is required");
		}

		const now = Date.now();

		return await ctx.db.insert("copySuggestions", {
			selectedText,
			suggestedText,
			note: normalizeFreeformText(args.note),
			pagePath: args.pagePath.trim().slice(0, 500),
			pageUrl: args.pageUrl.trim().slice(0, 1000),
			pageTitle: normalizeFreeformText(args.pageTitle),
			contextBefore: normalizeFreeformText(args.contextBefore),
			contextAfter: normalizeFreeformText(args.contextAfter),
			submittedByUserId: identity.userId,
			submittedByEmail: identity.emailAddress,
			status: "open",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const list = query({
	args: {
		limit: v.optional(v.number()),
		status: v.optional(copySuggestionStatusValidator),
	},
	handler: async (ctx, args) => {
		await requireCopyReviewIdentity(ctx);

		const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
		const records = args.status
			? await ctx.db
					.query("copySuggestions")
					.withIndex("by_status_created_at", (q) =>
						q.eq("status", args.status ?? "open"),
					)
					.order("desc")
					.take(limit)
			: await ctx.db
					.query("copySuggestions")
					.withIndex("by_created_at")
					.order("desc")
					.take(limit);

		return records;
	},
});

export const setStatus = mutation({
	args: {
		id: v.id("copySuggestions"),
		status: copySuggestionStatusValidator,
	},
	handler: async (ctx, args) => {
		await requireCopyReviewIdentity(ctx);

		await ctx.db.patch(args.id, {
			status: args.status,
			updatedAt: Date.now(),
		});

		return { id: args.id, status: args.status };
	},
});
