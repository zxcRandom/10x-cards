/* eslint-disable no-console */
import type { APIRoute } from "astro";
import type { HealthDTO, ErrorResponse, ErrorCode, HttpStatus } from "../../../types";

/**
 * GET /api/v1/health
 *
 * Public health check endpoint for monitoring system status and database connectivity.
 *
 * Features:
 * - No authentication required (public endpoint)
 * - Checks database connectivity with minimal query
 * - Returns current server time
 * - Fast response time (<100ms target)
 * - Logs response time for monitoring
 *
 * @returns {HealthDTO} 200 OK - System is healthy
 * @returns {ErrorResponse} 500 Internal Server Error - System health check failed
 */
export const GET: APIRoute = async ({ locals }) => {
  const startTime = Date.now();

  try {
    // Step 1: Database Connectivity Check
    // Execute minimal query to verify database connection
    const { error } = await locals.supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1);

    // If database query failed, return 500 error
    if (error) {
      console.error("Health check failed - database connectivity error:", {
        message: error.message,
        code: error.code,
        duration: Date.now() - startTime,
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_SERVER_ERROR" as ErrorCode,
          message: "Health check failed",
          details: "Database connectivity check failed",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500 as HttpStatus,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    // Step 2: Generate Response
    // Database is healthy, return success response with current time
    const healthResponse: HealthDTO = {
      status: "ok",
      time: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    console.log(`Health check completed successfully in ${duration}ms`);

    return new Response(JSON.stringify(healthResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    // Step 3: Error Handling
    // Handle any unexpected errors (network issues, unhandled exceptions, etc.)
    console.error("Health check failed - system error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime,
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "Health check failed",
        details: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
};

// Disable prerendering for API route (required for dynamic endpoints)
export const prerender = false;
