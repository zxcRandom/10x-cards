import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenRouterService } from "../openrouter/openrouter.service";
import type { ChatRequestDTO, ChatResponseDTO } from "../openrouter/openrouter.service";

// Mock OpenRouterConfig to avoid crash on module import
vi.mock("../openrouter/openrouter.config", () => {
  return {
    createOpenRouterConfig: vi.fn().mockReturnValue({
      apiKey: "test-key",
      baseUrl: "test-url",
      retry: { attempts: 1, backoffMs: 0, maxDelayMs: 0 },
      headers: {},
    }),
  };
});

// Mock OpenRouterService
vi.mock("../openrouter/openrouter.service", () => {
  return {
    OpenRouterService: class {
      generateChat = vi.fn();
    },
    OpenRouterError: class extends Error {},
  };
});

// Import AIService AFTER mocking
import { AIService } from "../ai.service";

describe("AIService", () => {
  let aiService: AIService;
  let mockOpenRouter: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a mock instance of OpenRouterService
    // Since we mocked the class, we can instantiate it
    mockOpenRouter = new OpenRouterService({ apiKey: "test-key" } as any);

    // Setup the generateChat mock to return a valid response so we don't crash on parsing
    mockOpenRouter.generateChat = vi.fn().mockResolvedValue({
      id: "test-id",
      model: "test-model",
      created: 1234567890,
      message: {
        role: "assistant",
        content: JSON.stringify({
          cards: [
            {
              question: "Test Question",
              answer: "Test Answer",
            },
          ],
        }),
      },
    } as ChatResponseDTO);

    // Initialize AIService with the mock
    aiService = new AIService({
      openRouter: mockOpenRouter,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });
  });

  it("should preserve mathematical symbols in input", async () => {
    const input = "Calculate x < y and a > b";

    await aiService.generateFlashcardsFromText(input);

    const callArgs = mockOpenRouter.generateChat.mock.calls[0][0] as ChatRequestDTO;
    const userMessage = callArgs.messages.find((m) => m.role === "user");

    // New behavior: < and > should be preserved
    expect(userMessage?.content).toContain("Calculate x < y and a > b");
    expect(userMessage?.content).toContain("x < y");
    expect(userMessage?.content).toContain("a > b");
  });
});
