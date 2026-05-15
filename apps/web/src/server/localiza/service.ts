import type {
	LocalizaAcquisitionStrategy,
	LocalizaAddressFeedbackInput,
	LocalizaAddressFeedbackResult,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { rankCaptacionBuildings } from "./captacion-catastro";
import { getLocalizaReadinessSnapshot } from "./readiness";
import { resolveIdealistaLocation } from "./resolver";

const submitUserFeedbackRef = makeFunctionReference<
	"mutation",
	LocalizaAddressFeedbackInput & Record<string, unknown>,
	LocalizaAddressFeedbackResult
>("localizaGoldenLiveFixtures:submitUserFeedback");

const recordUserPropertyHistoryRef = makeFunctionReference<
	"mutation",
	{
		result: ResolveIdealistaLocationResult;
		propertyHistoryKey?: string;
		now?: number;
	},
	{ id: string; created: boolean }
>("locationResolutions:recordUserPropertyHistory");

export const createLocalizaService = (deps: { convex: ConvexHttpClient }) => ({
	async resolveIdealistaLocation(input: {
		url: string;
		strategy: LocalizaAcquisitionStrategy;
		userId?: string;
	}) {
		const result = await resolveIdealistaLocation({
			convex: deps.convex,
			url: input.url,
			strategy: input.strategy,
			userId: input.userId,
		});

		try {
			await deps.convex.mutation(recordUserPropertyHistoryRef, {
				result,
				now: Date.now(),
			});
		} catch (error) {
			console.warn("Localiza table history write failed", error);
		}

		return result;
	},
	async getReadinessSnapshot(input?: { now?: number; sinceMs?: number }) {
		return await getLocalizaReadinessSnapshot({
			convex: deps.convex,
			now: input?.now,
			sinceMs: input?.sinceMs,
		});
	},
	async submitAddressFeedback(input: LocalizaAddressFeedbackInput) {
		return await deps.convex.mutation(submitUserFeedbackRef, { ...input });
	},
	async rankCaptacionBuildings(input: {
		boundary: Array<{ lat: number; lng: number }>;
		userId?: string;
	}) {
		return await rankCaptacionBuildings(input);
	},
});
