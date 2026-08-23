# Quick Reference Card

Essential commands and patterns for quick reference during development.

## Essential Commands

### Development
```bash
npm run dev           # Run TypeScript directly (fastest for development)
npm run build         # Compile to JavaScript
npm start             # Run compiled version
```

### Testing
```bash
npm test              # Run tests (watch mode)
npm run test:coverage # With coverage report
```

### Quality Checks
```bash
npm run typecheck     # TypeScript types only
npm run lint          # Code quality check
npm run format        # Fix formatting
```

### Complete Workflow
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## TypeScript Patterns

### Function with Types
```typescript
function processData(input: string): Result {
  // Implementation
  return { success: true, data: input };
}
```

### Async Function
```typescript
async function fetchData(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return await response.json();
}
```

### Interface Definition
```typescript
interface User {
  id: string;
  name: string;
  email?: string;  // Optional
}
```

### Type Guards
```typescript
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

## Testing Patterns

### Basic Test
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Async Test
```typescript
it('should handle async', async () => {
  const result = await asyncOperation();
  expect(result).toBe('expected');
});
```

### Error Testing
```typescript
it('should throw error', () => {
  expect(() => riskyOperation()).toThrow('Error message');
});
```

## Common ESLint Fixes

### Missing Return Type
```typescript
// ❌ Error
function calculate(a: number, b: number) {
  return a + b;
}

// ✅ Fix
function calculate(a: number, b: number): number {
  return a + b;
}
```

### Floating Promise
```typescript
// ❌ Error
api.call();

// ✅ Fix
await api.call();
```

### Unused Variables
```typescript
// ❌ Error
function foo(unused: number) { }

// ✅ Fix
function foo(_unused: number) { }
```

## Import Patterns

### Type Imports
```typescript
import type { User } from './types';
import { UserService } from './services/user-service';
```

### Named Imports
```typescript
import { helper, anotherHelper } from './utils';
```

### Default Import
```typescript
import DocumentProcessor from './document-processor';
```

## Git Workflow

### Feature Branch
```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

### Bug Fix
```bash
git checkout -b fix/bug-description
# Fix bug
git add .
git commit -m "fix: resolve bug description"
git push origin fix/bug-description
```

## Commit Messages

```bash
feat: new feature
fix: bug fix
docs: documentation
refactor: code refactoring
test: adding tests
config: configuration changes
```

## Debugging

### Type Errors
```bash
npm run typecheck  # Specific type errors
```

### Test Failures
```bash
npm test -- --reporter=verbose  # Detailed test output
```

### Build Issues
```bash
npm run build -- --verbose      # Detailed build info
```

## File Structure Quick View

```
src/              # Your code goes here
tests/            # Tests go here
dist/             # Auto-generated, don't edit
docs/             # Documentation
```

## Configuration Files

- `tsconfig.json` - TypeScript settings
- `eslint.config.js` - Code quality rules
- `.prettierrc` - Formatting rules
- `package.json` - Project metadata

## Common Tasks

### Add New Functionality
1. Create file in `src/`
2. Write TypeScript with explicit types
3. Create test in `tests/`
4. Run `npm test` to verify
5. Run `npm run typecheck && npm run lint`

### Fix Bug
1. Create failing test
2. Fix code
3. Verify test passes
4. Run quality checks

### Update Dependencies
```bash
npm update          # Update packages
npm audit           # Check vulnerabilities
```

## Keyboard Shortcuts (VS Code)

- `Ctrl+P` - Quick file open
- `Ctrl+Shift+F` - Global search
- `F12` - Go to definition
- `Shift+F12` - Find references
- `Ctrl+` - Toggle terminal

## Environment Setup

### Install Everything
```bash
npm install
```

### Verify Setup
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### Clean Build
```bash
rm -rf node_modules dist
npm install
npm run build
```

## Troubleshooting Quick Fixes

### "Cannot find module"
```bash
npm install
```

### TypeScript errors
```bash
npm run typecheck  # See specific errors
```

### Tests not running
```bash
# Ensure test files end with .test.ts
# Check tests are in tests/ directory
```

## Quality Checklist

Before committing:
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Code is formatted (`npm run format`)
- [ ] Tests cover new functionality
- [ ] Documentation updated (if needed)

---

**Need more details?** See the comprehensive documentation in the parent directory.
