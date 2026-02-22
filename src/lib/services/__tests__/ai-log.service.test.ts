import { describe, it, expect, vi, beforeEach } from "vitest";
import { AILogService, type CreateAILogData } from "../ai-log.service";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("AILogService", () => {
  const mockDate = "2024-03-20T10:00:00.000Z";

  // Create a fresh mock client for each test
  const createMockClient = () => {
    const mockSingle = vi.fn();
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    return {
      client: {
        from: mockFrom,
      } as unknown as SupabaseClient,
      mocks: {
        from: mockFrom,
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLog", () => {
    const logData: CreateAILogData = {
      userId: "test-user-123",
      deckId: "test-deck-123",
      inputTextLength: 100,
      generatedCardsCount: 5,
      errorMessage: null,
    };

    it("should successfully create an AI log entry", async () => {
      const { client, mocks } = createMockClient();

      const mockLog = {
        id: "log-123",
        user_id: logData.userId,
        deck_id: logData.deckId,
        input_text_length: logData.inputTextLength,
        generated_cards_count: logData.generatedCardsCount,
        error_message: logData.errorMessage,
        created_at: mockDate,
      };

      mocks.single.mockResolvedValue({ data: mockLog, error: null });

      const result = await AILogService.createLog(client, logData);

      // Verify supabase calls
      expect(mocks.from).toHaveBeenCalledWith("ai_generation_logs");
      expect(mocks.insert).toHaveBeenCalledWith({
        user_id: logData.userId,
        deck_id: logData.deckId,
        input_text_length: logData.inputTextLength,
        generated_cards_count: logData.generatedCardsCount,
        error_message: logData.errorMessage,
      });

      // Verify result mapping
      expect(result).toEqual({
        id: mockLog.id,
        deckId: mockLog.deck_id,
        inputTextLength: mockLog.input_text_length,
        generatedCardsCount: mockLog.generated_cards_count,
        errorMessage: mockLog.error_message,
        createdAt: mockLog.created_at,
      });
    });

    it("should throw error when creation fails", async () => {
      const { client, mocks } = createMockClient();
      const dbError = { message: "Database error" };

      mocks.single.mockResolvedValue({ data: null, error: dbError });

      await expect(AILogService.createLog(client, logData)).rejects.toThrow("Failed to create AI log: Database error");

      expect(mocks.from).toHaveBeenCalledWith("ai_generation_logs");
    });
  });
});
