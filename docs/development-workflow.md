# Development Workflow

Complete guide to the development workflow, from initial setup to deployment, using the tools and configurations in this project.

## Overview

This project follows a modern TypeScript development workflow focused on type safety, code quality, and rapid iteration. The workflow emphasizes:
- **Type-first development**: Catch errors at compile time
- **Continuous testing**: Verify behavior throughout development
- **Code quality**: Maintain high standards with automated tools
- **Fast iteration**: Quick feedback cycles for efficient development

## Initial Setup

### Prerequisites

Before starting development, ensure you have:
- **Node.js**: Version 18+ (recommended: latest LTS)
- **npm**: Version 9+ (comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code (recommended) or similar

### First-Time Setup

1. **Clone the repository** (if not already done):
```bash
git clone <repository-url>
cd document-ai
```

2. **Install dependencies**:
```bash
npm install
```

3. **Verify the setup**:
```bash
npm run typecheck  # Should complete without errors
npm run lint       # Should find no issues
npm test           # Should pass all tests
npm run build      # Should compile successfully
npm start          # Should run the application
```

## Development Cycle

### 1. Planning and Understanding

Before writing code:
- **Read existing code**: Understand current patterns and conventions
- **Review requirements**: Clarify what needs to be built
- **Check dependencies**: Identify if new packages are needed
- **Plan approach**: Consider TypeScript types and testing strategy

### 2. Implementation Phase

#### Start with Types
```typescript
// Define interfaces first
interface Document {
  id: string;
  name: string;
  content: string;
  metadata?: DocumentMetadata;
}

interface DocumentMetadata {
  author: string;
  createdAt: Date;
  tags: string[];
}
```

#### Write Type-Safe Functions
```typescript
// Explicit return types and parameter types
function processDocument(doc: Document): ProcessedDocument {
  // Implementation
  return {
    ...doc,
    processed: true,
    processedAt: new Date(),
  };
}
```

#### Use Modern TypeScript Features
```typescript
// Async/await for asynchronous operations
async function fetchDocument(id: string): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`);
  return await response.json();
}

// Type guards for runtime type checking
function isDocument(obj: unknown): obj is Document {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'content' in obj
  );
}
```

### 3. Testing Phase

#### Write Tests Alongside Code
```typescript
// tests/document-processor.test.ts
import { describe, it, expect } from 'vitest';
import { processDocument } from '../src/document-processor';

describe('processDocument', () => {
  it('should process document with valid input', () => {
    const input: Document = {
      id: '123',
      name: 'Test Document',
      content: 'Test content',
    };

    const result = processDocument(input);

    expect(result.processed).toBe(true);
    expect(result.processedAt).toBeInstanceOf(Date);
  });
});
```

#### Test Edge Cases
```typescript
describe('processDocument edge cases', () => {
  it('should handle empty content', () => {
    const input: Document = {
      id: '123',
      name: 'Empty Document',
      content: '',
    };

    const result = processDocument(input);

    expect(result.processed).toBe(false);
  });

  it('should handle missing metadata', () => {
    const input: Document = {
      id: '123',
      name: 'No Metadata',
      content: 'Content',
      // metadata omitted
    };

    const result = processDocument(input);

    expect(result.metadata).toBeUndefined();
  });
});
```

### 4. Quality Check Phase

#### Run Type Checking
```bash
npm run typecheck
```

**What to look for**:
- Type mismatches
- Missing return types
- Implicit any types
- Unused variables

#### Run Linting
```bash
npm run lint
```

**What to look for**:
- Code quality issues
- Unused code
- Potential bugs
- Style violations

#### Format Code
```bash
npm run format
```

**Purpose**: Ensure consistent code style across the project

### 5. Build and Verification

#### Compile the Project
```bash
npm run build
```

**What happens**:
- TypeScript compiles to JavaScript
- Type definitions are generated
- Source maps are created
- Output goes to `dist/` directory

#### Run Tests
```bash
npm test
```

**What to verify**:
- All tests pass
- No unexpected failures
- Coverage is adequate

#### Run the Application
```bash
npm start
```

**What to test**:
- Application runs without errors
- Basic functionality works
- No runtime exceptions

## Daily Development Commands

### Quick Development Cycle

```bash
# Development mode (fast iteration)
npm run dev

# In another terminal, run tests in watch mode
npm test

# Make changes, files auto-recompile and tests auto-run
```

### Quality Check Cycle

```bash
# Complete quality check
npm run typecheck && npm run lint && npm test && echo "✅ Ready to commit"
```

### Pre-Commit Checklist

```bash
# Format code
npm run format

# Check types
npm run typecheck

# Check code quality
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Verify production run
npm start
```

## Git Workflow

### Commit Messages

Follow conventional commit format:

```bash
# Feature
git commit -m "feat: add document upload functionality"

# Bug fix
git commit -m "fix: resolve null reference in document processing"

# Documentation
git commit -m "docs: update API documentation"

# Refactoring
git commit -m "refactor: simplify document validation logic"

# Configuration
git commit -m "config: update TypeScript to version 5.9"

# Tests
git commit -m "test: add integration tests for S3 service"
```

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/document-processing

# Make changes and commit
git add .
git commit -m "feat: implement document processing"

# Push to remote
git push origin feature/document-processing

# Create pull request for review
```

### Pre-Commit Hooks (Optional)

Consider setting up git hooks for automated checks:

```bash
# Install simple-git-hooks
npm install --save-dev simple-git-hooks

# Add to package.json scripts
"prepare": "simple-git-hooks"

# Create .simple-git-hooks.json
{
  "pre-commit": "npm run typecheck && npm run lint && npm test",
  "pre-push": "npm run typecheck && npm test"
}
```

## Troubleshooting Workflow

### TypeScript Errors

#### Type Not Found
```typescript
// ❌ Error: Cannot find module './utils'
import { helper } from './utils';

// ✅ Solution: Check file path and extension
import { helper } from './utils/helper';
// or
import { helper } from './utils/helper.ts';
```

#### Implicit Any
```typescript
// ❌ Error: Parameter 'data' implicitly has 'any' type
function processData(data) {
  return data.value;
}

// ✅ Solution: Add explicit type
function processData(data: { value: string }): string {
  return data.value;
}
```

#### Promise Not Awaited
```typescript
// ❌ Error: Promise not awaited
async function fetchData() {
  api.call();  // Floating promise
}

// ✅ Solution: Await or return
async function fetchData() {
  return await api.call();
}
```

### Test Failures

#### Test Not Found
```bash
# ❌ Error: No test files found
npm test

# ✅ Solution: Check test file naming and location
# - Ensure files end with .test.ts
# - Verify files are in tests/ directory
# - Check vitest configuration
```

#### Timeout Errors
```typescript
// ❌ Test times out
it('should complete quickly', async () => {
  await longRunningOperation();  // Takes too long
});

// ✅ Solution: Increase timeout or fix performance
it('should complete quickly', async () => {
  await longRunningOperation();
}, 10000);  // 10 second timeout
```

### Build Issues

#### Compilation Errors
```bash
# ❌ Build fails with TypeScript errors
npm run build

# ✅ Solution: Run typecheck first for clearer errors
npm run typecheck
# Fix reported issues, then build again
```

#### Module Resolution
```typescript
// ❌ Error: Cannot find module
import { Something } from 'package';

// ✅ Solution: Install missing package
npm install package
npm install --save-dev @types/package  # If types are needed
```

## Performance Optimization

### Development Performance

#### Fast Iteration
```bash
# Use ts-node for fastest development
npm run dev

# Avoid rebuilding on every change
# Use watch mode for tests
npm test
```

#### Selective Building
```bash
# Build only what you need
npm run build

# Use incremental compilation (automatic in tsconfig)
# TypeScript only recompiles changed files
```

### Production Optimization

#### Tree Shaking
```typescript
// ✅ Good: Import specific functions
import { processDocument } from './services';

// ❌ Avoid: Import entire module when not needed
import * as Services from './services';
```

#### Code Splitting
```typescript
// Lazy load heavy dependencies
const heavyModule = await import('./heavy-processing');
heavyModule.processLargeFile(file);
```

## Continuous Integration

### CI Pipeline Steps

```yaml
# Example CI workflow
steps:
  - name: Install dependencies
    run: npm install

  - name: Type check
    run: npm run typecheck

  - name: Lint
    run: npm run lint

  - name: Test
    run: npm test

  - name: Build
    run: npm run build

  - name: Run production build
    run: npm start
```

### Automated Quality Gates

```bash
# All checks must pass
npm run typecheck  # Type safety gate
npm run lint       # Code quality gate
npm test           # Behavior verification gate
npm run build      # Compilation gate
```

## Best Practices

### 1. Type-First Development
- Define interfaces before implementation
- Use TypeScript's type system to guide development
- Leverage types for self-documenting code

### 2. Continuous Testing
- Write tests alongside code
- Run tests frequently during development
- Use test coverage as a guide, not a goal

### 3. Code Quality
- Fix linting errors immediately
- Format code before committing
- Review code for potential issues

### 4. Incremental Development
- Work in small, verifiable increments
- Test each increment before moving on
- Commit frequently with clear messages

### 5. Documentation
- Document complex logic with comments
- Keep README files updated
- Update documentation when features change

## Common Development Scenarios

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/new-functionality

# 2. Create source files
mkdir src/services
touch src/services/new-service.ts

# 3. Create test files
touch tests/services/new-service.test.ts

# 4. Implement with tests
# - Write test first (TDD) or alongside code
# - Use strict TypeScript types
# - Run tests frequently

# 5. Quality checks
npm run typecheck && npm run lint && npm test

# 6. Build and verify
npm run build && npm start

# 7. Commit changes
git add .
git commit -m "feat: add new functionality"

# 8. Push and create PR
git push origin feature/new-functionality
```

### Fixing a Bug

```bash
# 1. Create bug fix branch
git checkout -b fix/bug-description

# 2. Write failing test
# - Add test that reproduces the bug
# - Verify test fails

# 3. Fix the bug
# - Make minimal changes to fix
# - Ensure test now passes

# 4. Add regression tests
# - Test edge cases
# - Prevent future occurrences

# 5. Quality checks
npm run typecheck && npm run lint && npm test

# 6. Commit and push
git commit -m "fix: resolve [bug description]"
git push origin fix/bug-description
```

### Refactoring Code

```bash
# 1. Create refactor branch
git checkout -b refactor/code-improvement

# 2. Ensure tests pass
npm test

# 3. Make incremental changes
# - Change one thing at a time
# - Run tests after each change
# - Maintain functionality

# 4. Update types if needed
# - Improve type definitions
# - Add missing types

# 5. Quality checks
npm run typecheck && npm run lint && npm test

# 6. Commit and push
git commit -m "refactor: improve code structure"
git push origin refactor/code-improvement
```

## Learning and Improvement

### Skill Development

#### TypeScript Concepts
- **Type System**: Understand advanced types (generics, conditional types)
- **Compiler API**: Learn how TypeScript compiles code
- **Declaration Files**: Create `.d.ts` files for libraries

#### Node.js Patterns
- **Async Patterns**: Promises, async/await, event-driven architecture
- **Stream Processing**: Handle large files efficiently
- **Error Handling**: Proper error propagation and handling

#### Testing Practices
- **Test-Driven Development**: Write tests before implementation
- **Behavior-Driven Development**: Focus on user behavior
- **Property-Based Testing**: Test with generated inputs

### Continuous Learning

1. **Read Documentation**: Stay updated with TypeScript and Node.js docs
2. **Review Code**: Learn from existing code and PR reviews
3. **Experiment**: Try new patterns in isolation before using in project
4. **Teach**: Explain concepts to reinforce understanding

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Testing Best Practices](https://testingjavascript.com/)
- [Git Workflow Guide](https://www.atlassian.com/git/tutorials/comparing-workflows)
