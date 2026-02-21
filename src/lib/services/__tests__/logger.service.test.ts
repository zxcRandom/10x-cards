import { describe, it, expect, vi, afterEach } from "vitest";
import { ConsoleLogger } from "../logger.service";

describe("ConsoleLogger", () => {
  const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should log debug messages", () => {
    const logger = new ConsoleLogger();
    logger.debug("test message", { key: "value" });
    expect(consoleDebugSpy).toHaveBeenCalledWith("test message", { key: "value" });
  });

  it("should log info messages", () => {
    const logger = new ConsoleLogger();
    logger.info("test message", { key: "value" });
    expect(consoleInfoSpy).toHaveBeenCalledWith("test message", { key: "value" });
  });

  it("should log warn messages", () => {
    const logger = new ConsoleLogger();
    logger.warn("test message", { key: "value" });
    expect(consoleWarnSpy).toHaveBeenCalledWith("test message", { key: "value" });
  });

  it("should log error messages", () => {
    const logger = new ConsoleLogger();
    logger.error("test message", { key: "value" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("test message", { key: "value" });
  });

  it("should redact metadata using the provided redactor", () => {
    const redactor = (meta: Record<string, unknown>) => {
      return { ...meta, secret: "[REDACTED]" };
    };
    const logger = new ConsoleLogger(redactor);

    logger.info("test message", { secret: "12345", other: "value" });

    expect(consoleInfoSpy).toHaveBeenCalledWith("test message", {
      secret: "[REDACTED]",
      other: "value",
    });
  });

  it("should handle undefined metadata", () => {
    const logger = new ConsoleLogger();
    logger.info("test message");
    expect(consoleInfoSpy).toHaveBeenCalledWith("test message", undefined);
  });
});
