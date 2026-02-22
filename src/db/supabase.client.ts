import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient as createSSRClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";

import type { Database } from "../db/database.types.ts";

/**
 * Get Supabase URL from environment variables
 * In Cloudflare Workers/Pages, use runtime env; in dev, use import.meta.env
 */
function getSupabaseUrl(runtimeEnv?: Record<string, unknown>): string {
  const url =
    (runtimeEnv?.SUPABASE_URL as string) ||
    (runtimeEnv?.PUBLIC_SUPABASE_URL as string) ||
    import.meta.env.SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }
  return url;
}

/**
 * Get Supabase anon key from environment variables
 * In Cloudflare Workers/Pages, use runtime env; in dev, use import.meta.env
 */
function getSupabaseAnonKey(runtimeEnv?: Record<string, unknown>): string {
  const key =
    (runtimeEnv?.SUPABASE_KEY as string) ||
    (runtimeEnv?.SUPABASE_ANON_KEY as string) ||
    (runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY as string) ||
    import.meta.env.SUPABASE_KEY ||
    import.meta.env.SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Missing Supabase anon key. Set SUPABASE_KEY, SUPABASE_ANON_KEY, or PUBLIC_SUPABASE_ANON_KEY.");
  }
  return key;
}

/**
 * Get Supabase service role key from environment variables
 * In Cloudflare Workers/Pages, use runtime env; in dev, use import.meta.env
 */
function getSupabaseServiceRoleKey(runtimeEnv?: Record<string, unknown>): string {
  const key = (runtimeEnv?.SUPABASE_SERVICE_ROLE_KEY as string) || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }
  return key;
}

export type SupabaseClient<T = Database> = ReturnType<typeof createSupabaseClient<T>>;

/**
 * Creates a Supabase client for server-side rendering with cookie and Bearer token support
 * This client is tied to the current request and handles user sessions properly
 * Uses @supabase/ssr for proper SSR cookie handling and supports Authorization header for API routes
 *
 * @param cookies - Astro cookies object from the request context
 * @param cookieHeader - Optional raw Cookie header string for parsing existing cookies
 * @param authHeader - Optional Authorization header with Bearer token (for API routes)
 * @param runtimeEnv - Optional Cloudflare runtime env for accessing secrets (required in production)
 * @returns SupabaseClient instance configured for the current request
 */
export function createServerClient(
  cookies: AstroCookies,
  cookieHeader?: string | null,
  authHeader?: string | null,
  runtimeEnv?: Record<string, unknown>
): SupabaseClient<Database> {
  // Get environment variables from runtime env (Cloudflare) or import.meta.env (dev)
  const supabaseUrl = getSupabaseUrl(runtimeEnv);
  const supabaseAnonKey = getSupabaseAnonKey(runtimeEnv);

  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Parse all cookies from the Cookie header if provided
        if (cookieHeader) {
          return parseCookieHeader(cookieHeader)
            .filter((cookie): cookie is { name: string; value: string } => cookie.value !== undefined)
            .map((cookie) => ({ name: cookie.name, value: cookie.value }));
        }
        return [];
      },
      setAll(cookiesToSet) {
        // Set cookies in Astro
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
  });
}

/**
 * Creates a Supabase admin client with service role key
 * Used for backend operations that bypass RLS (e.g. rate limiting)
 */
export function createAdminClient(runtimeEnv?: Record<string, unknown>): SupabaseClient<Database> {
  const supabaseUrl = getSupabaseUrl(runtimeEnv);
  const serviceRoleKey = getSupabaseServiceRoleKey(runtimeEnv);

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
