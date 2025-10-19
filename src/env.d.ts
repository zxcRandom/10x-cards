/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db/database.types.ts';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  
  // OpenRouter Configuration
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_MODEL: string;
  readonly OPENROUTER_BASE_URL: string;
  
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
