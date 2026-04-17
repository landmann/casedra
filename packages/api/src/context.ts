import type {
	MediaGenerationRequest,
	MediaGenerationResult,
} from "@casablanca/types";
import type { ConvexHttpClient } from "convex/browser";

export interface CasablancaSession {
	userId: string;
	sessionId: string | null;
}

export interface CasablancaContext {
	convex: ConvexHttpClient;
	session: CasablancaSession | null;
	fal: {
		generateMedia: (
			request: MediaGenerationRequest,
		) => Promise<MediaGenerationResult>;
	};
}

export const createContext = (context: CasablancaContext) => context;

export type Context = Awaited<ReturnType<typeof createContext>>;
