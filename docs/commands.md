# NPM Commands Reference

Complete reference of all available npm scripts in this project.

## Development Commands

### `npm run dev`
Runs TypeScript directly in development mode using `tsx`. This is the fastest way to develop as it skips the compilation step.

```bash
npm run dev
```

**Use case**: During active development when you want to see changes immediately without waiting for compilation.

**Output**: Executes `src/index.ts` and any console output

### `npm run dev:watch`
Runs TypeScript in development mode with file watching using `tsx`.

```bash
npm run dev:watch
```

**What it does**: Automatically restarts the application when TypeScript files change

**Use case**: During active development when you want automatic re-execution on file changes

**Output**: Executes `src/index.ts` and restarts on changes

### `npm run build`
Compiles TypeScript source files to JavaScript output.

```bash
npm run build
```

**What it does**:
- Compiles all `.ts` files from `src/` directory
- Outputs JavaScript to `dist/` directory
- Generates declaration files (`.d.ts`) for type information
- Creates source maps for debugging

**Use case**: Before deploying or running the production version

**Output**: Creates `dist/` directory with compiled files

### `npm start`
Runs the compiled JavaScript application.

```bash
npm start
```

**What it does**: Executes `node dist/index.js`

**Use case**: Running the production version after compilation

**Note**: You must run `npm run build` first

## Testing Commands

### `npm test`
Runs all tests using Vitest.

```bash
npm test
```

**What it does**:
- Runs all test files matching `*.test.ts` pattern
- Executes tests in watch mode by default
- Provides interactive output

**Use case**: Continuous testing during development

### `npm run test:coverage`
Runs tests with code coverage report.

```bash
npm run test:coverage
```

**What it does**:
- Runs all tests
- Generates coverage statistics
- Creates coverage report in `coverage/` directory

**Output**: Percentage coverage for statements, branches, functions, and lines

## Code Quality Commands

### `npm run lint`
Analyzes code for potential errors and code quality issues using ESLint.

```bash
npm run lint
```

**What it checks**:
- TypeScript syntax errors
- Code quality issues
- Potential bugs
- Best practice violations
- Unused variables and imports

**Use case**: Before committing code or during development

### `npm run format`
Formats all TypeScript files using Prettier.

```bash
npm run format
```

**What it does**:
- Reformats all `.ts` files in `src/` directory
- Applies consistent code style
- Fixes formatting inconsistencies

**Use case**: When code doesn't follow project formatting standards

### `npm run format:check`
Checks if files are properly formatted without making changes.

```bash
npm run format:check
```

**What it does**: Verifies that all files follow Prettier formatting rules

**Use case**: In CI/CD pipelines or before commits

**Exit code**: Returns error if files need formatting

## Type Checking Commands

### `npm run typecheck`
Performs TypeScript type checking without generating JavaScript output.

```bash
npm run typecheck
```

**What it does**:
- Validates all TypeScript types
- Checks for type errors
- Verifies type safety
- Does not compile to JavaScript

**Use case**: Quick type validation without compilation overhead

**Speed**: Faster than full build, ideal for quick checks

## Command Combinations

### Full Validation Pipeline
Run all quality checks before committing:

```bash
npm run typecheck && npm run lint && npm test
```

### Development Workflow
Typical development sequence:

```bash
# During development
npm run dev

# Test your changes
npm test

# Check types and quality
npm run typecheck && npm run lint

# Format if needed
npm run format

# Build for production
npm run build

# Run production version
npm start
```

### Quick Quality Check
Validate everything quickly:

```bash
npm run typecheck && npm run lint && echo "✅ All checks passed!"
```

## Troubleshooting

### "Cannot find module" errors
- Run `npm install` to ensure all dependencies are installed
- Check that `node_modules/` directory exists

### TypeScript errors during build
- Run `npm run typecheck` to see specific type errors
- Check `tsconfig.json` configuration
- Ensure all imports are correctly typed

### ESLint not working
- Verify `eslint.config.js` exists and is valid
- Check that ESLint dependencies are installed
- Try `npm install --save-dev @eslint/js typescript-eslint`

### Tests not running
- Ensure test files end with `.test.ts`
- Check that `vitest` is installed
- Verify test syntax matches Vitest expectations

## Useful Tips

1. **Speed**: Use `npm run dev` for fastest development iteration
2. **Safety**: Run `npm run typecheck` before builds for early error detection
3. **Quality**: Make `npm run lint` part of your pre-commit workflow
4. **Testing**: Use `npm test` in watch mode during active development
5. **Production**: Always `npm run build` before `npm start` in production
