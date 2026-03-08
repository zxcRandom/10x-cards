import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock configuration BEFORE importing the service to prevent top-level execution errors
vi.mock("../openrouter/openrouter.config", () => ({
  createOpenRouterConfig: vi.fn().mockReturnValue({
    apiKey: "test-key",
    baseUrl: "https://test.url",
    referrer: "test-referrer",
    title: "test-title",
    defaultModel: "test-model",
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 100, maxDelayMs: 1000 },
    headers: {},
  }),
}));

import { AIService, AIParsingError, AIRateLimitError, AIUnavailableError } from "../ai.service";
import type { OpenRouterService, Logger, ChatResponseDTO } from "../openrouter/openrouter.service";
import { ThrottledError, ServiceUnavailableError, NetworkError } from "../openrouter/openrouter.service";

describe("AIService", () => {
  let aiService: AIService;
  let mockOpenRouter: OpenRouterService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockOpenRouter = {
      generateChat: vi.fn(),
      defaults: {},
    } as unknown as OpenRouterService;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    aiService = new AIService({
      openRouter: mockOpenRouter,
      logger: mockLogger,
    });
  });

  describe("generateFlashcardsFromText", () => {
    it("should generate flashcards successfully (Happy Path)", async () => {
      const mockResponse: Partial<ChatResponseDTO> = {
        message: {
          role: "assistant",
          content: JSON.stringify({
            cards: [
              { question: "Q1", answer: "A1" },
              { question: "Q2", answer: "A2", hint: "H2" },
            ],
          }),
        },
      };

      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue(mockResponse as ChatResponseDTO);

      const cards = await aiService.generateFlashcardsFromText("some text");

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({ question: "Q1", answer: "A1" });
      expect(cards[1]).toEqual({ question: "Q2", answer: "A2", hint: "H2" });
      expect(mockOpenRouter.generateChat).toHaveBeenCalledTimes(1);
    });

    it("should preserve mathematical symbols and angle brackets in input", async () => {
      const mockResponse: Partial<ChatResponseDTO> = {
        message: {
          role: "assistant",
          content: JSON.stringify({
            cards: [{ question: "Q1", answer: "A1" }],
          }),
        },
      };

      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue(mockResponse as ChatResponseDTO);

      const input = "Calculate x < y and a > b with <html> tags";
      await aiService.generateFlashcardsFromText(input);

      expect(mockOpenRouter.generateChat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Calculate x < y and a > b with <html> tags"),
            }),
          ]),
        })
      );
    });

    it("should respect requested max cards", async () => {
      const mockResponse: Partial<ChatResponseDTO> = {
        message: {
          role: "assistant",
          content: JSON.stringify({
            cards: [{ question: "Q1", answer: "A1" }],
          }),
        },
      };

      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue(mockResponse as ChatResponseDTO);

      await aiService.generateFlashcardsFromText("text", 5);

      expect(mockOpenRouter.generateChat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            maxCards: 5,
          }),
        })
      );
    });

    it("should clamp max cards to limits", async () => {
      const mockResponse: Partial<ChatResponseDTO> = {
        message: {
          role: "assistant",
          content: JSON.stringify({
            cards: [{ question: "Q1", answer: "A1" }],
          }),
        },
      };

      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue(mockResponse as ChatResponseDTO);

      // Too high (limit is 50)
      await aiService.generateFlashcardsFromText("text", 100);
      expect(mockOpenRouter.generateChat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            maxCards: 50,
          }),
        })
      );

      // Too low (limit is 1)
      await aiService.generateFlashcardsFromText("text", 0);
      expect(mockOpenRouter.generateChat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            maxCards: 1,
          }),
        })
      );
    });

    it("should throw AIParsingError when AI returns invalid JSON", async () => {
      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue({
        message: { role: "assistant", content: "Not JSON" },
      } as ChatResponseDTO);

      await expect(aiService.generateFlashcardsFromText("text")).rejects.toThrow(AIParsingError);
    });

    it("should throw AIParsingError when AI returns invalid schema", async () => {
      vi.mocked(mockOpenRouter.generateChat).mockResolvedValue({
        message: { role: "assistant", content: JSON.stringify({ wrong: "format" }) },
      } as ChatResponseDTO);

      await expect(aiService.generateFlashcardsFromText("text")).rejects.toThrow(AIParsingError);
    });

    it("should throw AIRateLimitError when OpenRouter throws ThrottledError", async () => {
      vi.mocked(mockOpenRouter.generateChat).mockRejectedValue(new ThrottledError("Rate limit", 1000));

      await expect(aiService.generateFlashcardsFromText("text")).rejects.toThrow(AIRateLimitError);
    });

    it("should throw AIUnavailableError when OpenRouter throws ServiceUnavailableError", async () => {
      vi.mocked(mockOpenRouter.generateChat).mockRejectedValue(new ServiceUnavailableError("Down"));

      await expect(aiService.generateFlashcardsFromText("text")).rejects.toThrow(AIUnavailableError);
    });

    it("should throw AIUnavailableError when OpenRouter throws NetworkError", async () => {
      vi.mocked(mockOpenRouter.generateChat).mockRejectedValue(new NetworkError("Network issue"));

      await expect(aiService.generateFlashcardsFromText("text")).rejects.toThrow(AIUnavailableError);
    });
  });
});
