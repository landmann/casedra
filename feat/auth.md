# Feature: Authentication

This document describes the current Clerk-based authentication flow implemented for the web app.

## Overview

The app uses Clerk for user authentication in `apps/web`.

The implementation adds:

- A branded sign-in screen at `/sign-in`
- Protection for all `/app/*` routes
- Redirect preservation so signed-out users return to their original destination after sign-in
- Signed-in account controls in the studio preview
- A marketing-header CTA that switches between `Iniciar sesión` and `Abrir estudio`

## User Flow

1. A signed-out user visits a protected route under `/app/*`
2. Middleware redirects the user to `/sign-in?redirect_url=<original-url>`
3. Clerk renders the embedded sign-in / sign-up UI on the branded page
4. After successful authentication, Clerk redirects the user back to the requested URL
5. If no redirect target is available, Clerk falls back to `/app/studio`

## Routes

- `/sign-in`
  - Dedicated Clerk route implemented as an App Router catch-all page
  - Supports Clerk sign-in and sign-up UI in the same branded shell

- `/app/*`
  - Protected by Clerk middleware
  - Unauthenticated requests are redirected to `/sign-in`

- `/app/studio`
  - Current post-auth fallback destination
  - Shows a Clerk `UserButton` in the header

## Key Files

- `apps/web/src/middleware.ts`
  - Protects `/app/*`
  - Preserves `redirect_url` for post-login return flow

- `apps/web/src/app/layout.tsx`
  - Configures `ClerkProvider`
  - Sets `signInUrl="/sign-in"` so Clerk helpers use the branded route

- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
  - Branded authentication page
  - Renders Clerk `<SignIn />` with route-based navigation

- `apps/web/src/app/MarketingHeaderAuthCta.tsx`
  - Client-side header CTA for the marketing page
  - Uses Clerk state to show either the sign-in entry point or the studio link

- `apps/web/src/app/page.tsx`
  - Uses the auth-aware header CTA without making the entire marketing page dynamic

- `apps/web/src/app/app/studio/page.tsx`
  - Adds the Clerk `UserButton` to the studio header

- `apps/web/src/app/globals.css`
  - Adds scoped Clerk styling under `.casedra-clerk-auth`

## Branding Notes

The authentication screen follows the repository brand guidance:

- Cream canvas background
- Copper accent for primary actions and auth links
- Instrument Serif for headline treatment
- Geist for interface text

All Clerk-specific styling is scoped to the branded auth container to avoid leaking component overrides into the rest of the app.

## Verification

Verified locally:

- `pnpm --filter web exec tsc --noEmit`

Not fully verified in this environment:

- `next build`
  - Blocked by network access when `next/font` attempted to fetch Google Fonts

## Current Assumptions

- `/app/studio` is the default authenticated landing page
- `/sign-in` is the canonical sign-in URL for the web app
- No additional server-side auth checks were added to individual `/app/*` pages because the route group is protected in middleware

## Follow-Up Options

Possible next steps if the product surface expands:

- Add a dedicated sign-up route if the marketing flow needs separate entry points
- Add route-level onboarding guards after sign-in
- Add auth-specific tests once a frontend test runner is introduced for `apps/web`
