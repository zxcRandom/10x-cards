import type { APIRoute } from "astro";
import { AILogService } from "@/lib/services/ai-log.service";
import { GetAILogsQuerySchema } from "./index.schema";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import type { ErrorResponse, AILogsListDTO } from "@/types";

/**
 * GET /api/v1/ai/logs
 * List AI generation logs for the authenticated user
 */
export const GET: APIRoute = async ({ locals, url }) => {
  // STEP 1: Verify authentication
  const session = await locals.supabase.auth.getSession();
  const user = session.data.session?.user;

  if (!user) {
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

  // STEP 2: Parse and validate query parameters
  const queryParams = Object.fromEntries(url.searchParams);
  const parsed = GetAILogsQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
        },
        errors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const validated = parsed.data;

  // STEP 3: Fetch logs from database
  try {
    const result = await AILogService.listLogs(locals.supabase, user.id, {
      deckId: validated.deckId,
      from: validated.from,
      to: validated.to,
      limit: validated.limit,
      offset: validated.offset,
      sort: validated.sort,
      order: validated.order,
    });

    if ("error" in result) {
      console.error(`Failed to fetch AI logs for user ${user.id}:`, result.error);
      return new Response(
        JSON.stringify({
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to fetch AI generation logs",
          },
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // STEP 4: Return logs list
    const response: AILogsListDTO = {
      items: result.items,
      total: result.total,
      limit: validated.limit,
      offset: validated.offset,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching AI logs:", error);
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
