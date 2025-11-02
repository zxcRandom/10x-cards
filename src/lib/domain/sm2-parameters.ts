/**
 * SM-2 (SuperMemo 2) Algorithm Parameters
 * 
 * Value Object representing spaced repetition parameters for flashcards.
 * Encapsulates validation logic and provides type-safe defaults.
 * 
 * The SM-2 algorithm uses these parameters to calculate optimal review intervals:
 * - easeFactor: Multiplier for interval calculation (min 1.3)
 * - intervalDays: Days until next review (min 1)
 * - repetitions: Number of consecutive correct reviews
 * 
 * @see https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */
export class SM2Parameters {
  /**
   * Default SM-2 parameters for new cards
   */
  static readonly DEFAULTS = {
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
  } as const;

  /**
   * Minimum allowed ease factor (SM-2 algorithm constraint)
   */
  static readonly MIN_EASE_FACTOR = 1.3;

  /**
   * Minimum interval in days
   */
  static readonly MIN_INTERVAL = 1;

  constructor(
    readonly easeFactor: number,
    readonly intervalDays: number,
    readonly repetitions: number
  ) {
    this.validate();
  }

  /**
   * Creates SM-2 parameters with default values
   */
  static createDefaults(): SM2Parameters {
    return new SM2Parameters(
      SM2Parameters.DEFAULTS.easeFactor,
      SM2Parameters.DEFAULTS.intervalDays,
      SM2Parameters.DEFAULTS.repetitions
    );
  }

  /**
   * Creates SM-2 parameters from a database record
   */
  static fromDatabase(data: {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
  }): SM2Parameters {
    return new SM2Parameters(
      data.ease_factor,
      data.interval_days,
      data.repetitions
    );
  }

  /**
   * Validates SM-2 parameters according to algorithm constraints
   * @throws Error if parameters are invalid
   */
  private validate(): void {
    if (this.easeFactor < SM2Parameters.MIN_EASE_FACTOR) {
      throw new Error(
        `Ease factor must be at least ${SM2Parameters.MIN_EASE_FACTOR}, got ${this.easeFactor}`
      );
    }

    if (this.intervalDays < SM2Parameters.MIN_INTERVAL) {
      throw new Error(
        `Interval must be at least ${SM2Parameters.MIN_INTERVAL} days, got ${this.intervalDays}`
      );
    }

    if (this.repetitions < 0) {
      throw new Error(
        `Repetitions cannot be negative, got ${this.repetitions}`
      );
    }

    if (!Number.isFinite(this.easeFactor) || !Number.isFinite(this.intervalDays)) {
      throw new Error("SM-2 parameters must be finite numbers");
    }
  }

  /**
   * Converts to database format (snake_case)
   */
  toDatabase(): {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
  } {
    return {
      ease_factor: this.easeFactor,
      interval_days: this.intervalDays,
      repetitions: this.repetitions,
    };
  }

  /**
   * Creates a copy with modified ease factor
   */
  withEaseFactor(easeFactor: number): SM2Parameters {
    return new SM2Parameters(easeFactor, this.intervalDays, this.repetitions);
  }

  /**
   * Creates a copy with modified interval
   */
  withInterval(intervalDays: number): SM2Parameters {
    return new SM2Parameters(this.easeFactor, intervalDays, this.repetitions);
  }

  /**
   * Creates a copy with incremented repetitions
   */
  incrementRepetitions(): SM2Parameters {
    return new SM2Parameters(
      this.easeFactor,
      this.intervalDays,
      this.repetitions + 1
    );
  }

  /**
   * Resets repetitions to 0 (used when card is reviewed incorrectly)
   */
  resetRepetitions(): SM2Parameters {
    return new SM2Parameters(this.easeFactor, this.intervalDays, 0);
  }

  /**
   * Checks if parameters are equal to defaults
   */
  isDefault(): boolean {
    return (
      this.easeFactor === SM2Parameters.DEFAULTS.easeFactor &&
      this.intervalDays === SM2Parameters.DEFAULTS.intervalDays &&
      this.repetitions === SM2Parameters.DEFAULTS.repetitions
    );
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `SM2Parameters(ease=${this.easeFactor}, interval=${this.intervalDays}, reps=${this.repetitions})`;
  }
}
