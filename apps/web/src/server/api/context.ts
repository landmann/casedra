import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@clerk/nextjs/server";

import type { CasablancaContext } from "@casablanca/api";
import { createContext as createCasablancaContext } from "@casablanca/api";

import { generateMediaFromFal } from "@/server/media";
import { getConvexClient } from "@/server/convexClient";

export const createTRPCContext = async (
	_opts: FetchCreateContextFnOptions,
): Promise<CasablancaContext> => {
	void _opts;
	const { userId, sessionId } = await auth();
	const session = userId ? { userId, sessionId: sessionId ?? null } : null;

	return createCasablancaContext({
		convex: getConvexClient(),
		session,
		fal: {
			generateMedia: generateMediaFromFal,
		},
	});
};
