import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/masterplan(.*)"]);

export default clerkMiddleware(async (auth, request) => {
	if (!isProtectedRoute(request)) {
		return;
	}

	const signInUrl = new URL("/sign-in", request.url);
	signInUrl.searchParams.set("redirect_url", request.url);

	await auth.protect({
		unauthenticatedUrl: signInUrl.toString(),
	});
});

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
