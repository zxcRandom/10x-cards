import type { APIRoute } from "astro";
import { z } from "zod";
import { RateLimitService } from "../../../../lib/services/rate-limit.service";
import { DeckService } from "../../../../lib/services/deck.service";
import { CardService } from "../../../../lib/services/card.service";
import { AILogService } from "../../../../lib/services/ai-log.service";
import { createAdminClient } from "../../../../db/supabase.client";
import { createOpenRouterConfig } from "../../../../lib/services/openrouter/openrouter.config";
import {
  OpenRouterService,
  type Logger,
  type RateLimiterHooks,
  type ChatRequestDTO,
  type ChatMessage,
  type ResponseFormat,
  SchemaValidationError,
  ThrottledError,
  ServiceUnavailableError,
  NetworkError,
  AuthenticationError,
  OpenRouterError,
} from "../../../../lib/services/openrouter/openrouter.service";
import {
  AIService,
  AIParsingError,
  AIRateLimitError,
  AIUnavailableError,
  AIServiceError,
} from "../../../../lib/services/ai.service";
import type {
  AIDeckResponseDTO,
  ErrorResponse,
  ValidationErrorResponse,
  UnprocessableErrorResponse,
  CardDTO,
} from "../../../../types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../db/database.types";

export const prerender = false;

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().min(1),
});

const responseFormatSchema: z.ZodType<ResponseFormat> = z.union([
  z.object({ type: z.literal("text") }),
  z.object({ type: z.literal("json_object") }),
  z.object({
    type: z.literal("json_schema"),
    json_schema: z.object({
      name: z.string().min(1),
      schema: z.unknown(),
      strict: z.boolean().optional(),
    }),
  }),
]) as z.ZodType<ResponseFormat>;

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  top_p: z.number().optional(),
  maxOutputTokens: z.number().int().optional(),
  max_output_tokens: z.number().int().optional(),
  seed: z.number().int().optional(),
  responseFormat: responseFormatSchema.optional(),
  response_format: responseFormatSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  stream: z.boolean().optional(),
});

const flashcardSchema = z.object({
  inputText: z
    .string()
    .trim()
    .min(1, "Input text is required")
    .max(20_000, "Input text must not exceed 20,000 characters"),
  deckName: z
    .string()
    .trim()
    .min(1, "Deck name must not be empty")
    .max(255, "Deck name must not exceed 255 characters")
    .optional(),
  maxCards: z.coerce
    .number()
    .int("Max cards must be an integer")
    .min(1, "Max cards must be at least 1")
    .max(100, "Max cards must not exceed 100")
    .optional(),
});

const logger: Logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.debug(`[openrouter] ${message}`, redact(meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.info(`[openrouter] ${message}`, redact(meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.warn(`[openrouter] ${message}`, redact(meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.error(`[openrouter] ${message}`, redact(meta));
  },
};

export const POST: APIRoute = async ({ request, locals }) => {
  const {
    data: { user },
    error: authError,
  } = await locals.supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      401
    );
  }

  // Instantiate services per request
  const runtimeEnv = locals.runtime?.env as Record<string, unknown> | undefined;
  const rateLimitService = new RateLimitService(
    createAdminClient(runtimeEnv),
    (runtimeEnv?.REDIS_URL as string) || import.meta.env.REDIS_URL
  );

  const rateLimiterHooks: RateLimiterHooks = {
    async check(key: string) {
      const result = await rateLimitService.checkAIRateLimit(key);
      return {
        allowed: result.allowed,
        retryAfterMs: result.allowed ? undefined : (result.resetInMs ?? 60_000),
      };
    },
    async consume(key: string) {
      await rateLimitService.incrementAIRateLimit(key);
    },
    async recordUsage(key: string, usage) {
      logger.debug("Recorded token usage", { key, usage });
    },
  };

  // Provide environment explicitly since import.meta.env might not auto-update or sync with locals
  // Priority: 1. Locally defined .env files via Vite (import.meta.env) 2. Cloudflare/Node OS envs (locals.runtime.env)
  const envVars = {
    ...(locals.runtime?.env as Record<string, string>),
    ...(import.meta.env as Record<string, string>),
  };
  
  const openRouterService = new OpenRouterService(createOpenRouterConfig(envVars), undefined, logger, rateLimiterHooks);
  const aiService = new AIService({ openRouter: openRouterService, logger });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON in request body",
        },
      },
      400
    );
  }

  if (isChatPayload(body)) {
    return handleChatCompletion(body, user.id, openRouterService);
  }

  return handleFlashcardGeneration(body, user.id, locals.supabase, rateLimitService, aiService);
};

async function handleChatCompletion(
  payload: unknown,
  userId: string,
  openRouterService: OpenRouterService
): Promise<Response> {
  const parsed = chatSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { stream, ...rest } = parsed.data;

  const chatRequest: ChatRequestDTO = {
    messages: rest.messages.map((message) => sanitizeMessage(message)),
    model: rest.model,
    temperature: rest.temperature,
    topP: rest.topP ?? rest.top_p,
    maxOutputTokens: rest.maxOutputTokens ?? rest.max_output_tokens,
    seed: rest.seed,
    responseFormat: rest.responseFormat ?? rest.response_format,
    metadata: { ...rest.metadata, feature: "chat.completions" },
    idempotencyKey: rest.idempotencyKey,
    userIdentifier: userId,
    rateLimitKey: `ai:chat:${userId}`,
  };

  if (stream) {
    const encoder = new TextEncoder();
    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of openRouterService.streamChat(chatRequest)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (error) {
          const mapped = mapOpenRouterError(error);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(mapped)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const response = await openRouterService.generateChat(chatRequest);
    return jsonResponse(response, 200);
  } catch (error) {
    const mapped = mapOpenRouterError(error);
    return jsonResponse(mapped.body, mapped.status, mapped.headers);
  }
}

async function handleFlashcardGeneration(
  payload: unknown,
  userId: string,
  supabase: SupabaseClient<Database>,
  rateLimitService: RateLimitService,
  aiService: AIService
): Promise<Response> {
  const parsed = flashcardSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const rateStatus = await rateLimitService.checkAIRateLimit(userId);
  if (!rateStatus.allowed) {
    return jsonResponse(
      {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please try again later.",
        },
      },
      429,
      {
        "Retry-After": Math.ceil((rateStatus.resetInMs ?? 60_000) / 1000).toString(),
        "X-RateLimit-Remaining": rateStatus.remaining.toString(),
      }
    );
  }

  const input = parsed.data;
  const deckName = input.deckName ?? `AI Generated Deck - ${new Date().toLocaleDateString()}`;

  const start = Date.now();
  let deckId: string | null = null;

  try {
    const cards = await aiService.generateFlashcardsFromText(input.inputText, input.maxCards);

    const deck = await DeckService.createDeck(
      userId,
      {
        name: deckName,
        createdByAi: true,
      },
      supabase
    );

    deckId = deck.id;

    let createdCards: CardDTO[] = [];
    if (cards.length > 0) {
      const cardService = new CardService(supabase);
      const batchResult = await cardService.createCardsBatch(deck.id, userId, cards);
      const batchResultValue = batchResult.toUnion();
      if ("error" in batchResultValue) {
        throw new AIServiceError(`Failed to create cards: ${batchResultValue.error}`);
      }
      createdCards = batchResultValue;
    }

    const log = await AILogService.createLog(supabase, {
      userId,
      deckId: deck.id,
      inputTextLength: input.inputText.length,
      generatedCardsCount: createdCards.length,
      errorMessage: null,
    });

    await rateLimitService.incrementAIRateLimit(userId);

    const duration = Date.now() - start;

    const response: AIDeckResponseDTO = {
      deck,
      cards: createdCards.map((card: CardDTO) => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
      })),
      log,
    };

    return jsonResponse(response, 201, {
      "X-Request-Duration": duration.toString(),
      "X-RateLimit-Remaining": Math.max(0, rateStatus.remaining - 1).toString(),
    });
  } catch (error) {
    await logFailure(supabase, {
      userId,
      deckId,
      inputLength: input.inputText.length,
      error,
    });

    if (error instanceof AIParsingError) {
      return jsonResponse(
        {
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Failed to parse AI response",
            details: import.meta.env.DEV ? error.message : undefined,
          },
        } satisfies UnprocessableErrorResponse,
        422
      );
    }

    if (error instanceof AIRateLimitError || error instanceof ThrottledError) {
      return jsonResponse(
        {
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "AI rate limit exceeded. Please wait before trying again.",
            details: error.message,
          },
        } satisfies ErrorResponse,
        429
      );
    }

    if (error instanceof AIUnavailableError || error instanceof ServiceUnavailableError) {
      return jsonResponse(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "AI service is temporarily unavailable",
          },
        } satisfies ErrorResponse,
        503
      );
    }

    if (error instanceof AIServiceError) {
      return jsonResponse(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            details: import.meta.env.DEV ? String(error.cause ?? "") : undefined,
          },
        } satisfies ErrorResponse,
        500
      );
    }

    // eslint-disable-next-line no-console
    console.error("Failed to generate deck via OpenRouter", error);
    return jsonResponse(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate deck from text",
        },
      } satisfies ErrorResponse,
      500
    );
  }
}

function isChatPayload(value: unknown): value is z.infer<typeof chatSchema> {
  return typeof value === "object" && value !== null && Array.isArray((value as { messages?: unknown }).messages);
}

function sanitizeMessage(message: z.infer<typeof messageSchema>): ChatMessage {
  return {
    role: message.role,
    content: message.content.trim(),
  };
}

function mapOpenRouterError(error: unknown): {
  status: number;
  body: ErrorResponse;
  headers?: HeadersInit;
} {
  if (error instanceof SchemaValidationError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: JSON.stringify(error.details ?? {}),
        },
      },
    };
  }

  if (error instanceof ThrottledError) {
    return {
      status: 429,
      headers: error.retryAfterMs ? { "Retry-After": Math.ceil(error.retryAfterMs / 1000).toString() } : undefined,
      body: {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: error.message,
        },
      },
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "OpenRouter authentication failed",
        },
      },
    };
  }

  if (error instanceof NetworkError) {
    return {
      status: 504,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "OpenRouter request was interrupted",
        },
      },
    };
  }

  if (error instanceof ServiceUnavailableError) {
    return {
      status: 503,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "OpenRouter service is unavailable",
        },
      },
    };
  }

  if (error instanceof OpenRouterError) {
    return {
      status: error.status ?? 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected OpenRouter error",
      },
    },
  };
}

function validationError(issues: z.ZodIssue[]): Response {
  return jsonResponse(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        errors: issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    } satisfies ValidationErrorResponse,
    400
  );
}

function jsonResponse(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function redact(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  const clone = { ...meta };
  // Temporarily show full payload for debugging
  // if (clone.messages) {
  //   clone.messages = "[redacted]";
  // }
  // if (clone.payload) {
  //   clone.payload = "[redacted]";
  // }
  return clone;
}

async function logFailure(
  supabase: SupabaseClient<Database>,
  params: { userId: string; deckId: string | null; inputLength: number; error: unknown }
): Promise<void> {
  try {
    await AILogService.createLog(supabase, {
      userId: params.userId,
      deckId: params.deckId,
      inputTextLength: params.inputLength,
      generatedCardsCount: 0,
      errorMessage: params.error instanceof Error ? params.error.message : "Unknown error",
    });
  } catch (logError) {
    // eslint-disable-next-line no-console
    console.error("Failed to record AI generation failure log", logError);
  }
}
