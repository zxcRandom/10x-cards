import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewService } from "../review.service";
import type { SupabaseClient } from "../../db/supabase.client";
import type { ReviewGrade, CreateReviewCommand } from "../../types";

// Mock Supabase Client
const createMockSupabase = () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
  } as unknown as SupabaseClient;

  return { client, queryBuilder };
};

describe("ReviewService", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  const userId = "user-123";
  const cardId = "card-123";
  const deckId = "deck-123";

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    vi.clearAllMocks();
  });

  const validCard = {
    id: cardId,
    deck_id: deckId,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_date: new Date().toISOString(),
    deck: { user_id: userId },
  };

  const validReviewCommand: CreateReviewCommand = {
    grade: 4 as ReviewGrade,
    reviewDate: new Date().toISOString(),
  };

  describe("createReview", () => {
    it("should successfully create a review for a valid card (Grade >= 3)", async () => {
      // Mock card fetch
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: {
            id: "review-1",
            card_id: cardId,
            user_id: userId,
            grade: 4,
            review_date: validReviewCommand.reviewDate,
          },
          error: null,
        })
        .mockResolvedValueOnce({ // update card
          data: {
            ...validCard,
            repetitions: 1,
            interval_days: 1, // First repetition interval logic
            ease_factor: 2.5, // Logic might change ease factor slightly
          },
          error: null,
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(mockSupabase.client.from).toHaveBeenCalledWith("cards");
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalled();
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith("id", cardId);

      expect(mockSupabase.client.from).toHaveBeenCalledWith("reviews");
      expect(mockSupabase.queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        card_id: cardId,
        user_id: userId,
        grade: 4,
      }));

      expect(mockSupabase.client.from).toHaveBeenCalledWith("cards");
      expect(mockSupabase.queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        repetitions: 1,
      }));

      expect(result).not.toHaveProperty("error");
      if (!("error" in result)) {
        expect(result.review.grade).toBe(4);
        expect(result.card.repetitions).toBe(1);
      }
    });

    it("should handle failed review (Grade < 3) correctly", async () => {
      const failedCommand: CreateReviewCommand = {
        grade: 1 as ReviewGrade,
        reviewDate: new Date().toISOString(),
      };

      // Mock card fetch
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: {
            id: "review-2",
            card_id: cardId,
            user_id: userId,
            grade: 1,
            review_date: failedCommand.reviewDate,
          },
          error: null,
        })
        .mockResolvedValueOnce({ // update card
          data: {
            ...validCard,
            repetitions: 0,
            interval_days: 1,
            ease_factor: 2.3, // Decreased ease factor
          },
          error: null,
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        failedCommand
      );

      expect(mockSupabase.queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        repetitions: 0,
        interval_days: 1,
      }));

      expect(result).not.toHaveProperty("error");
    });

    it("should return CARD_NOT_FOUND if card does not exist", async () => {
      mockSupabase.queryBuilder.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "CARD_NOT_FOUND" });
    });

    it("should return CARD_NOT_FOUND if database error during fetch", async () => {
      mockSupabase.queryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: "DB Error", code: "500" },
      });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "CARD_NOT_FOUND" });
    });

    it("should return FORBIDDEN if user does not own the deck", async () => {
      const invalidOwnerCard = {
        ...validCard,
        deck: { user_id: "other-user" },
      };

      mockSupabase.queryBuilder.single.mockResolvedValueOnce({ data: invalidOwnerCard, error: null });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "FORBIDDEN" });
    });

    it("should return DATABASE_ERROR if card structure is invalid", async () => {
      const invalidStructureCard = {
        id: cardId,
        // Missing fields
      };

      mockSupabase.queryBuilder.single.mockResolvedValueOnce({ data: invalidStructureCard, error: null });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "DATABASE_ERROR" });
    });

    it("should return UNPROCESSABLE_ENTITY if review insert fails", async () => {
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: null,
          error: { message: "Insert Failed", code: "500" },
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "UNPROCESSABLE_ENTITY" });
    });

    it("should return DATABASE_ERROR if review insert returns no data", async () => {
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: null,
          error: null,
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "DATABASE_ERROR" });
    });

    it("should return UNPROCESSABLE_ENTITY if card update fails", async () => {
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: { id: "review-1", ...validReviewCommand, card_id: cardId, user_id: userId },
          error: null,
        })
        .mockResolvedValueOnce({ // update card
          data: null,
          error: { message: "Update Failed", code: "500" },
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "UNPROCESSABLE_ENTITY" });
    });

    it("should return DATABASE_ERROR if card update returns no data", async () => {
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: validCard, error: null }) // select card
        .mockResolvedValueOnce({ // insert review
          data: { id: "review-1", ...validReviewCommand, card_id: cardId, user_id: userId },
          error: null,
        })
        .mockResolvedValueOnce({ // update card
          data: null,
          error: null,
        });

      const result = await ReviewService.createReview(
        mockSupabase.client,
        cardId,
        userId,
        validReviewCommand
      );

      expect(result).toEqual({ error: "DATABASE_ERROR" });
    });
  });
});
