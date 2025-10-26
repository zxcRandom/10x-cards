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
 * Type for cookie options used in Supabase SSR
 */
export interface CookieOptions {
  name: string;
  value: string;
  options: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  };
}

/**
 * Extended Supabase client with cookie tracking
 * Used to capture cookies set during auth operations
 */
export interface SupabaseClientWithCookies extends SupabaseClient<Database> {
  __cookiesToSet?: CookieOptions[];
}

/**
 * Type guard to check if Supabase client has __cookiesToSet property
 */
export function hasCookiesToSet(client: unknown): client is SupabaseClientWithCookies {
  return (
    typeof client === "object" &&
    client !== null &&
    Array.isArray((client as SupabaseClientWithCookies).__cookiesToSet)
  );
}

/**
 * Creates a Supabase client for server-side rendering with cookie and Bearer token support
 * This client is tied to the current request and handles user sessions properly
 * Uses @supabase/ssr for proper SSR cookie handling and supports Authorization header for API routes
 *
 * @param cookies - Astro cookies object from the request context
 * @param cookieHeader - Optional raw Cookie header string for parsing existing cookies
 * @param authHeader - Optional Authorization header with Bearer token (for API routes)
 * @returns SupabaseClient instance configured for the current request along with cookies to set
 */
export function createServerClient(
  cookies: AstroCookies,
  cookieHeader?: string | null,
  authHeader?: string | null
): SupabaseClientWithCookies {
  const cookiesToSet: CookieOptions[] = [];
  
  const client = createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Parse all cookies from the Cookie header if provided
        if (cookieHeader) {
          return parseCookieHeader(cookieHeader)
            .filter((cookie): cookie is { name: string; value: string } => cookie.value !== undefined)
            .map(cookie => ({ name: cookie.name, value: cookie.value }));
        }
        return [];
      },
      setAll(cookiesToSetBatch) {
        // Store cookies for later retrieval and set them in Astro
        cookiesToSetBatch.forEach(({ name, value, options }) => {
          // Store cookies for later retrieval
          cookiesToSet.push({ name, value, options });
          // Also set in Astro cookies
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
  }) as SupabaseClientWithCookies;

  // Attach the cookies array to the client for retrieval in endpoints
  client.__cookiesToSet = cookiesToSet;

  return client;
}
