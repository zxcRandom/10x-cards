import type { APIRoute } from "astro";
import { z } from "zod";
import { createAIDeckSchema } from "./from-text.schema";
import { aiService, AIServiceError, AITimeoutError, AIParsingError } from "../../../../../lib/services/ai.service";
import type { ErrorResponse, ValidationErrorResponse, UnprocessableErrorResponse } from "../../../../../types";

/**
 * POST /api/v1/ai/decks/from-text
 * Generate deck and cards from text using AI
 *
 * TEMPORARY IMPLEMENTATION - Only tests AI service
 * TODO: Add database services, rate limiting, full error handling
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  try {
    // STEP 1: Authentication (basic check)
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

    // STEP 2: Parse and validate request body
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

    // STEP 3: Test AI Service (TEMPORARY - no database yet)
    console.log(`🧪 Testing AI generation for user ${user.id}, maxCards: ${validated.maxCards}`);

    const generatedCards = await aiService.generateFlashcardsFromText(validated.inputText, validated.maxCards);

    const duration = Date.now() - startTime;
    console.log(`✅ AI generation test completed in ${duration}ms`);

    // STEP 4: Return test response (TEMPORARY)
    return new Response(
      JSON.stringify({
        message: "AI Service test successful!",
        deckName: validated.deckName || "Test Deck",
        generatedCardsCount: generatedCards.length,
        cards: generatedCards,
        duration: `${duration}ms`,
        note: "This is a temporary test response. Database integration pending.",
      }),
      {
        status: 200, // 200 for test, will be 201 when fully implemented
        headers: {
          "Content-Type": "application/json",
          "X-Request-Duration": duration.toString(),
        },
      }
    );
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

    if (error instanceof AITimeoutError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "AI request timed out",
            details: "Please try again with shorter input text or fewer cards",
          },
        } satisfies ErrorResponse),
        {
          status: 500,
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
