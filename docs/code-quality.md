# Code Quality Tools

Complete guide to code quality tools used in this project: ESLint and Prettier.

## ESLint (JavaScript/TypeScript Linting)

### What is ESLint?

ESLint is a static code analysis tool for identifying problematic patterns found in JavaScript and TypeScript applications. It helps enforce coding standards and catch potential bugs before runtime.

### Configuration File

ESLint is configured in `eslint.config.js` using the modern flat config format (ESLint 9.x).

### Current ESLint Setup

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,                      // JavaScript recommended rules
  ...tseslint.configs.recommended,                // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,    // TypeScript type-aware rules
  eslintConfigPrettier,                           // Disable rules that conflict with Prettier
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Custom unused variables rule with underscore exception
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
```

### ESLint Rules Explanation

#### Base Rules
- **JavaScript Best Practices**: Common JavaScript errors and pitfalls
- **TypeScript Specific**: TypeScript language patterns and issues
- **Type-Aware**: Advanced type checking during linting

#### Custom Rules

##### `explicit-function-return-type`
**Purpose**: Forces explicit return type annotations on functions

**Example**:
```typescript
// ✅ Good: Explicit return type
function calculateTotal(price: number, tax: number): number {
  return price + tax;
}

// ❌ Bad: Implicit return type
function calculateTotal(price: number, tax: number) {
  return price + tax;
}
```

**Why**: Makes function contracts explicit, improves code documentation

##### `no-floating-promises`
**Purpose**: Ensures promises are properly handled (awaited or returned)

**Example**:
```typescript
// ✅ Good: Promise is awaited
async function fetchData() {
  const result = await api.call();  // Properly awaited
  return result;
}

// ❌ Bad: Floating promise
async function fetchData() {
  api.call();  // Promise not awaited - could fail silently
}
```

**Why**: Prevents unhandled promise rejections and race conditions

##### `no-misused-promises`
**Purpose**: Ensures promises are used correctly in callbacks and conditionals

**Example**:
```typescript
// ❌ Bad: Promise in if statement
if (getUserAsync()) {  // This is always truthy
  console.log('User exists');
}

// ✅ Good: Properly handled
if (await getUserAsync()) {
  console.log('User exists');
}
```

**Why**: Prevents logic errors from treating promises as booleans

##### `no-unused-vars` with underscore pattern
**Purpose**: Reports unused variables but allows intentional ones with `_` prefix

**Example**:
```typescript
// ❌ Bad: Unused parameter
function processData(data: string, unused: number) {
  return data.toUpperCase();
}

// ✅ Good: Intentionally unused with underscore
function processData(data: string, _unused: number) {
  return data.toUpperCase();
}
```

**Why**: Allows for interface compliance while indicating intentional non-use

### Running ESLint

```bash
# Check all TypeScript files in src directory
npm run lint

# Check specific file
npm run lint path/to/file.ts

# Auto-fix issues where possible
npm run lint -- --fix
```

### ESLint Output

ESLint reports issues with:
- **File location**: Line and column numbers
- **Rule name**: Which rule was violated
- **Severity**: Error (red) or warning (yellow)
- **Message**: Description of the issue
- **Suggestion**: How to fix (when available)

Example output:
```
/path/to/file.ts
  5:3  error  Missing return type annotation  @typescript-eslint/explicit-function-return-type
  10:7  error  Promise not awaited            @typescript-eslint/no-floating-promises

✖ 2 problems (2 errors, 0 warnings)
```

### Common ESLint Issues and Solutions

#### Missing Return Type
```typescript
// ❌ Error
function processData(input: string) {
  return input.toUpperCase();
}

// ✅ Solution
function processData(input: string): string {
  return input.toUpperCase();
}
```

#### Floating Promise
```typescript
// ❌ Error
function fetchUserData() {
  api.getUser();  // Promise not handled
}

// ✅ Solutions:
// 1. Await it
async function fetchUserData() {
  const user = await api.getUser();
  return user;
}

// 2. Return it
function fetchUserData() {
  return api.getUser();
}

// 3. Explicitly ignore (rare)
async function fetchUserData() {
  void api.getUser();  // Intentionally not awaited
}
```

#### Unused Variables
```typescript
// ❌ Error
function calculate(a: number, b: number, extra: number) {
  return a + b;
}

// ✅ Solutions:
// 1. Remove unused parameter
function calculate(a: number, b: number) {
  return a + b;
}

// 2. Prefix with underscore
function calculate(a: number, b: number, _extra: number) {
  return a + b;
}
```

## Prettier (Code Formatter)

### What is Prettier?

Prettier is an opinionated code formatter that enforces a consistent style across your codebase. It reformats your code according to rules, eliminating debates about code style.

### Configuration File

Prettier is configured in `.prettierrc`:

```json
{
  "semi": true,                    // Add semicolons
  "trailingComma": "all",          // Add trailing commas
  "singleQuote": true,            // Use single quotes
  "printWidth": 100,              // Line width limit
  "tabWidth": 2,                   // Indentation size
  "useTabs": false                 // Use spaces, not tabs
}
```

### Prettier Rules Explained

#### `semi: true`
Adds semicolons to all statements:

```typescript
// ✅ Formatted
const name = 'John';
console.log(name);

// ❌ Without semicolons
const name = 'John'
console.log(name)
```

**Why**: Prevents ASI (Automatic Semicolon Insertion) issues

#### `trailingComma: "all"`
Adds trailing commas wherever possible:

```typescript
// ✅ Formatted
const user = {
  name: 'John',
  age: 30,
  email: 'john@example.com',
};

const numbers = [1, 2, 3,];

function greet(
  name: string,
  title: string,
) {
  // ...
}
```

**Why**: Easier to add/remove items, cleaner git diffs

#### `singleQuote: true`
Uses single quotes instead of double quotes:

```typescript
// ✅ Formatted
const message = 'Hello, World!';

// ❌ Double quotes
const message = "Hello, World!";
```

**Why**: Consistent with TypeScript conventions, saves space

#### `printWidth: 100`
Lines longer than 100 characters are wrapped:

```typescript
// ✅ Formatted (wrapped)
function longFunctionName(
  parameter1: string,
  parameter2: number,
  parameter3: boolean,
) {
  // ...
}

// ❌ Too long (would be wrapped)
function longFunctionName(parameter1: string, parameter2: number, parameter3: boolean) { // ... }
```

**Why**: Improves code readability, fits in standard editors

#### `tabWidth: 2` and `useTabs: false`
Uses 2 spaces for indentation (no tabs):

```typescript
// ✅ Formatted (2 spaces)
function example() {
  if (true) {
    console.log('Indented');
  }
}
```

**Why**: Consistent across editors, prevents tab/space mixing issues

### Running Prettier

```bash
# Check formatting without changing files
npm run format:check

# Format all TypeScript files
npm run format

# Format specific file
npx prettier --write path/to/file.ts

# Format and check in one command
npm run format && npm run format:check
```

### Prettier Integration

#### With ESLint
The project uses `eslint-config-prettier` to disable ESLint rules that conflict with Prettier. This ensures:
- Prettier handles formatting (quotes, spacing, etc.)
- ESLint handles code quality (unused vars, type errors, etc.)

#### With IDEs
Most IDEs can run Prettier automatically on save:
- **VS Code**: Install "Prettier - Code formatter" extension
- **WebStorm/IntelliJ**: Built-in Prettier support
- **Configuration**: Set Prettier as default formatter

### Code Style Examples

#### Object Formatting
```typescript
// Prettier formats this consistently:
const user = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    notifications: true,
  },
};
```

#### Function Parameters
```typescript
// Long parameter lists are wrapped:
function processUserData(
  userId: string,
  name: string,
  email: string,
  preferences: UserPreferences,
  metadata: Metadata,
): Promise<User> {
  // ...
}
```

#### Array Formatting
```typescript
// Long arrays are wrapped:
const permissions = [
  'read:users',
  'write:users',
  'delete:users',
  'admin:system',
];
```

#### Template Literals
```typescript
// Complex template literals are formatted:
const message = `Hello ${userName},

Your account has been created successfully.
Please check your email at ${email} to verify your account.

Best regards,
The Team`;
```

## Code Quality Workflow

### Development Workflow

1. **Write Code**: Focus on functionality
2. **Type Check**: `npm run typecheck` - Catch type errors
3. **Lint**: `npm run lint` - Check code quality
4. **Format**: `npm run format` - Fix formatting
5. **Test**: `npm test` - Verify behavior
6. **Build**: `npm run build` - Compile for production

### Pre-commit Workflow

Before committing code:

```bash
# Complete quality check
npm run typecheck && npm run lint && npm run test

# Or format first if needed
npm run format && npm run typecheck && npm run lint && npm run test
```

### Continuous Integration

Add to CI pipeline:

```bash
# CI runs these commands
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

## Best Practices

### 1. Code Style Consistency
- Let Prettier handle all formatting decisions
- Don't argue about code style in code reviews
- Trust the configuration

### 2. Type Safety
- Always run type checking before commits
- Fix type errors immediately
- Use explicit return types for exported functions

### 3. Linting
- Fix linting errors before committing
- Don't ignore linting warnings
- Use linting to learn best practices

### 4. Testing
- Write tests for new functionality
- Ensure all tests pass before committing
- Use tests to verify bug fixes

### 5. Code Review Focus
- Review logic and architecture, not style
- Style is enforced by tools
- Focus on behavior and correctness

## Troubleshooting

### ESLint Issues

#### "ESLint couldn't find configuration"
- Ensure `eslint.config.js` exists
- Check that ESLint dependencies are installed
- Verify Node.js version compatibility

#### Type-aware linting errors
- Ensure `tsconfig.json` is valid
- Check that TypeScript is properly configured
- Verify file inclusion patterns

### Prettier Issues

#### "File doesn't match configured formatter"
- Check file extension matches Prettier pattern
- Verify `.prettierrc` configuration
- Ensure Prettier plugin is installed

#### Formatting conflicts
- Run `npm run format` to fix
- Check for conflicting manual formatting
- Ensure Prettier runs before ESLint

### Integration Issues

#### ESLint and Prettier conflicts
- Ensure `eslint-config-prettier` is installed
- Check it's last in the config array
- Verify no overlapping rules

#### Performance issues
- Limit linting to changed files in CI
- Use caching for faster builds
- Consider incremental type checking

## Advanced Configuration

### Custom ESLint Rules

You can add custom rules to the configuration:

```javascript
{
  rules: {
    // Your custom rule
    'custom-rule-name': 'error',
    // Adjust rule severity
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
```

### Prettier Overrides

Override Prettier for specific files:

```json
{
  "overrides": [
    {
      "files": "*.md",
      "options": { "proseWrap": "never" }
    }
  ]
}
```

### File-Specific Configuration

Create `.eslintrc.js` or `.prettierrc` in subdirectories for project-specific rules.

## Resources

- [ESLint Documentation](https://eslint.org/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [Prettier Documentation](https://prettier.io/)
- [ESLint vs Prettier Integration](https://prettier.io/docs/en/integrating-with-linters.html)
