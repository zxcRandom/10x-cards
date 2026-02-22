import { z } from "zod";
import type { Logger } from "../logger.service";
export type { Logger };
import type { OpenRouterConfig } from "./openrouter.config";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface JsonObjectResponseFormat {
  type: "json_object";
}

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: unknown;
    strict?: boolean;
  };
}

export interface TextResponseFormat {
  type: "text";
}

export type ResponseFormat = JsonObjectResponseFormat | JsonSchemaResponseFormat | TextResponseFormat;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponseDTO {
  id: string;
  model: string;
  created: number;
  message: ChatMessage;
  finishReason?: string | null;
  usage?: TokenUsage;
  raw: unknown;
}

export interface ChatStreamChunk {
  type: "content" | "usage" | "event";
  content?: string;
  usage?: TokenUsage;
  event?: string;
  done?: boolean;
}

export interface ChatDefaults {
  model: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseFormat?: ResponseFormat;
  seed?: number;
}

export interface ChatRequestDTO {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  seed?: number;
  responseFormat?: ResponseFormat;
  /** @deprecated use topP */
  top_p?: number;
  /** @deprecated use maxOutputTokens */
  max_output_tokens?: number;
  /** @deprecated use responseFormat */
  response_format?: ResponseFormat;
  userIdentifier?: string;
  rateLimitKey?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  abortSignal?: AbortSignal;
}

export type OpenRouterErrorCode = "configuration" | "auth" | "throttled" | "quota" | "upstream" | "schema" | "network";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code: OpenRouterErrorCode,
    public readonly options: {
      cause?: unknown;
      status?: number;
      retryAfterMs?: number;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = "OpenRouterError";
  }

  get status(): number | undefined {
    return this.options.status;
  }

  get retryAfterMs(): number | undefined {
    return this.options.retryAfterMs;
  }

  get details(): Record<string, unknown> | undefined {
    return this.options.details;
  }
}

export class AuthenticationError extends OpenRouterError {
  constructor(message: string, cause?: unknown) {
    super(message, "auth", { cause });
    this.name = "AuthenticationError";
  }
}

export class ThrottledError extends OpenRouterError {
  constructor(message: string, retryAfterMs?: number, cause?: unknown) {
    super(message, "throttled", { retryAfterMs, cause });
    this.name = "ThrottledError";
  }
}

export class ServiceUnavailableError extends OpenRouterError {
  constructor(message: string, cause?: unknown) {
    super(message, "upstream", { cause });
    this.name = "ServiceUnavailableError";
  }
}

export class SchemaValidationError extends OpenRouterError {
  constructor(message: string, details: Record<string, unknown>, cause?: unknown) {
    super(message, "schema", { cause, details });
    this.name = "SchemaValidationError";
  }
}

export class NetworkError extends OpenRouterError {
  constructor(message: string, cause?: unknown) {
    super(message, "network", { cause });
    this.name = "NetworkError";
  }
}

export class ConfigurationError extends OpenRouterError {
  constructor(message: string, cause?: unknown) {
    super(message, "configuration", { cause });
    this.name = "ConfigurationError";
  }
}

export interface RateLimiterHooks {
  check?(key: string): Promise<{ allowed: boolean; retryAfterMs?: number }>;
  consume?(key: string): Promise<void>;
  scheduleRetry?(key: string, retryAfterMs: number): Promise<void>;
  recordUsage?(key: string, usage: TokenUsage): Promise<void>;
}

interface NormalizedChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  seed?: number;
  responseFormat?: ResponseFormat;
  userIdentifier?: string;
  rateLimitKey?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

interface OpenRouterPayload {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  seed?: number;
  response_format?: ResponseFormat;
  stream?: boolean;
}

type FetchImplementation = typeof fetch;

interface ErrorContext {
  operation: "generate" | "stream" | "fetch";
  attempt?: number;
  status?: number;
  payload?: Partial<OpenRouterPayload>;
}

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().min(1),
});

const responseFormatSchema = z.union([
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
]);

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: z.string().min(1).optional(),
  temperature: z
    .number()
    .transform((value) => Number(value))
    .optional(),
  topP: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
  responseFormat: responseFormatSchema.optional(),
  response_format: responseFormatSchema.optional(),
  userIdentifier: z.string().min(1).optional(),
  rateLimitKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

const openRouterResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  created: z.number(),
  choices: z
    .array(
      z.object({
        index: z.number().optional(),
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          role: z.literal("assistant"),
          content: z.union([z.string(), z.array(z.object({ type: z.string(), text: z.string().optional() }))]),
        }),
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

const streamChoiceSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().optional() }),
        finish_reason: z.string().nullable().optional(),
      })
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

const defaultLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export class OpenRouterService {
  public readonly defaults: Readonly<ChatDefaults>;

  constructor(
    private readonly config: OpenRouterConfig,
    private readonly httpClient: FetchImplementation = globalThis.fetch.bind(globalThis),
    private readonly logger: Logger = defaultLogger,
    private readonly rateLimiter?: RateLimiterHooks,
    defaults?: Partial<ChatDefaults>
  ) {
    if (!config?.apiKey) {
      if (import.meta.env.DEV || import.meta.env.MODE === "test") {
        this.logger.warn("OpenRouter API key is missing. Mock responses will be used.");
      } else {
        throw new ConfigurationError("Missing OpenRouter API key");
      }
    }

    if (!this.httpClient) {
      throw new ConfigurationError("Fetch implementation is not available");
    }

    const mergedDefaults: ChatDefaults = {
      model: defaults?.model ?? config.defaultModel,
      temperature: defaults?.temperature ?? 0.4,
      topP: defaults?.topP ?? 0.9,
      maxOutputTokens: defaults?.maxOutputTokens ?? 1_200,
      responseFormat: defaults?.responseFormat,
      seed: defaults?.seed,
    };

    this.defaults = Object.freeze(mergedDefaults);
  }

  withOverrides(overrides: Partial<ChatDefaults>): OpenRouterService {
    return new OpenRouterService(this.config, this.httpClient, this.logger, this.rateLimiter, {
      ...this.defaults,
      ...overrides,
    });
  }

  async generateChat(request: ChatRequestDTO): Promise<ChatResponseDTO> {
    const { abortSignal, ...rest } = request;
    const normalized = this.normalizeRequest(rest);
    const payload = this.buildPayload(normalized);

    const rateLimitKey = normalized.rateLimitKey ?? normalized.userIdentifier;

    await this.enforceRateLimit(rateLimitKey);

    try {
      if (!this.config.apiKey && (import.meta.env.DEV || import.meta.env.MODE === "test")) {
        this.logger.info("Using mock OpenRouter response (missing API key)");
        return this.getMockResponse(payload);
      }

      const response = await this.executeFetch(payload, abortSignal, rateLimitKey);
      const parsed = await this.parseResponse(response);

      if (parsed.usage && rateLimitKey) {
        await this.rateLimiter?.recordUsage?.(rateLimitKey, parsed.usage);
      }

      return parsed;
    } catch (error) {
      this.logger.error("OpenRouter request failed", { error });
      throw this.mapError(error, { operation: "generate", payload });
    }
  }

  async *streamChat(request: ChatRequestDTO): AsyncGenerator<ChatStreamChunk> {
    const { abortSignal, ...rest } = request;
    const normalized = this.normalizeRequest(rest);
    const payload = { ...this.buildPayload(normalized), stream: true };
    const rateLimitKey = normalized.rateLimitKey ?? normalized.userIdentifier;

    await this.enforceRateLimit(rateLimitKey);

    let response: Response | undefined;

    try {
      response = await this.executeFetch(payload, abortSignal, rateLimitKey);
    } catch (error) {
      throw this.mapError(error, { operation: "stream", payload });
    }

    try {
      for await (const chunk of this.handleStream(response)) {
        if (chunk.usage && rateLimitKey) {
          await this.rateLimiter?.recordUsage?.(rateLimitKey, chunk.usage);
        }
        yield chunk;
      }
    } catch (error) {
      throw this.mapError(error, { operation: "stream", payload });
    }
  }

  private normalizeRequest(request: Omit<ChatRequestDTO, "abortSignal">): NormalizedChatRequest {
    const parsed = chatRequestSchema.safeParse(request);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
      this.logger.warn("Invalid OpenRouter request", { issues: details });
      throw new SchemaValidationError("Invalid chat request", { issues: details });
    }

    const data = parsed.data;

    const responseFormatInput = data.responseFormat ?? data.response_format;
    if (responseFormatInput?.type === "json_schema" && responseFormatInput.json_schema.schema === undefined) {
      throw new SchemaValidationError("responseFormat.json_schema.schema is required", {
        field: "responseFormat.json_schema.schema",
      });
    }

    return {
      messages: data.messages.map((message) => ({
        role: message.role,
        content: message.content.trim(),
      })),
      model: data.model,
      temperature: data.temperature,
      topP: data.topP ?? data.top_p,
      maxOutputTokens: data.maxOutputTokens ?? data.max_output_tokens,
      seed: data.seed,
      responseFormat: responseFormatInput as ResponseFormat | undefined,
      userIdentifier: data.userIdentifier,
      rateLimitKey: data.rateLimitKey,
      metadata: data.metadata,
      idempotencyKey: data.idempotencyKey,
    };
  }

  private buildPayload(request: NormalizedChatRequest): OpenRouterPayload {
    const payload: OpenRouterPayload = {
      model: request.model ?? this.defaults.model,
      messages: request.messages,
    };

    const temperature = request.temperature ?? this.defaults.temperature;
    if (typeof temperature === "number") {
      payload.temperature = temperature;
    }

    const topP = request.topP ?? this.defaults.topP;
    if (typeof topP === "number") {
      payload.top_p = topP;
    }

    const maxOutputTokens = request.maxOutputTokens ?? this.defaults.maxOutputTokens;
    if (typeof maxOutputTokens === "number") {
      payload.max_output_tokens = maxOutputTokens;
    }

    const seed = request.seed ?? this.defaults.seed;
    if (typeof seed === "number") {
      payload.seed = seed;
    }

    const responseFormat = request.responseFormat ?? this.defaults.responseFormat;
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    return payload;
  }

  private async enforceRateLimit(rateLimitKey?: string): Promise<void> {
    if (!rateLimitKey || !this.rateLimiter?.check) {
      return;
    }

    const result = await this.rateLimiter.check(rateLimitKey);
    if (!result.allowed) {
      const retryAfterMs = result.retryAfterMs ?? 0;
      await this.rateLimiter.scheduleRetry?.(rateLimitKey, retryAfterMs);
      throw new ThrottledError("Rate limit exceeded", retryAfterMs);
    }

    await this.rateLimiter.consume?.(rateLimitKey);
  }

  private async executeFetch(
    payload: OpenRouterPayload,
    abortSignal?: AbortSignal,
    rateLimitKey?: string
  ): Promise<Response> {
    const attempts = Math.max(1, this.config.retry.attempts);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const handleAbort = (): void =>
        controller.abort(abortSignal?.reason ?? new DOMException("Aborted", "AbortError"));
      const timeoutId = setTimeout(
        () => controller.abort(new DOMException("Timeout", "AbortError")),
        this.config.timeoutMs
      );

      if (abortSignal) {
        if (abortSignal.aborted) {
          handleAbort();
        } else {
          abortSignal.addEventListener("abort", handleAbort, { once: true });
        }
      }

      try {
        // DEBUG: Log the payload being sent
        const apiKeyHint = this.config.apiKey ? `${this.config.apiKey.substring(0, 15)}...` : "missing";
        this.logger.debug("Sending request to OpenRouter", {
          url: `${this.config.baseUrl}/chat/completions`,
          apiKeyHint,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          headers: (({ Authorization: _Authorization, ...rest }) => rest)(
            this.config.headers as Record<string, string>
          ),
        });

        const response = await this.httpClient(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.config.headers,
            ...(payload.stream ? { Accept: "text/event-stream" } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 401 || response.status === 403) {
          const errorBody = await safeParseBody(response);
          this.logger.error("OpenRouter authentication failed", { status: response.status, body: errorBody });
          throw new AuthenticationError("OpenRouter authentication failed", errorBody);
        }

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          if (rateLimitKey) {
            await this.rateLimiter?.scheduleRetry?.(rateLimitKey, retryAfterMs ?? 0);
          }
          throw new ThrottledError("OpenRouter rate limit exceeded", retryAfterMs, await safeParseBody(response));
        }

        if (response.status === 400) {
          const errorBody = await safeParseBody(response);
          this.logger.error("OpenRouter rejected payload (400)", {
            status: response.status,
            errorBody,
            sentPayload: payload,
          });
          throw new SchemaValidationError(
            "OpenRouter rejected the payload",
            { status: response.status, errorBody },
            errorBody
          );
        }

        if (response.status >= 500 && response.status < 600) {
          lastError = new ServiceUnavailableError(
            `OpenRouter upstream error: ${response.status}`,
            await safeParseBody(response)
          );
        } else {
          lastError = new OpenRouterError("Unexpected OpenRouter response", "upstream", {
            status: response.status,
            cause: await safeParseBody(response),
          });
        }
      } catch (error) {
        if (error instanceof OpenRouterError) {
          if (error.code === "throttled" || error.code === "schema" || error.code === "auth") {
            throw error;
          }
          lastError = error;
        } else if (error instanceof DOMException && error.name === "AbortError") {
          const abortError = new NetworkError("OpenRouter request was aborted", error);
          lastError = abortError;
        } else {
          lastError = new NetworkError("Failed to reach OpenRouter", error);
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortSignal) {
          abortSignal.removeEventListener("abort", handleAbort);
        }
      }

      if (attempt < attempts) {
        const delay = Math.min(this.config.retry.backoffMs * Math.pow(2, attempt - 1), this.config.retry.maxDelayMs);
        this.logger.warn("OpenRouter request failed, retrying", { attempt, delay });
        await delayMs(delay);
        continue;
      }
    }

    throw this.mapError(lastError, { operation: "fetch", payload });
  }

  private async parseResponse(response: Response): Promise<ChatResponseDTO> {
    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      throw new SchemaValidationError("Failed to parse OpenRouter response JSON", { body }, error);
    }

    const parsed = openRouterResponseSchema.safeParse(body);

    if (!parsed.success) {
      throw new SchemaValidationError("OpenRouter response failed validation", {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }

    const { id, model, created, choices, usage } = parsed.data;
    const primaryChoice = choices[0];

    const content = normalizeAssistantContent(primaryChoice.message.content);

    const dto: ChatResponseDTO = {
      id,
      model,
      created,
      message: { role: "assistant", content },
      finishReason: primaryChoice.finish_reason ?? null,
      raw: body,
    };

    if (usage) {
      dto.usage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };
    }

    return dto;
  }

  private async *handleStream(response: Response): AsyncGenerator<ChatStreamChunk> {
    if (!response.body) {
      throw new ServiceUnavailableError("OpenRouter response does not contain a stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (trimmed === "data: [DONE]" || trimmed === "[DONE]") {
          yield { type: "event", event: "done", done: true };
          return;
        }

        const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          this.logger.warn("Failed to parse OpenRouter stream chunk", { payload });
          continue;
        }

        const validation = streamChoiceSchema.safeParse(parsed);
        if (!validation.success) {
          this.logger.warn("Skipping invalid OpenRouter stream chunk", {
            issues: validation.error.issues.map((issue) => issue.message),
          });
          continue;
        }

        const chunk = validation.data;

        if (chunk.choices) {
          for (const choice of chunk.choices) {
            if (choice.delta.content) {
              yield { type: "content", content: choice.delta.content };
            }
            if (choice.finish_reason) {
              yield { type: "event", event: choice.finish_reason };
            }
          }
        }

        if (chunk.usage) {
          yield {
            type: "usage",
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      }
    }

    if (buffer.trim()) {
      this.logger.debug("Remaining buffer after stream", { buffer });
    }

    yield { type: "event", event: "end", done: true };
  }

  private mapError(error: unknown, context: ErrorContext): OpenRouterError {
    if (error instanceof OpenRouterError) {
      return error;
    }

    if (error instanceof z.ZodError) {
      return new SchemaValidationError("Schema validation failed", {
        issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return new NetworkError("OpenRouter request aborted", error);
    }

    if (error instanceof Error) {
      return new ServiceUnavailableError(error.message, error);
    }

    return new ServiceUnavailableError("Unexpected OpenRouter error", { error, context });
  }

  private getMockResponse(payload: OpenRouterPayload): ChatResponseDTO {
    const isFlashcardRequest =
      payload.messages.some((m) => m.content.includes("flashcard")) ||
      payload.response_format?.type === "json_object" ||
      payload.response_format?.type === "json_schema";

    let content = "This is a mock response from OpenRouter.";

    if (isFlashcardRequest) {
      content = JSON.stringify({
        cards: [
          {
            question: "Co to jest 10x Cards?",
            answer: "Aplikacja do nauki z wykorzystaniem AI.",
            hint: "AI",
          },
          {
            question: "Jak działa generowanie fiszek?",
            answer: "AI analizuje tekst i tworzy pytania oraz odpowiedzi.",
            hint: "Analiza",
          },
        ],
      });
    }

    return {
      id: `mock-${Date.now()}`,
      model: payload.model,
      created: Math.floor(Date.now() / 1000),
      message: {
        role: "assistant",
        content,
      },
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      raw: { mock: true },
    };
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

async function safeParseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAssistantContent(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function delayMs(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
