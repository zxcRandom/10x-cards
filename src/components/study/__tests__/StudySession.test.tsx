import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StudySession from "../StudySession";
import { useDueCards } from "@/components/hooks/useDueCards";
import { useReviewSubmit } from "@/components/hooks/useReviewSubmit";
import type { StudyCardVM } from "../types";

// Mock the hooks
vi.mock("@/components/hooks/useDueCards", () => ({
  useDueCards: vi.fn(),
}));

vi.mock("@/components/hooks/useReviewSubmit", () => ({
  useReviewSubmit: vi.fn(),
}));

describe("StudySession", () => {
  const mockDeckId = "deck-123";
  const mockCards: StudyCardVM[] = [
    {
      id: "card-1",
      question: "Question 1",
      answer: "Answer 1",
      nextReviewDate: "2023-01-01",
      intervalDays: 1,
      repetitions: 1,
      easeFactor: 2.5,
    },
    {
      id: "card-2",
      question: "Question 2",
      answer: "Answer 2",
      nextReviewDate: "2023-01-02",
      intervalDays: 1,
      repetitions: 1,
      easeFactor: 2.5,
    },
  ];

  const mockSubmitReview = vi.fn();
  const mockFetchCards = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for useReviewSubmit
    (useReviewSubmit as any).mockReturnValue({
      isSubmitting: false,
      submitReview: mockSubmitReview,
    });
  });

  it("renders loading state initially", () => {
    (useDueCards as any).mockReturnValue({
      cards: [],
      loading: true,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    render(<StudySession deckId={mockDeckId} />);
    expect(screen.getByText(/Ładowanie kart do nauki.../i)).toBeInTheDocument();
  });

  it("renders error state when fetch fails", () => {
    const mockError = {
      status: 500,
      code: "ERROR",
      message: "Test error message",
    };

    (useDueCards as any).mockReturnValue({
      cards: [],
      loading: false,
      error: mockError,
      fetchCards: mockFetchCards,
    });

    render(<StudySession deckId={mockDeckId} />);
    expect(screen.getByText(/Wystąpił błąd/i)).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();

    // Check if retry button is present
    const retryButton = screen.getByRole("button", { name: /Ponów próbę/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryButton);
    expect(mockFetchCards).toHaveBeenCalled();
  });

  it("renders empty state when no cards are due", () => {
    (useDueCards as any).mockReturnValue({
      cards: [],
      loading: false,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    render(<StudySession deckId={mockDeckId} />);
    expect(screen.getByText(/Brak kart do nauki/i)).toBeInTheDocument();
  });

  it("renders active session with the first card", () => {
    (useDueCards as any).mockReturnValue({
      cards: mockCards,
      loading: false,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    render(<StudySession deckId={mockDeckId} />);

    // Check progress
    expect(screen.getByText(`Karta 1 z ${mockCards.length}`)).toBeInTheDocument();
    expect(screen.getByText("Oceniono: 0")).toBeInTheDocument();

    // Check card content
    expect(screen.getByText("Question 1")).toBeInTheDocument();

    // Check "Show Answer" button
    expect(screen.getByRole("button", { name: /Pokaż odpowiedź/i })).toBeInTheDocument();

    // Answer should not be visible yet
    expect(screen.queryByText("Answer 1")).not.toBeInTheDocument();
  });

  it("shows answer and review controls when requested", () => {
    (useDueCards as any).mockReturnValue({
      cards: mockCards,
      loading: false,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    render(<StudySession deckId={mockDeckId} />);

    // Click "Show Answer"
    fireEvent.click(screen.getByRole("button", { name: /Pokaż odpowiedź/i }));

    // Answer should be visible
    expect(screen.getByText("Answer 1")).toBeInTheDocument();

    // Review controls should be visible (buttons 0-5)
    expect(screen.getByText("Oceń swoją odpowiedź")).toBeInTheDocument();
    // Check for a few grade buttons using regex for partial match
    // Note: The structure is <button><span>0</span><span>Nic nie wiem</span></button>
    // So the accessible name might be "0Nic nie wiem" or "0 Nic nie wiem"
    // Using loose regex handles both.
    expect(screen.getByRole("button", { name: /0.*Nic nie wiem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5.*Bardzo łatwo/i })).toBeInTheDocument();
  });

  it("submits review and moves to next card", async () => {
    (useDueCards as any).mockReturnValue({
      cards: mockCards,
      loading: false,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    mockSubmitReview.mockResolvedValue({ success: true });

    render(<StudySession deckId={mockDeckId} />);

    // Show answer
    fireEvent.click(screen.getByRole("button", { name: /Pokaż odpowiedź/i }));

    // Click grade 4 (Dobrze/Łatwo - check label mapping in ReviewControls)
    // Grade 4 is "Łatwo"
    const gradeButton = screen.getByRole("button", { name: /4.*Łatwo/i });
    fireEvent.click(gradeButton);

    // Check if submitReview was called
    expect(mockSubmitReview).toHaveBeenCalledWith("card-1", 4);

    // Wait for state update - should show next card
    await waitFor(() => {
      expect(screen.getByText("Question 2")).toBeInTheDocument();
    });

    // Check progress update
    expect(screen.getByText(`Karta 2 z ${mockCards.length}`)).toBeInTheDocument();
    expect(screen.getByText("Oceniono: 1")).toBeInTheDocument();
  });

  it("shows session summary when all cards are reviewed", async () => {
    // Only one card for this test
    const singleCard = [mockCards[0]];

    (useDueCards as any).mockReturnValue({
      cards: singleCard,
      loading: false,
      error: undefined,
      fetchCards: mockFetchCards,
    });

    mockSubmitReview.mockResolvedValue({ success: true });

    render(<StudySession deckId={mockDeckId} />);

    // Show answer
    fireEvent.click(screen.getByRole("button", { name: /Pokaż odpowiedź/i }));

    // Submit review
    fireEvent.click(screen.getByRole("button", { name: /5.*Bardzo łatwo/i }));

    // Should show summary
    await waitFor(() => {
      expect(screen.getByText(/Gratulacje!/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Ukończyłeś sesję nauki/i)).toBeInTheDocument();
    expect(screen.getByText("Ocenione karty:")).toBeInTheDocument();
    // 1 card reviewed
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
