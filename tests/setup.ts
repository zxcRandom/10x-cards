import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver

global.IntersectionObserver = class IntersectionObserver {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
  constructor() {}
  disconnect() {} // eslint-disable-line @typescript-eslint/no-empty-function
  observe() {} // eslint-disable-line @typescript-eslint/no-empty-function
  takeRecords() {
    return [];
  }
  unobserve() {} // eslint-disable-line @typescript-eslint/no-empty-function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
