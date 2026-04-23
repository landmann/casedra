import { api } from "../convex";
import {
	conversationIdSchema,
	conversationListFiltersSchema,
	createManualConversationInputSchema,
	reassignConversationInputSchema,
	setConversationStateInputSchema,
	takeOverConversationInputSchema,
} from "../schema/workflow";
import { protectedProcedure, router } from "../trpc";
import {
	mapWorkflowError,
	requireAgencyRole,
	resolveCurrentAgency,
} from "../workflow";

export const conversationsRouter = router({
	list: protectedProcedure
		.input(conversationListFiltersSchema.optional())
		.query(async ({ ctx, input }) => {
			await resolveCurrentAgency(ctx);

			return ctx.convex.query(api.workflow.listConversations, {
				state: input?.state,
				search: input?.search,
			});
		}),
	byId: protectedProcedure
		.input(conversationIdSchema)
		.query(async ({ ctx, input }) => {
			await resolveCurrentAgency(ctx);

			try {
				return await ctx.convex.query(api.workflow.getConversationById, {
					conversationId: input.id,
				});
			} catch (error) {
				mapWorkflowError(error);
			}
		}),
	createManual: protectedProcedure
		.input(createManualConversationInputSchema)
		.mutation(async ({ ctx, input }) => {
			await resolveCurrentAgency(ctx);

			try {
				return await ctx.convex.mutation(
					api.workflow.createManualConversation,
					{
						...input,
					},
				);
			} catch (error) {
				mapWorkflowError(error);
			}
		}),
	takeOver: protectedProcedure
		.input(takeOverConversationInputSchema)
		.mutation(async ({ ctx, input }) => {
			await resolveCurrentAgency(ctx);

			try {
				return await ctx.convex.mutation(api.workflow.takeOverConversation, {
					conversationId: input.id,
					expectedVersion: input.expectedVersion,
				});
			} catch (error) {
				mapWorkflowError(error);
			}
		}),
	reassign: protectedProcedure
		.input(reassignConversationInputSchema)
		.mutation(async ({ ctx, input }) => {
			const currentAgency = await resolveCurrentAgency(ctx);
			requireAgencyRole(currentAgency.membership.role, ["owner", "manager"]);

			try {
				return await ctx.convex.mutation(api.workflow.reassignConversation, {
					conversationId: input.id,
					assigneeUserId: input.assigneeUserId,
					expectedVersion: input.expectedVersion,
					reason: input.reason,
				});
			} catch (error) {
				mapWorkflowError(error);
			}
		}),
	setState: protectedProcedure
		.input(setConversationStateInputSchema)
		.mutation(async ({ ctx, input }) => {
			await resolveCurrentAgency(ctx);

			try {
				return await ctx.convex.mutation(api.workflow.setConversationState, {
					conversationId: input.id,
					expectedVersion: input.expectedVersion,
					state: input.state,
				});
			} catch (error) {
				mapWorkflowError(error);
			}
		}),
});
