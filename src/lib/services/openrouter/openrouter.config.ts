import { z } from "zod";

export interface RetryConfig {
  attempts: number;
  backoffMs: number;
  maxDelayMs: number;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  referrer: string;
  title: string;
  defaultModel: string;
  timeoutMs: number;
  retry: RetryConfig;
  headers: Record<string, string>;
}

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigurationError";
  }
}

type EnvLike = Record<string, string | undefined>;

const envSchema = z
  .object({
    OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
    OPENROUTER_DEFAULT_MODEL: z
      .string()
      .min(1)
      .default("openrouter/anthropic/claude-3.5-sonnet"),
    OPENROUTER_BASE_URL: z
      .string()
      .url()
      .default("https://openrouter.ai/api/v1"),
    OPENROUTER_REFERRER: z
      .string()
      .url({ message: "OPENROUTER_REFERRER must be a valid URL" })
      .default("https://10x-cards.app"),
    OPENROUTER_TITLE: z.string().min(1).default("10x Cards"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    OPENROUTER_MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(3),
    OPENROUTER_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(100).default(500),
    OPENROUTER_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(1000).default(5_000),
  })
  .transform((data) => ({
    ...data,
    OPENROUTER_BASE_URL: data.OPENROUTER_BASE_URL.replace(/\/$/, ""),
  }));

export function createOpenRouterConfig(env: EnvLike = import.meta.env as EnvLike): OpenRouterConfig {
  const runtimeEnv = typeof process !== "undefined" ? process.env : undefined;

  const mergedEnv: EnvLike = {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY ?? runtimeEnv?.OPENROUTER_API_KEY,
    OPENROUTER_DEFAULT_MODEL:
      env.OPENROUTER_DEFAULT_MODEL ?? env.OPENROUTER_MODEL ?? runtimeEnv?.OPENROUTER_DEFAULT_MODEL,
    OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL ?? runtimeEnv?.OPENROUTER_BASE_URL,
    OPENROUTER_REFERRER: env.OPENROUTER_REFERRER ?? runtimeEnv?.OPENROUTER_REFERRER,
    OPENROUTER_TITLE: env.OPENROUTER_TITLE ?? runtimeEnv?.OPENROUTER_TITLE,
    AI_TIMEOUT_MS: env.AI_TIMEOUT_MS ?? runtimeEnv?.AI_TIMEOUT_MS,
    OPENROUTER_MAX_RETRIES: env.OPENROUTER_MAX_RETRIES ?? runtimeEnv?.OPENROUTER_MAX_RETRIES,
    OPENROUTER_RETRY_BASE_DELAY_MS:
      env.OPENROUTER_RETRY_BASE_DELAY_MS ?? runtimeEnv?.OPENROUTER_RETRY_BASE_DELAY_MS,
    OPENROUTER_RETRY_MAX_DELAY_MS:
      env.OPENROUTER_RETRY_MAX_DELAY_MS ?? runtimeEnv?.OPENROUTER_RETRY_MAX_DELAY_MS,
  };

  const parsed = envSchema.safeParse(mergedEnv);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new OpenRouterConfigurationError(`Invalid OpenRouter configuration: ${issues}`);
  }

  const config = parsed.data;

  return {
    apiKey: config.OPENROUTER_API_KEY,
    baseUrl: config.OPENROUTER_BASE_URL,
    referrer: config.OPENROUTER_REFERRER,
    title: config.OPENROUTER_TITLE,
    defaultModel: config.OPENROUTER_DEFAULT_MODEL,
    timeoutMs: config.AI_TIMEOUT_MS,
    retry: {
      attempts: config.OPENROUTER_MAX_RETRIES,
      backoffMs: config.OPENROUTER_RETRY_BASE_DELAY_MS,
      maxDelayMs: config.OPENROUTER_RETRY_MAX_DELAY_MS,
    },
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      "HTTP-Referer": config.OPENROUTER_REFERRER,
      "X-Title": config.OPENROUTER_TITLE,
    },
  };
}
