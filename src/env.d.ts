/// <reference types="astro/client" />

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db/database.types.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;

  // OpenRouter Configuration
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_DEFAULT_MODEL?: string;
  readonly OPENROUTER_MODEL?: string; // legacy fallback until OpenRouterService integration is complete
  readonly OPENROUTER_BASE_URL?: string;
  readonly OPENROUTER_REFERRER?: string;
  readonly OPENROUTER_TITLE?: string;

  // AI Generation Limits
  readonly AI_RATE_LIMIT_PER_MINUTE: string;
  readonly AI_RATE_LIMIT_PER_DAY: string;
  readonly AI_TIMEOUT_MS: string;
  readonly AI_MAX_INPUT_LENGTH: string;
  readonly AI_DEFAULT_MAX_CARDS: string;
  readonly AI_MAX_CARDS_LIMIT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
