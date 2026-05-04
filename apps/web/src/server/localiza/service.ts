import type {
	LocalizaAcquisitionStrategy,
	LocalizaAddressFeedbackInput,
	LocalizaAddressFeedbackResult,
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

export const createLocalizaService = (deps: { convex: ConvexHttpClient }) => ({
	async resolveIdealistaLocation(input: {
		url: string;
		strategy: LocalizaAcquisitionStrategy;
		userId?: string;
	}) {
		return await resolveIdealistaLocation({
			convex: deps.convex,
			url: input.url,
			strategy: input.strategy,
			userId: input.userId,
		});
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
