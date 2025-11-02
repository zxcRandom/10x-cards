/**
 * Result Type Pattern
 *
 * Type-safe way to handle success/error cases without throwing exceptions.
 * Replaces union types like `T | { error: ErrorCode }` with a more explicit API.
 *
 * @example
 * async function getUser(id: string): Promise<Result<User, ErrorCode>> {
 *   const user = await db.findUser(id);
 *   if (!user) {
 *     return Result.err("USER_NOT_FOUND");
 *   }
 *   return Result.ok(user);
 * }
 *
 * const result = await getUser("123");
 * if (result.isOk()) {
 *   console.log(result.value); // User type
 * } else {
 *   console.error(result.error); // ErrorCode type
 * }
 */
export class Result<T, E> {
  private readonly _tag: "ok" | "err";
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(tag: "ok" | "err", value?: T, error?: E) {
    this._tag = tag;
    this._value = value;
    this._error = error;
  }

  /**
   * Creates a successful Result containing a value
   */
  static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>("ok", value, undefined);
  }

  /**
   * Creates a failed Result containing an error
   */
  static err<T = never, E = unknown>(error: E): Result<T, E> {
    return new Result<T, E>("err", undefined, error);
  }

  /**
   * Type guard to check if Result is successful
   */
  isOk(): this is { value: T } {
    return this._tag === "ok";
  }

  /**
   * Type guard to check if Result is an error
   */
  isErr(): this is { error: E } {
    return this._tag === "err";
  }

  /**
   * Gets the value if Ok, throws if Err
   * @throws Error if Result is Err
   */
  get value(): T {
    if (this._tag !== "ok" || this._value === undefined) {
      throw new Error("Cannot get value from Error result");
    }
    return this._value;
  }

  /**
   * Gets the error if Err, throws if Ok
   * @throws Error if Result is Ok
   */
  get error(): E {
    if (this._tag !== "err" || this._error === undefined) {
      throw new Error("Cannot get error from Ok result");
    }
    return this._error;
  }

  /**
   * Maps the Ok value to a new value, leaves Err unchanged
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._tag === "ok" && this._value !== undefined) {
      return Result.ok(fn(this._value));
    }
    return Result.err(this._error as E);
  }

  /**
   * Maps the Err value to a new error, leaves Ok unchanged
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (this._tag === "err" && this._error !== undefined) {
      return Result.err(fn(this._error));
    }
    return Result.ok(this._value as T);
  }

  /**
   * Returns the value if Ok, otherwise returns the default value
   */
  unwrapOr(defaultValue: T): T {
    return this._tag === "ok" && this._value !== undefined ? this._value : defaultValue;
  }

  /**
   * Returns the value if Ok, otherwise executes the function and returns its result
   */
  unwrapOrElse(fn: (error: E) => T): T {
    if (this._tag === "ok" && this._value !== undefined) {
      return this._value;
    }
    return fn(this._error as E);
  }

  /**
   * Converts Result to a plain object (for legacy compatibility)
   * @deprecated Use isOk()/isErr() type guards instead
   */
  toUnion(): T | { error: E } {
    if (this._tag === "ok" && this._value !== undefined) {
      return this._value;
    }
    return { error: this._error as E };
  }
}
