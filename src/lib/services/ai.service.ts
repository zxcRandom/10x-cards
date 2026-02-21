import { z } from "zod";
import { createOpenRouterConfig } from "./openrouter/openrouter.config";
import {
  OpenRouterService,
  OpenRouterError,
  SchemaValidationError,
  ThrottledError,
  ServiceUnavailableError,
  NetworkError,
} from "./openrouter/openrouter.service";
import type { ResponseFormat, ChatRequestDTO, ChatMessage } from "./openrouter/openrouter.service";
import { ConsoleLogger, type Logger } from "./logger.service";

export interface GeneratedCard {
  question: string;
  answer: string;
  hint?: string;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export class AIParsingError extends AIServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AIParsingError";
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AIRateLimitError";
  }
}

export class AIUnavailableError extends AIServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AIUnavailableError";
  }
}

interface Dependencies {
  openRouter?: OpenRouterService;
  logger?: Logger;
  responseFormat?: ResponseFormat;
}

const defaultLogger = new ConsoleLogger(sanitizeMeta);

const flashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().optional(),
});

const flashcardBatchSchema = z.object({
  cards: z.array(flashcardSchema).max(100),
});

const defaultResponseFormat: ResponseFormat = {
  type: "json_object",
};

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  const redacted = { ...meta };

  if (redacted.messages) {
    redacted.messages = "[redacted]";
  }

  return redacted;
}

export class AIService {
  private readonly openRouter: OpenRouterService;
  private readonly logger: Logger;
  private readonly responseFormat: ResponseFormat;
  private readonly maxInputLength: number;
  private readonly defaultMaxCards: number;
  private readonly maxCardsLimit: number;

  constructor({ openRouter, logger, responseFormat }: Dependencies = {}) {
    this.logger = logger ?? defaultLogger;

    this.openRouter = openRouter ?? new OpenRouterService(createOpenRouterConfig(), undefined, this.logger);

    this.responseFormat = responseFormat ?? defaultResponseFormat;

    this.maxInputLength = Number.parseInt(import.meta.env.AI_MAX_INPUT_LENGTH ?? "20000", 10);
    this.defaultMaxCards = Number.parseInt(import.meta.env.AI_DEFAULT_MAX_CARDS ?? "20", 10);
    this.maxCardsLimit = Number.parseInt(import.meta.env.AI_MAX_CARDS_LIMIT ?? "50", 10);
  }

  async generateFlashcardsFromText(inputText: string, requestedMaxCards?: number): Promise<GeneratedCard[]> {
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    const maxCards = this.resolveMaxCards(requestedMaxCards);
    const sanitizedInput = this.sanitizeInput(inputText);

    const request = this.buildChatRequest(sanitizedInput, maxCards);

    try {
      const response = await this.openRouter.generateChat(request);
      const cards = this.parseFlashcardsResponse(response.message.content);

      const end = typeof performance !== "undefined" ? performance.now() : Date.now();
      this.logger.info("AI flashcard generation completed", {
        durationMs: Math.round(end - start),
        cardCount: cards.length,
      });

      return cards.slice(0, maxCards);
    } catch (error) {
      this.logger.error("AI flashcard generation failed", { error: error instanceof Error ? error.message : error });
      throw this.mapError(error);
    }
  }

  private resolveMaxCards(requestedMaxCards?: number): number {
    const candidate = requestedMaxCards ?? this.defaultMaxCards;
    return Math.max(1, Math.min(candidate, this.maxCardsLimit));
  }

  private sanitizeInput(text: string): string {
    return text.replace(/[<>]/g, "").slice(0, this.maxInputLength);
  }

  private buildChatRequest(input: string, maxCards: number): ChatRequestDTO {
    return {
      messages: this.buildMessages(input, maxCards),
      responseFormat: this.responseFormat,
      maxOutputTokens: 1200,
      metadata: {
        purpose: "flashcard-generation",
        maxCards,
      },
    } satisfies ChatRequestDTO;
  }

  private buildMessages(input: string, maxCards: number): ChatMessage[] {
    return [
      {
        role: "system" as const,
        content: "You are a concise flashcard generator for STEM topics.",
      },
      {
        role: "user" as const,
        content: this.buildUserPrompt(input, maxCards),
      },
    ];
  }

  private buildUserPrompt(input: string, maxCards: number): string {
    return `Generate up to ${maxCards} high-quality flashcards from the following text.

IMPORTANT: Return ONLY a valid JSON object in this exact format:
{
  "cards": [
    {
      "question": "string (1-500 chars)",
      "answer": "string (1-2000 chars)",
      "hint": "string (optional, 1-500 chars)"
    }
  ]
}

Rules:
- Each card MUST have "question" and "answer" fields
- "hint" is optional
- Return at least 1 card, maximum ${maxCards} cards
- Do not include any text before or after the JSON

Text to analyze:
"""
${input}
"""`;
  }

  private parseFlashcardsResponse(content: string): GeneratedCard[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new AIParsingError("Failed to parse AI response as JSON", error);
    }

    const validation = flashcardBatchSchema.safeParse(parsed);
    if (!validation.success) {
      throw new AIParsingError("AI response did not match expected schema", validation.error);
    }

    return validation.data.cards.map((card) => ({
      question: card.question.trim(),
      answer: card.answer.trim(),
      hint: card.hint?.trim() || undefined,
    }));
  }

  private mapError(error: unknown): AIServiceError {
    if (error instanceof AIServiceError) {
      return error;
    }

    if (error instanceof ThrottledError) {
      return new AIRateLimitError("AI rate limit exceeded. Please wait before trying again.", error);
    }

    if (error instanceof SchemaValidationError) {
      return new AIParsingError("AI response validation failed", error);
    }

    if (error instanceof NetworkError) {
      return new AIUnavailableError("AI request was interrupted", error);
    }

    if (error instanceof ServiceUnavailableError) {
      return new AIUnavailableError("AI service is temporarily unavailable", error);
    }

    if (error instanceof OpenRouterError) {
      return new AIServiceError(error.message, error);
    }

    if (error instanceof Error) {
      return new AIServiceError(error.message, error);
    }

    return new AIServiceError("Unknown AI error", error);
  }
}

export const aiService = new AIService();
