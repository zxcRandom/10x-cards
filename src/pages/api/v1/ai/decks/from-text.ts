import type { APIRoute } from "astro";
import { z } from "zod";
import { createAIDeckSchema } from "./from-text.schema";
import { aiService, AIServiceError, AIParsingError } from "../../../../../lib/services/ai.service";
import { DeckService } from "../../../../../lib/services/deck.service";
import { CardService } from "../../../../../lib/services/card.service";
import { AILogService } from "../../../../../lib/services/ai-log.service";
import { RateLimitService } from "../../../../../lib/services/rate-limit.service";
import type { 
  AIDeckResponseDTO,
  ErrorResponse, 
  ValidationErrorResponse, 
  UnprocessableErrorResponse 
} from "../../../../../types";

/**
 * POST /api/v1/ai/decks/from-text
 * Generate deck and cards from text using AI
 *
 * Full implementation with:
 * - Rate limiting (10 req/min)
 * - Database integration (deck + cards + log)
 * - Error recovery with logging
 * - Comprehensive error handling
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  try {
    // STEP 1: Authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        } satisfies ErrorResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // STEP 2: Rate limiting
    const rateLimitService = new RateLimitService();
    const rateLimit = await rateLimitService.checkAIRateLimit(user.id);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded. Please try again later.",
          },
        } satisfies ErrorResponse),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        }
      );
    }

    // STEP 3: Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: "BAD_REQUEST",
            message: "Invalid JSON in request body",
          },
        } satisfies ErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let validated;
    try {
      validated = createAIDeckSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              errors: error.errors.map((e) => ({
                field: e.path.join("."),
                message: e.message,
              })),
            },
          } satisfies ValidationErrorResponse),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // STEP 4: Generate cards using AI
    console.log(`� AI generation for user ${user.id}, maxCards: ${validated.maxCards}`);

    const generatedCards = await aiService.generateFlashcardsFromText(
      validated.inputText,
      validated.maxCards
    );

    // STEP 5: Create deck and cards in database
    let deckId: string | null = null;
    let cards: any[] = [];

    try {
      // Create deck
      const deckName =
        validated.deckName || `AI Generated Deck - ${new Date().toLocaleDateString()}`;

      const deckResult = await DeckService.createDeck(
        user.id,
        { name: deckName, createdByAi: true },
        locals.supabase
      );

      deckId = deckResult.id;

      // Create cards in batch
      if (generatedCards.length > 0) {
        const cardsResult = await CardService.createCardsBatch(
          locals.supabase,
          deckId,
          user.id,
          generatedCards
        );

        if ("error" in cardsResult) {
          throw new Error(`Failed to create cards: ${cardsResult.error}`);
        }

        cards = cardsResult;
      }

      // Create success log
      const log = await AILogService.createLog(locals.supabase, {
        userId: user.id,
        deckId: deckId,
        inputTextLength: validated.inputText.length,
        generatedCardsCount: generatedCards.length,
        errorMessage: null,
      });

      // Increment rate limit
      await rateLimitService.incrementAIRateLimit(user.id);

      const duration = Date.now() - startTime;
      console.log(`✅ AI generation completed in ${duration}ms: ${cards.length} cards created`);

      // STEP 6: Return success response
      const response: AIDeckResponseDTO = {
        deck: deckResult,
        cards: cards.map((card) => ({
          id: card.id,
          question: card.question,
          answer: card.answer,
        })),
        log: log,
      };

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Duration": duration.toString(),
          "X-RateLimit-Remaining": (rateLimit.remaining - 1).toString(),
        },
      });
    } catch (dbError) {
      console.error("Database operation failed:", dbError);

      // Log the failed attempt
      try {
        await AILogService.createLog(locals.supabase, {
          userId: user.id,
          deckId: deckId,
          inputTextLength: validated.inputText.length,
          generatedCardsCount: 0,
          errorMessage:
            dbError instanceof Error ? dbError.message : "Unknown database error",
        });
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }

      throw new Error("Failed to save generated content to database");
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ AI test failed after ${duration}ms:`, error);

    // Handle specific error types
    if (error instanceof AIParsingError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Failed to parse AI response",
            details: import.meta.env.DEV ? error.message : undefined,
          },
        } satisfies UnprocessableErrorResponse),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof AIServiceError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate deck from text",
            details: import.meta.env.DEV ? error.message : "AI service temporarily unavailable",
          },
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Generic error handler
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate deck from text",
          details: import.meta.env.DEV && error instanceof Error ? error.message : undefined,
        },
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// Disable prerendering for API route
export const prerender = false;
