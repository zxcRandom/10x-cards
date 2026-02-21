import type { ErrorResponse, ValidationErrorResponse, UnprocessableErrorResponse } from "@/types";

/**
 * Extracts a user-friendly error message from an AI generation API response.
 * Handles various HTTP status codes and error formats.
 */
export async function getAIErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      const errorData = await response.json();
      const errorCode = errorData?.error?.code;

      switch (response.status) {
        case 400: {
          // Validation error
          const validationError = errorData as ValidationErrorResponse;
          return validationError.error.message || "Błąd walidacji danych";
        }
        case 401:
          return "Wymagane zalogowanie";
        case 422: {
          // AI processing error
          const processingError = errorData as UnprocessableErrorResponse;
          return (
            processingError.error.message ||
            "Nie udało się przetworzyć odpowiedzi AI. Spróbuj skrócić tekst lub zmniejszyć liczbę kart."
          );
        }
        case 429:
          return "Przekroczono limit żądań. Spróbuj ponownie później.";
        case 503:
          return "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.";
        case 500:
        case 504:
          return errorCode === "TOO_MANY_REQUESTS"
            ? "Limit zapytań do usługi AI został osiągnięty. Spróbuj ponownie później."
            : "Wystąpił błąd serwera. Spróbuj ponownie później.";
        default: {
          const genericError = errorData as ErrorResponse;
          return genericError?.error?.message || "Wystąpił nieoczekiwany błąd";
        }
      }
    } catch {
      // Fallback if JSON parsing fails
      return "Wystąpił błąd serwera";
    }
  }

  return "Wystąpił błąd serwera";
}
