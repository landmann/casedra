import { ConvexHttpClient } from "convex/browser";

import { env } from "@/env";

export const createConvexClient = (authToken?: string | null) => {
	const convexClient = new ConvexHttpClient(env.CONVEX_URL);

	if (authToken) {
		convexClient.setAuth(authToken);
	}

	return convexClient;
};
