import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient as createSSRClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

/**
 * Global Supabase client (shared across requests)
 * Use this for server-side operations that don't require user context
 * For API routes with authentication, use createServerClient instead
 */
export const supabaseClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);

export type SupabaseClient<T = Database> = ReturnType<typeof createSupabaseClient<T>>;

/**
 * Creates a Supabase client for server-side rendering with cookie and Bearer token support
 * This client is tied to the current request and handles user sessions properly
 * Uses @supabase/ssr for proper SSR cookie handling and supports Authorization header for API routes
 *
 * @param cookies - Astro cookies object from the request context
 * @param cookieHeader - Optional raw Cookie header string for parsing existing cookies
 * @param authHeader - Optional Authorization header with Bearer token (for API routes)
 * @returns SupabaseClient instance configured for the current request
 */
export function createServerClient(
  cookies: AstroCookies,
  cookieHeader?: string | null,
  authHeader?: string | null
): SupabaseClient<Database> {
  const client = createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Parse all cookies from the Cookie header if provided
        // Filter out cookies with undefined values and ensure type compatibility
        if (cookieHeader) {
          return parseCookieHeader(cookieHeader)
            .filter((cookie): cookie is { name: string; value: string } => cookie.value !== undefined)
            .map(cookie => ({ name: cookie.name, value: cookie.value }));
        }
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: options.path ?? "/",
          });
        });
      },
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  }) as SupabaseClient<Database>;

  return client;
}
