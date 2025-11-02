import { vi } from "vitest";

/**
 * Mock Supabase client for testing
 */
export const mockSupabaseClient = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
  }),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
};

/**
 * Mock OpenRouter API response
 */
export const mockOpenRouterResponse = {
  id: "test-123",
  choices: [
    {
      message: {
        role: "assistant",
        content: JSON.stringify({
          cards: [
            { question: "Q1", answer: "A1" },
            { question: "Q2", answer: "A2" },
          ],
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
};

/**
 * Mock test user
 */
export const testUser = {
  id: "test-user-123",
  email: "test@example.com",
  created_at: new Date().toISOString(),
};

/**
 * Mock test deck
 */
export const testDeck = {
  id: "test-deck-123",
  user_id: "test-user-123",
  name: "Test Deck",
  description: "A test deck",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Mock test card
 */
export const testCard = {
  id: "test-card-123",
  deck_id: "test-deck-123",
  question: "What is TypeScript?",
  answer: "A typed superset of JavaScript",
  ease_factor: 2.5,
  interval_days: 1,
  repetitions: 0,
  next_review_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
