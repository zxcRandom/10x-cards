import { bench, describe } from 'vitest';

describe('Logging Performance', () => {
  const user = { id: 'user-123-abc-456' };
  const validated = { maxCards: 10 };

  // Local dummy log function to simulate the overhead of calling console.log
  // without actually printing to stdout (which would flood the benchmark output).
  // In reality, console.log has additional I/O overhead.
  const dummyLog = (...args: any[]) => {};

  bench('logging overhead (simulated)', () => {
    dummyLog(` AI generation for user ${user.id}, maxCards: ${validated.maxCards}`);
  });

  bench('no logging', () => {
    // optimized
  });
});
