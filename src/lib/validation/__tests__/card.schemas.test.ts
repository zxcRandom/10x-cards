import { describe, it, expect } from "vitest";
import {
  createCardSchema,
  updateCardSchema,
  deckIdParamSchema,
  cardIdParamSchema,
  MAX_CARD_CONTENT_LENGTH,
} from "../card.schemas";

describe("createCardSchema", () => {
  it("should validate valid input", () => {
    const input = {
      question: "What is the capital of France?",
      answer: "Paris",
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it("should trim whitespace", () => {
    const input = {
      question: "  What is the capital of France?  ",
      answer: "  Paris  ",
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question).toBe("What is the capital of France?");
      expect(result.data.answer).toBe("Paris");
    }
  });

  it("should fail when question is empty", () => {
    const input = {
      question: "",
      answer: "Paris",
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Question cannot be empty");
    }
  });

  it("should fail when answer is empty", () => {
    const input = {
      question: "Question",
      answer: "   ",
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Answer cannot be empty");
    }
  });

  it("should fail when question exceeds max length", () => {
    const input = {
      question: "a".repeat(MAX_CARD_CONTENT_LENGTH + 1),
      answer: "Paris",
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Question cannot exceed");
    }
  });

  it("should fail when answer exceeds max length", () => {
    const input = {
      question: "Question",
      answer: "a".repeat(MAX_CARD_CONTENT_LENGTH + 1),
    };
    const result = createCardSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Answer cannot exceed");
    }
  });
});

describe("updateCardSchema", () => {
  it("should validate partial update with only question", () => {
    const input = {
      question: "New Question",
    };
    const result = updateCardSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate partial update with only answer", () => {
    const input = {
      answer: "New Answer",
    };
    const result = updateCardSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate update with both fields", () => {
    const input = {
      question: "New Question",
      answer: "New Answer",
    };
    const result = updateCardSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should fail when neither field is provided", () => {
    const input = {};
    const result = updateCardSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "At least one field (question or answer) must be provided"
      );
    }
  });

  it("should fail when question is empty in update", () => {
    const input = {
      question: "",
    };
    const result = updateCardSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("deckIdParamSchema", () => {
  it("should validate valid UUID", () => {
    const validUUID = "123e4567-e89b-12d3-a456-426614174000";
    const result = deckIdParamSchema.safeParse(validUUID);
    expect(result.success).toBe(true);
  });

  it("should fail for invalid UUID", () => {
    const invalidUUID = "invalid-uuid";
    const result = deckIdParamSchema.safeParse(invalidUUID);
    expect(result.success).toBe(false);
  });
});

describe("cardIdParamSchema", () => {
  it("should validate valid UUID", () => {
    const validUUID = "123e4567-e89b-12d3-a456-426614174000";
    const result = cardIdParamSchema.safeParse(validUUID);
    expect(result.success).toBe(true);
  });

  it("should fail for invalid UUID", () => {
    const invalidUUID = "invalid-uuid";
    const result = cardIdParamSchema.safeParse(invalidUUID);
    expect(result.success).toBe(false);
  });
});
