import type {
	CaptacionBoundaryPoint,
	CaptacionRankingResult,
	LocalizaAddressFeedbackInput,
	LocalizaAddressFeedbackResult,
	LocalizaAcquisitionStrategy,
	LocalizaReadinessSnapshot,
	MediaGenerationRequest,
	MediaGenerationResult,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";

export interface CasedraSession {
	userId: string;
	sessionId: string | null;
}

export interface LocalizaService {
	resolveIdealistaLocation: (request: {
		url: string;
		strategy: LocalizaAcquisitionStrategy;
		userId?: string;
	}) => Promise<ResolveIdealistaLocationResult>;
	getReadinessSnapshot: (request?: {
		now?: number;
		sinceMs?: number;
	}) => Promise<LocalizaReadinessSnapshot>;
	submitAddressFeedback: (
		request: LocalizaAddressFeedbackInput,
	) => Promise<LocalizaAddressFeedbackResult>;
	rankCaptacionBuildings: (request: {
		boundary: CaptacionBoundaryPoint[];
		userId?: string;
	}) => Promise<CaptacionRankingResult>;
}

export interface CasedraContext {
	convex: ConvexHttpClient;
	session: CasedraSession | null;
	fal: {
		generateMedia: (
			request: MediaGenerationRequest,
		) => Promise<MediaGenerationResult>;
	};
	localiza: LocalizaService;
}

export const createContext = (context: CasedraContext) => context;

export type Context = Awaited<ReturnType<typeof createContext>>;
