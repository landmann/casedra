import { TRPCError } from "@trpc/server";
import { api } from "../convex";
import { protectedProcedure, router } from "../trpc";
import { resolveCurrentAgency } from "../workflow";

export const agenciesRouter = router({
	createDefaultAgencyForUser: protectedProcedure.mutation(async ({ ctx }) => {
		if (process.env.NODE_ENV === "production") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Default agency bootstrap is disabled in production",
			});
		}

		return ctx.convex.mutation(api.agencies.createDefaultAgencyForUser, {});
	}),
	getCurrentAgency: protectedProcedure.query(async ({ ctx }) => {
		return resolveCurrentAgency(ctx);
	}),
	listMemberships: protectedProcedure.query(async ({ ctx }) => {
		await resolveCurrentAgency(ctx);
		return ctx.convex.query(api.agencies.listMemberships, {});
	}),
});
