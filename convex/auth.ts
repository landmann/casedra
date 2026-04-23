import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";

type RequestCtx = QueryCtx | MutationCtx;

const raiseAuthError = (
	code: "FORBIDDEN" | "UNAUTHORIZED",
	message: string,
): never => {
	throw new Error(`${code}:${message}`);
};

export const requireAuthenticatedUserId = async (
	ctx: RequestCtx,
): Promise<string> => {
	const identity =
		(await ctx.auth.getUserIdentity()) ??
		raiseAuthError("UNAUTHORIZED", "Authentication required");

	return identity.subject;
};

export const findCurrentMembership = async (
	ctx: RequestCtx,
	userId: string,
): Promise<Doc<"agencyMemberships"> | null> => {
	const memberships = await ctx.db
		.query("agencyMemberships")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();

	return (
		memberships
			.filter((membership) => membership.status === "active")
			.sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
	);
};

export const requireCurrentMembership = async (
	ctx: RequestCtx,
): Promise<{ membership: Doc<"agencyMemberships">; userId: string }> => {
	const userId = await requireAuthenticatedUserId(ctx);
	const membership =
		(await findCurrentMembership(ctx, userId)) ??
		raiseAuthError(
			"FORBIDDEN",
			"No active agency membership is available for this user",
		);

	return { membership, userId };
};

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return ctx.auth.getUserIdentity();
	},
});
