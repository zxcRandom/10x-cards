import { describe, it, expect } from "vitest";
import { getAIErrorMessage } from "../ai-error-mapper";

describe("getAIErrorMessage", () => {
  it("should return validation error message for 400", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
        },
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Invalid input");
  });

  it("should return default validation error message for 400 without message", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
        },
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Błąd walidacji danych");
  });

  it("should return correct message for 401", async () => {
    const response = new Response(JSON.stringify({}), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Wymagane zalogowanie");
  });

  it("should return correct message for 422", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "UNPROCESSABLE_ENTITY",
          message: "Processing failed",
        },
      }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Processing failed");
  });

  it("should return default message for 422 without message", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "UNPROCESSABLE_ENTITY",
        },
      }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Nie udało się przetworzyć odpowiedzi AI. Spróbuj skrócić tekst lub zmniejszyć liczbę kart.");
  });

  it("should return correct message for 429", async () => {
    const response = new Response(JSON.stringify({}), {
      status: 429,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Przekroczono limit żądań. Spróbuj ponownie później.");
  });

  it("should return correct message for 503", async () => {
    const response = new Response(JSON.stringify({}), {
      status: 503,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.");
  });

  it("should return correct message for 500", async () => {
    const response = new Response(JSON.stringify({}), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Wystąpił błąd serwera. Spróbuj ponownie później.");
  });

  it("should return correct message for 500 with TOO_MANY_REQUESTS code", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "TOO_MANY_REQUESTS",
        },
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Limit zapytań do usługi AI został osiągnięty. Spróbuj ponownie później.");
  });

  it("should return default generic error message", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          message: "Something went wrong",
        },
      }),
      {
        status: 418, // I'm a teapot
        headers: { "content-type": "application/json" },
      }
    );

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Something went wrong");
  });

  it("should return fallback generic error message", async () => {
    const response = new Response(JSON.stringify({}), {
      status: 418,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Wystąpił nieoczekiwany błąd");
  });

  it("should return server error for non-JSON response", async () => {
    const response = new Response("Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Wystąpił błąd serwera");
  });

  it("should return server error for invalid JSON", async () => {
    // Note: Creating a Response with invalid JSON string still creates a valid Response object,
    // but .json() will fail.
    const response = new Response("{invalid json", {
      status: 500,
      headers: { "content-type": "application/json" },
    });

    const message = await getAIErrorMessage(response);
    expect(message).toBe("Wystąpił błąd serwera");
  });
});
