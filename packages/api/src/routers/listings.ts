import type { LocalizaErrorCode } from "@casedra/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { api } from "../convex";
import {
	listingBatchCreateInputSchema,
	listingCreateInputSchema,
	listingFiltersSchema,
	resolveIdealistaLocationInputSchema,
} from "../schema/listings";
import { mediaGenerationRequestSchema } from "../schema/media";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const localizaErrorCodeToTrpcCode: Record<
	LocalizaErrorCode,
	TRPCError["code"]
> = {
	feature_disabled: "FORBIDDEN",
	invalid_url: "BAD_REQUEST",
	unsupported_url: "BAD_REQUEST",
	timeout: "GATEWAY_TIMEOUT",
	upstream_unavailable: "SERVICE_UNAVAILABLE",
};

const isLocalizaServiceError = (
	error: unknown,
): error is { code: LocalizaErrorCode; message: string } => {
	if (!error || typeof error !== "object") {
		return false;
	}

	const code = "code" in error ? error.code : undefined;
	const message = "message" in error ? error.message : undefined;

	return (
		typeof code === "string" &&
		code in localizaErrorCodeToTrpcCode &&
		typeof message === "string"
	);
};

export const listingsRouter = router({
	create: protectedProcedure
		.input(listingCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const listingId = await ctx.convex.mutation(api.listings.create, input);

			return { id: listingId };
		}),
	createBatch: protectedProcedure
		.input(listingBatchCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const listingIds = await ctx.convex.mutation(api.listings.createBatch, {
				idempotencyKey: input.idempotencyKey,
				listings: input.listings,
			});

			return { ids: listingIds };
		}),
	list: protectedProcedure
		.input(listingFiltersSchema.optional())
		.query(async ({ ctx, input }) => {
			const listings = await ctx.convex.query(api.listings.list, input ?? {});
			return listings;
		}),
	byId: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1, "Listing id is required"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const listing = await ctx.convex.query(api.listings.byId, input);

			if (!listing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Listing not found",
				});
			}

			return listing;
		}),
	resolveIdealistaLocation: protectedProcedure
		.input(resolveIdealistaLocationInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.localiza.resolveIdealistaLocation(input);
			} catch (error) {
				if (isLocalizaServiceError(error)) {
					throw new TRPCError({
						code: localizaErrorCodeToTrpcCode[error.code],
						message: error.message,
					});
				}

				throw error;
			}
		}),
	generateMedia: protectedProcedure
		.input(mediaGenerationRequestSchema)
		.mutation(async ({ ctx, input }) => {
			const result = await ctx.fal.generateMedia(input);
			return result;
		}),
});

export const listingsPublicRouter = router({
	listPublic: publicProcedure
		.input(listingFiltersSchema.optional())
		.query(async ({ ctx, input }) => {
			const status =
				input?.status === "active" || input?.status === "sold"
					? input.status
					: undefined;

			return ctx.convex.query(api.listings.listPublic, {
				status,
				search: input?.search,
			});
		}),
});
