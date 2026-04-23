import type {
	LocalizaAcquisitionStrategy,
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
	}) => Promise<ResolveIdealistaLocationResult>;
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
