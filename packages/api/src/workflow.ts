import type { Context } from "./context";
import { api } from "./convex";
import {
	mapWorkflowError,
	requireAgencyRole,
	resolveCurrentAgencyRecord,
} from "./workflow-core";

export const resolveCurrentAgency = async (ctx: Context) => {
	return resolveCurrentAgencyRecord({
		sessionUserId: ctx.session?.userId,
		nodeEnv: process.env.NODE_ENV,
		getCurrentAgency: () =>
			ctx.convex.query(api.agencies.getCurrentAgencyForUser, {}),
		createDefaultAgency: () =>
			ctx.convex.mutation(api.agencies.createDefaultAgencyForUser, {}),
	});
};

export { mapWorkflowError, requireAgencyRole };
