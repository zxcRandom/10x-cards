import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn utility", () => {
  it("merges class names correctly", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("handles conditional classes", () => {
    expect(cn("class1", true && "class2", false && "class3")).toBe("class1 class2");
  });

  it("handles undefined and null", () => {
    expect(cn("class1", undefined, null, "class2")).toBe("class1 class2");
  });

  it("handles arrays of classes", () => {
    expect(cn(["class1", "class2"])).toBe("class1 class2");
  });

  it("resolves Tailwind conflicts correctly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles mixed inputs", () => {
    expect(cn("class1", ["class2", "class3"], { class4: true, class5: false })).toBe("class1 class2 class3 class4");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});
