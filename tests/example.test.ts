/**
 * Basic test to verify TypeScript, Vitest, and the setup are working correctly
 */

import { describe, it, expect } from 'vitest';

describe('Setup Verification', () => {
  it('should perform basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const greeting = 'Hello';
    const target = 'World';
    expect(`${greeting}, ${target}!`).toBe('Hello, World!');
  });

  it('should work with async/await', async () => {
    const asyncOperation = async (): Promise<string> => {
      return Promise.resolve('async success');
    };

    const result = await asyncOperation();
    expect(result).toBe('async success');
  });

  it('should handle TypeScript types correctly', () => {
    interface User {
      name: string;
      age: number;
    }

    const user: User = {
      name: 'Test User',
      age: 30,
    };

    expect(user.name).toBeDefined();
    expect(user.age).toBeGreaterThanOrEqual(0);
  });
});
