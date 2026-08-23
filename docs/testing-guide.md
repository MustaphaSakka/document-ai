# Testing Guide with Vitest

Complete guide to testing in this project using Vitest.

## Overview

This project uses **Vitest** as the testing framework. Vitest is a modern, fast test runner specifically designed for TypeScript and modern JavaScript projects.

### Why Vitest?

- **Fast**: Uses native ES modules and Vite for rapid test execution
- **TypeScript-first**: Built-in TypeScript support without configuration
- **Watch mode**: Automatically reruns tests on file changes
- **Modern**: Compatible with contemporary JavaScript frameworks
- **Coverage**: Built-in code coverage reporting
- **Jest-compatible**: Easy migration from Jest if needed

## Test Configuration

Vitest is configured in `package.json` scripts. No separate configuration file is needed for basic usage.

### Available Test Scripts

```json
{
  "test": "vitest",
  "test:coverage": "vitest --coverage"
}
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = processInput(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test File Organization

- Place test files in `tests/` directory
- Name test files with `.test.ts` suffix
- Mirror your `src/` structure in `tests/` when possible

Example:
```
src/
  utils/
    helpers.ts
tests/
  utils/
    helpers.test.ts
```

## Test Assertions

Vitest uses the same assertion API as Jest, making it familiar and easy to use.

### Common Assertions

```typescript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality

// Truthiness
expect(value).toBeTruthy();              // Truthy value
expect(value).toBeFalsy();               // Falsy value
expect(value).toBeDefined();             // Not undefined

// Numbers
expect(value).toBeGreaterThan(5);        // Greater than
expect(value).toBeLessThan(10);          // Less than
expect(value).toBeCloseTo(0.3, 2);       // Approximate equality

// Strings
expect(string).toContain('substring');   // Contains substring
expect(string).toMatch(/regex/);         // Matches regex

// Arrays
expect(array).toHaveLength(3);           // Array length
expect(array).toContain(item);            // Contains item
expect(array).toEqual([1, 2, 3]);        // Array equality

// Objects
expect(object).toHaveProperty('key');    // Has property
expect(object).toMatchObject({           // Partial match
  name: 'John',
  age: 30
});

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Testing Patterns

### Testing Synchronous Functions

```typescript
function add(a: number, b: number): number {
  return a + b;
}

describe('add function', () => {
  it('should add two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });

  it('should handle zero', () => {
    expect(add(5, 0)).toBe(5);
  });
});
```

### Testing Async Functions

```typescript
async function fetchUserData(id: string): Promise<User> {
  // Simulated API call
  return { id, name: 'John Doe', age: 30 };
}

describe('fetchUserData', () => {
  it('should fetch user data', async () => {
    const user = await fetchUserData('123');
    expect(user.id).toBe('123');
    expect(user.name).toBeDefined();
  });

  it('should handle non-existent user', async () => {
    await expect(fetchUserData('999')).rejects.toThrow('User not found');
  });
});
```

### Testing with Setup and Teardown

```typescript
describe('Database operations', () => {
  let db: Database;

  beforeEach(() => {
    // Runs before each test
    db = new Database();
  });

  afterEach(() => {
    // Runs after each test
    db.close();
  });

  beforeAll(() => {
    // Runs once before all tests
    initializeDatabase();
  });

  afterAll(() => {
    // Runs once after all tests
    cleanupDatabase();
  });

  it('should insert data', () => {
    db.insert({ name: 'Test' });
    expect(db.count()).toBe(1);
  });
});
```

### Testing Objects and Interfaces

```typescript
interface User {
  name: string;
  age: number;
  email?: string;
}

function validateUser(user: User): boolean {
  return user.name.length > 0 && user.age >= 18;
}

describe('validateUser', () => {
  it('should validate correct user', () => {
    const user: User = { name: 'John', age: 25 };
    expect(validateUser(user)).toBe(true);
  });

  it('should reject underage user', () => {
    const user: User = { name: 'Jane', age: 15 };
    expect(validateUser(user)).toBe(false);
  });

  it('should handle optional email', () => {
    const user: User = { name: 'Bob', age: 30, email: 'bob@example.com' };
    expect(validateUser(user)).toBe(true);
  });
});
```

### Error Handling Tests

```typescript
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

describe('divide', () => {
  it('should throw error for division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('should throw error type', () => {
    expect(() => divide(10, 0)).toThrow(Error);
  });
});
```

## Running Tests

### Basic Test Execution

```bash
# Run all tests once
npm test

# Run tests in watch mode (default)
npm test

# Run tests matching pattern
npm test -- user.test

# Run tests in specific file
npm test -- path/to/test.test.ts
```

### Coverage Reports

```bash
# Run tests with coverage
npm run test:coverage

# This generates coverage reports in:
# - coverage/ directory
# - Console output
```

Coverage report includes:
- **Statements**: Percentage of code statements executed
- **Branches**: Percentage of conditional branches tested
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

### Watch Mode

By default, Vitest runs in watch mode, which means:
- Tests automatically rerun when files change
- Interactive console interface
- Filter tests by pattern
- Exit watch mode with `q`

## Test Organization

### Describe Blocks

Use `describe` to group related tests:

```typescript
describe('User authentication', () => {
  describe('login', () => {
    it('should succeed with correct credentials');
    it('should fail with wrong credentials');
  });

  describe('logout', () => {
    it('should clear session');
    it('should redirect to home');
  });
});
```

### Test Naming

Use descriptive test names that follow this pattern:
- "should [expected outcome] when [condition]"
- "should [do something]"
- "should throw error when [invalid input]"

Examples:
- ✅ "should return user data when ID exists"
- ✅ "should calculate total with tax"
- ✅ "should throw validation error for empty name"
- ❌ "test 1"
- ❌ "it works"

### Test Independence

Each test should be:
- **Independent**: Can run alone without other tests
- **Isolated**: Doesn't depend on test execution order
- **Clear**: Tests one thing only
- **Fast**: Completes quickly

## Testing Best Practices

### 1. AAA Pattern
Organize tests with **Arrange, Act, Assert**:

```typescript
it('should calculate discount', () => {
  // Arrange - Set up test data
  const price = 100;
  const discount = 0.2;

  // Act - Execute the function
  const result = calculatePrice(price, discount);

  // Assert - Verify the result
  expect(result).toBe(80);
});
```

### 2. One Assertion Per Test
Keep tests focused on one behavior:

```typescript
// Good: Single assertion
it('should return correct total', () => {
  expect(calculateTotal(10, 2)).toBe(20);
});

// Less ideal: Multiple assertions
it('should handle various inputs', () => {
  expect(calculateTotal(10, 2)).toBe(20);
  expect(calculateTotal(5, 3)).toBe(15);
  expect(calculateTotal(0, 1)).toBe(0);
});
```

### 3. Test Descriptive Names
Use clear, descriptive test names:

```typescript
// Good: Descriptive
it('should throw ValidationError when email is invalid');

// Bad: Vague
it('should handle email');
```

### 4. Test Edge Cases
Don't just test the happy path:

```typescript
describe('stringToNumber', () => {
  it('should convert valid number strings');
  it('should handle empty string');
  it('should handle non-numeric strings');
  it('should handle very large numbers');
  it('should handle negative numbers');
  it('should handle decimal numbers');
});
```

### 5. Use Matchers Appropriately
Choose the right matcher for the assertion:

```typescript
// Good: Specific matcher
expect(user.age).toBeGreaterThan(0);

// Less specific: Generic matcher
expect(user.age > 0).toBe(true);
```

## Mocking and Spying

Vitest supports mocking through built-in functions:

### Function Mocking

```typescript
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('test');
mockFn.mockReturnValueOnce('first').mockReturnValueOnce('second');

// Mock implementations
mockFn.mockImplementation((arg: string) => arg.toUpperCase());

// Spy on function calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('test');
expect(mockFn).toHaveBeenCalledTimes(2);
```

### Module Mocking

```typescript
// Mock external modules
vi.mock('./api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'mocked' }))
}));
```

## Debugging Tests

### Console Logging
You can use `console.log` in tests - Vitest will show output:

```typescript
it('should debug something', () => {
  const result = complexCalculation();
  console.log('Result:', result); // Shows in test output
  expect(result).toBeDefined();
});
```

### Running Single Test
Focus on a single test by using `.only`:

```typescript
it.only('should run this test only', () => {
  // This test runs exclusively
});

it('should not run', () => {
  // This test is skipped
});
```

### Skipping Tests
Temporarily skip tests with `.skip`:

```typescript
it.skip('should be implemented later', () => {
  // This test is skipped
});
```

## Continuous Integration

### CI/CD Integration

Add to your CI pipeline:

```yaml
# Example for GitHub Actions
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

### Pre-commit Hooks

Consider adding a pre-commit hook to run tests:

```bash
# Using simple-git-hooks or husky
npx simple-git-hooks
```

## Troubleshooting

### Tests Not Found
- Ensure test files end with `.test.ts`
- Check that test files are in the correct directory
- Verify the test pattern in `vitest.config.ts`

### TypeScript Errors in Tests
- Ensure `tsconfig.json` includes test files
- Check that `@types/vitest` is installed if needed
- Verify TypeScript compiler options

### Coverage Not Working
- Ensure `@vitest/coverage-v8` is installed
- Check that coverage provider is configured
- Verify the `--coverage` flag is being used

## Advanced Features

### Parameterized Tests

```typescript
describe.each([
  { input: 'hello', expected: 'HELLO' },
  { input: 'world', expected: 'WORLD' },
])('toUpperCase($input)', ({ input, expected }) => {
  it(`should convert ${input} to ${expected}`, () => {
    expect(input.toUpperCase()).toBe(expected);
  });
});
```

### Test Suites

```typescript
describe('Authentication', () => {
  describe('when logged in', () => {
    beforeEach(() => {
      loginUser();
    });

    it('should show user profile');
    it('should allow logout');
  });

  describe('when logged out', () => {
    beforeEach(() => {
      logoutUser();
    });

    it('should redirect to login');
    it('should not show profile');
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest Assertion API](https://vitest.dev/guide/assertion.html)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
