import { defineMiddleware } from "astro:middleware";

import { createServerClient } from "../db/supabase.client.ts";

/**
 * Public paths that don't require authentication
 * Split into exact matches and prefix matches for efficient lookup
 */
const PUBLIC_EXACT_PATHS = new Set([
  // Public pages
  "/",
  "/privacy-policy",

  // Auth pages
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",

  // Auth API endpoints
  "/api/v1/auth/sign-in",
  "/api/v1/auth/sign-up",
  "/api/v1/auth/sign-out",
  "/api/v1/auth/password/request-reset",
  "/api/v1/auth/password/verify-and-reset",
  "/api/v1/auth/password/reset",

  // Health check
  "/api/v1/health",
]);

/**
 * Public path prefixes for pattern matching
 * Use when exact path match is not sufficient
 */
const PUBLIC_PATH_PREFIXES: string[] = [
  // Add prefix patterns here if needed in the future
  // Example: "/public/"
];

/**
 * Check if a path is public (doesn't require authentication)
 * Uses Set lookup for O(1) performance on exact matches
 */
function isPublicPath(pathname: string): boolean {
  // Fast O(1) lookup for exact matches
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }

  // Only check prefixes if needed (empty by default)
  if (PUBLIC_PATH_PREFIXES.length > 0) {
    return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }

  return false;
}

/**
 * Middleware that initializes Supabase client for each request
 * Creates a request-specific client that handles user sessions via cookies or Authorization header
 * Supports both cookie-based auth (for web) and Bearer token auth (for API)
 *
 * Also handles authentication and redirects for protected routes
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, request, url, redirect, locals } = context;

  // Get the Cookie header from the request for parsing existing cookies
  const cookieHeader = request.headers.get("Cookie");

  // Get Authorization header for Bearer token auth (API routes)
  const authHeader = request.headers.get("Authorization");

  // Create a Supabase client tied to this specific request
  // This ensures proper session handling and cookie management
  locals.supabase = createServerClient(cookies, cookieHeader, authHeader);

  // Check if current path is public
  const pathIsPublic = isPublicPath(url.pathname);

  // Always get user session for authenticated requests
  const {
    data: { user },
  } = await locals.supabase.auth.getUser();

  // Store user in locals for easy access in pages/endpoints
  if (user) {
    locals.user = {
      id: user.id,
      email: user.email ?? undefined,
    };
  }

  // Redirect logic for protected routes
  if (!pathIsPublic && !user) {
    // Save the original URL for redirect after login
    const nextUrl = url.pathname + url.search;
    return redirect(`/auth/login?next=${encodeURIComponent(nextUrl)}`);
  }

  // Redirect logged-in users away from auth pages
  if (user && url.pathname.startsWith("/auth/")) {
    return redirect("/decks");
  }

  return next();
});
