/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../verify-and-reset";

// Mock Supabase client
vi.mock("@/db/supabase.client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/supabase.client")>();
  return {
    ...actual,
    createAdminClient: vi.fn().mockReturnValue({}),
  };
});

// Shared mocks for persistence across instances
const mockCheck = vi
  .fn()
  .mockResolvedValueOnce({ allowed: true, remaining: 2 })
  .mockResolvedValueOnce({ allowed: true, remaining: 1 })
  .mockResolvedValueOnce({ allowed: true, remaining: 0 })
  .mockResolvedValue({ allowed: false, remaining: 0, resetInMs: 60000 });

const mockIncrement = vi.fn().mockResolvedValue(undefined);

// Mock RateLimitService
vi.mock("@/lib/services/rate-limit.service", () => {
  return {
    RateLimitService: class {
      checkPasswordResetRateLimit = mockCheck;
      incrementPasswordResetRateLimit = mockIncrement;
    },
  };
});

// Mock Supabase locals
const mockVerifyOtp = vi.fn();
const mockUpdateUser = vi.fn();

const mockLocals = {
  supabase: {
    auth: {
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
    },
  },
} as any;

describe("POST /api/v1/auth/password/verify-and-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("should rate limit after 3 attempts", async () => {
    const email = "victim@example.com";
    const body = JSON.stringify({
      email,
      otp: "123456",
      newPassword: "password123",
      confirmNewPassword: "password123",
    });

    const runRequest = async () => {
      const request = new Request("http://localhost/api/v1/auth/password/verify-and-reset", {
        method: "POST",
        body,
      });
      return POST({ request, locals: mockLocals } as any);
    };

    // 1st attempt
    let res = await runRequest();
    expect(res.status).not.toBe(429);

    // 2nd attempt
    res = await runRequest();
    expect(res.status).not.toBe(429);

    // 3rd attempt
    res = await runRequest();
    expect(res.status).not.toBe(429);

    // 4th attempt - Should return 429 when fixed
    res = await runRequest();
    expect(res.status).toBe(429);
  });
});
