import type { LocalizaAcquisitionStrategy } from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { rankCaptacionBuildings } from "./captacion-catastro";
import { getLocalizaReadinessSnapshot } from "./readiness";
import { resolveIdealistaLocation } from "./resolver";

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
	async rankCaptacionBuildings(input: {
		boundary: Array<{ lat: number; lng: number }>;
		userId?: string;
	}) {
		return await rankCaptacionBuildings(input);
	},
});
