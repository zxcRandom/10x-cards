/**
 * AIService - Handles communication with OpenRouter API for flashcard generation
 */

export interface GeneratedCard {
  question: string;
  answer: string;
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

export class AITimeoutError extends AIServiceError {
  constructor() {
    super("AI request timed out");
    this.name = "AITimeoutError";
  }
}

export class AIParsingError extends AIServiceError {
  constructor(message: string) {
    super(message);
    this.name = "AIParsingError";
  }
}

export class AIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor() {
    this.apiKey = import.meta.env.OPENROUTER_API_KEY;
    this.model = import.meta.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo";
    this.baseUrl = import.meta.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.timeout = parseInt(import.meta.env.AI_TIMEOUT_MS || "30000");

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
  }

  /**
   * Generate flashcards from input text using AI
   */
  async generateFlashcardsFromText(inputText: string, maxCards = 20): Promise<GeneratedCard[]> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(inputText, maxCards);
      const response = await this.callOpenRouter(prompt);
      const cards = this.parseResponse(response);
      const validCards = this.validateCards(cards);

      const duration = Date.now() - startTime;
      console.log(`AI generation completed in ${duration}ms, generated ${validCards.length} cards`);

      return validCards;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`AI generation failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Build prompt for AI model
   */
  private buildPrompt(inputText: string, maxCards: number): string {
    return `You are an expert educator creating educational flashcards.

Generate up to ${maxCards} high-quality flashcards from the following text. Each flashcard should:
- Have a clear, concise question
- Have a complete, accurate answer
- Test understanding of key concepts
- Be suitable for spaced repetition learning

Text to analyze:
"""
${this.sanitizeInput(inputText)}
"""

Return ONLY a JSON array with this exact format (no additional text):
[
  {"question": "What is...", "answer": "It is..."},
  {"question": "How does...", "answer": "It works by..."}
]`;
  }

  /**
   * Sanitize user input before sending to AI
   */
  private sanitizeInput(text: string): string {
    // Remove potentially harmful characters, keep educational content
    return text
      .replace(/[<>]/g, "") // Remove HTML-like tags
      .slice(0, 20000); // Hard limit
  }

  /**
   * Call OpenRouter API with retry logic
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://10x-cards.app", // Required by OpenRouter
            "X-Title": "10x Cards",
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new AIServiceError(`OpenRouter API error: ${response.status} ${response.statusText}`, errorBody);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new AIParsingError("No content in AI response");
        }

        return content;
      } catch (error) {
        lastError = error;

        // Handle AbortController timeout
        if (error instanceof Error && error.name === "AbortError") {
          throw new AITimeoutError();
        }

        // Don't retry on timeout or 4xx errors
        if (error instanceof AITimeoutError || (error instanceof AIServiceError && error.message.includes("4"))) {
          throw error;
        }

        // Exponential backoff for retries
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`AI call failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new AIServiceError("AI request failed after retries", lastError);
  }

  /**
   * Parse AI response to extract cards
   */
  private parseResponse(response: string): GeneratedCard[] {
    try {
      // Try to extract JSON array from response
      // AI might wrap it in markdown code blocks
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new AIParsingError("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        throw new AIParsingError("Response is not an array");
      }

      return parsed;
    } catch (error) {
      if (error instanceof AIParsingError) {
        throw error;
      }
      throw new AIParsingError(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validate and filter generated cards
   */
  private validateCards(cards: unknown[]): GeneratedCard[] {
    return cards
      .filter((card) => {
        // Check structure
        if (typeof card !== "object" || card === null || !("question" in card) || !("answer" in card)) {
          console.warn("Invalid card structure:", card);
          return false;
        }

        // Check non-empty
        const question = String(card.question).trim();
        const answer = String(card.answer).trim();

        if (!question || !answer) {
          console.warn("Empty question or answer:", card);
          return false;
        }

        // Check length
        if (question.length > 10000 || answer.length > 10000) {
          console.warn("Question or answer too long:", card);
          return false;
        }

        return true;
      })
      .map((card) => ({
        question: String((card as { question: unknown }).question).trim(),
        answer: String((card as { answer: unknown }).answer).trim(),
      }));
  }
}

// Singleton instance
export const aiService = new AIService();
