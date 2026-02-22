export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type Redactor = (meta: Record<string, unknown>) => Record<string, unknown> | undefined;

export class ConsoleLogger implements Logger {
  constructor(private readonly redactor?: Redactor) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.debug(message, this.sanitize(meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.info(message, this.sanitize(meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.warn(message, this.sanitize(meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error(message, this.sanitize(meta));
  }

  private sanitize(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!meta) {
      return undefined;
    }
    return this.redactor ? this.redactor(meta) : meta;
  }
}
