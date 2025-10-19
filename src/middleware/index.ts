import { defineMiddleware } from "astro:middleware";

import { createServerClient } from "../db/supabase.client.ts";

/**
 * Middleware that initializes Supabase client for each request
 * Creates a request-specific client that handles user sessions via cookies or Authorization header
 * Supports both cookie-based auth (for web) and Bearer token auth (for API)
 */
export const onRequest = defineMiddleware((context, next) => {
  // Get the Cookie header from the request for parsing existing cookies
  const cookieHeader = context.request.headers.get("Cookie");
  
  // Get Authorization header for Bearer token auth (API routes)
  const authHeader = context.request.headers.get("Authorization");

  // Create a Supabase client tied to this specific request
  // This ensures proper session handling and cookie management
  context.locals.supabase = createServerClient(context.cookies, cookieHeader, authHeader);

  return next();
});
