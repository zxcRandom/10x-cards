import { describe, it, expect } from "vitest";
import { UpdateProfileSchema } from "../profile.schemas";

describe("UpdateProfileSchema", () => {
  it("should validate a valid payload with privacyConsent", () => {
    const result = UpdateProfileSchema.safeParse({ privacyConsent: true });
    expect(result.success).toBe(true);
  });

  it("should validate a valid payload with restore: true", () => {
    const result = UpdateProfileSchema.safeParse({ restore: true });
    expect(result.success).toBe(true);
  });

  it("should validate a valid payload with both fields", () => {
    const result = UpdateProfileSchema.safeParse({ privacyConsent: false, restore: true });
    expect(result.success).toBe(true);
  });

  it("should fail when no fields are provided", () => {
    const result = UpdateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("At least one field (privacyConsent or restore) must be provided");
    }
  });

  it("should fail when restore is false", () => {
    const result = UpdateProfileSchema.safeParse({ restore: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Depending on Zod error structure, the custom message might be at a specific path or root
      // The schema defines path: ["restore"], so we check specifically for that issue
      const issue = result.error.issues.find(
        (i) => i.path.includes("restore") && i.message === "restore field can only be true (or omitted)"
      );
      expect(issue).toBeDefined();
    }
  });

  it("should fail when extra fields are provided", () => {
    const result = UpdateProfileSchema.safeParse({ privacyConsent: true, extraField: "invalid" });
    expect(result.success).toBe(false);
  });

  it("should fail when privacyConsent has invalid type", () => {
    const result = UpdateProfileSchema.safeParse({ privacyConsent: "invalid" });
    expect(result.success).toBe(false);
  });

  it("should fail when restore has invalid type", () => {
    const result = UpdateProfileSchema.safeParse({ restore: "invalid" });
    expect(result.success).toBe(false);
  });
});
