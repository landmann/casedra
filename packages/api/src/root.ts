import { agenciesRouter } from "./routers/agencies";
import { conversationsRouter } from "./routers/conversations";
import { listingsRouter } from "./routers/listings";
import { messagesRouter } from "./routers/messages";
import { router } from "./trpc";

export const appRouter = router({
	agencies: agenciesRouter,
	conversations: conversationsRouter,
	listings: listingsRouter,
	messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
