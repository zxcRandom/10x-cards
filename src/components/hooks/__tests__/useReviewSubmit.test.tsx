import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useReviewSubmit } from "../useReviewSubmit";
import { toast } from "sonner";
import { REVIEW_MESSAGES } from "@/lib/constants/messages";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("useReviewSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should submit a review successfully", async () => {
    const mockResponse = {
      card: { id: "123", nextReviewDate: "2023-01-01" },
      review: { id: "456", grade: 5 },
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toEqual(mockResponse);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/cards/123/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grade: 5 }),
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should handle 429 Too Many Requests", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith(REVIEW_MESSAGES.RATE_LIMIT_EXCEEDED);
  });

  it("should handle 503 Service Unavailable", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith(REVIEW_MESSAGES.SERVICE_UNAVAILABLE);
  });

  it("should handle generic API errors with message", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "Custom error message" },
      }),
    });

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith("Custom error message");
  });

  it("should handle generic API errors without message", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith(REVIEW_MESSAGES.SAVE_ERROR);
  });

  it("should handle network errors", async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useReviewSubmit());

    await act(async () => {
      const response = await result.current.submitReview("123", 5);
      expect(response).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith(REVIEW_MESSAGES.GENERIC_ERROR);
  });
});
