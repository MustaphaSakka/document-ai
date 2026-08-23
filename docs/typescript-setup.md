# TypeScript Configuration

Comprehensive documentation of the TypeScript setup and configuration in this project.

## Compiler Options Overview

This project uses TypeScript 5.9 with strict type checking enabled. The configuration is defined in `tsconfig.json`.

### Target and Module System

```json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

**ES2022**: Modern JavaScript features supported by current Node.js versions
- Async/await
- Classes, modules, destructuring
- Modern array methods and built-ins

**NodeNext**: Latest Node.js module system
- Supports both CommonJS (`require`) and ES modules (`import`)
- Automatic package.json `"type"` field detection
- File extension resolution (`.js`, `.mjs`, `.cjs`)

### Strict Type Checking

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true,
  "noImplicitThis": true,
  "alwaysStrict": true
}
```

These options catch common errors at compile time:

#### `strict: true`
Enables all strict type checking options (master switch)

#### `noImplicitAny: true`
Prevents variables from implicitly having `any` type
- Forces explicit type annotations
- Catches potential type errors early

#### `strictNullChecks: true`
Distinguishes between `null`, `undefined`, and defined values
- Prevents null/undefined errors
- Forces proper null handling

#### `strictFunctionTypes: true`
Enforces strict function type checking
- Prevents unsafe function type assignments
- Ensures function parameter contravariance

#### `strictBindCallApply: true`
Enforces strict rules for `call()`, `apply()`, and `bind()`
- Ensures type-safe function method calls

#### `strictPropertyInitialization: true`
Ensures class properties are initialized
- Prevents undefined class properties
- Forces constructors to initialize all properties

#### `noImplicitThis: true`
Prevents `this` from having implicit `any` type
- Forces explicit `this` typing in functions

#### `alwaysStrict: true`
Emits `"use strict"` for every source file
- Ensures consistent strict mode parsing

### Additional Type Safety

```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true
}
```

#### `noUnusedLocals: true`
Reports errors on unused local variables
- Helps keep code clean
- Removes dead code

#### `noUnusedParameters: true`
Reports errors on unused function parameters
- Note: Parameters prefixed with `_` are ignored: `function foo(_unused: string, used: number)`

#### `noImplicitReturns: true`
Reports errors when code paths don't return values
- Ensures all function branches return expected types
- Prevents undefined return values

#### `noFallthroughCasesInSwitch: true`
Reports errors for fallthrough cases in switch statements
- Requires `break` or `return` in each case
- Prevents unintended execution

#### `noUncheckedIndexedAccess: true`
Adds `undefined` to indexed access types
- `array[5]` returns `T | undefined` instead of `T`
- Forces bounds checking on array/object access

#### `noImplicitOverride: true`
Requires `override` keyword when overriding base class methods
- Prevents accidental method overrides
- Makes inheritance intentions explicit

#### `noPropertyAccessFromIndexSignature: true`
Prevents accessing properties from index signature types
- Forces proper type checking for dynamic property access

### Output Configuration

```json
{
  "outDir": "./dist",
  "rootDir": "./src",
  "sourceMap": true,
  "declaration": true,
  "declarationMap": true,
  "removeComments": false,
  "preserveConstEnums": true
}
```

#### `outDir: "./dist"`
Directory for compiled JavaScript output

#### `rootDir: "./src"`
Root directory of TypeScript source files

#### `sourceMap: true`
Generates `.js.map` files for debugging
- Enables source-level debugging in browsers and IDEs
- Maps compiled code back to TypeScript sources

#### `declaration: true`
Generates `.d.ts` declaration files
- Provides type information for compiled code
- Enables type checking when using the compiled output

#### `declarationMap: true`
Generates `.d.ts.map` declaration map files
- Enables IDE navigation to original TypeScript sources
- Improves developer experience

#### `removeComments: false`
Preserves comments in compiled output
- Keeps documentation in the generated JavaScript

#### `preserveConstEnums: true`
Preserves `const enum` definitions at runtime
- Enables inlining of enum values

### Module Resolution

```json
{
  "resolveJsonModule": true,
  "isolatedModules": true,
  "allowSyntheticDefaultImports": true,
  "esModuleInterop": true
}
```

#### `resolveJsonModule: true`
Allows importing JSON files
- Enables `import data from './data.json'`

#### `isolatedModules: true`
Ensures each file can be compiled independently
- Required for certain build tools (Babel, Vite)
- Forces correct export/import usage

#### `allowSyntheticDefaultImports: true`
Allows default imports from modules with no default export
- Improves interoperability with CommonJS modules

#### `esModuleInterop: true`
Enables ES module import syntax with CommonJS modules
- Provides better import behavior for mixed module systems

### Include and Exclude

```json
{
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

#### `include: ["src/**/*"]`
Files to include in compilation
- All TypeScript files in `src/` directory

#### `exclude: [...]`
Files to exclude from compilation
- `node_modules`: External dependencies
- `dist`: Compiled output (prevent double compilation)
- `**/*.test.ts`: Test files (not part of application code)

## Type Safety Benefits

The strict TypeScript configuration provides these advantages:

### 1. Early Error Detection
- Catches type errors at compile time, not runtime
- Prevents null/undefined exceptions
- Eliminates `this` context bugs

### 2. Better IDE Support
- Accurate autocomplete suggestions
- Parameter information and type hints
- Refactoring confidence

### 3. Self-Documenting Code
- Types serve as inline documentation
- Function signatures show usage expectations
- Reduced need for separate documentation

### 4. Refactoring Safety
- Catch breaking changes during compilation
- Ensures all usages are updated
- Prevents subtle bugs from interface changes

## Common TypeScript Patterns

### Type Annotations

```typescript
// Function with explicit return type
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

// Interface for object types
interface User {
  name: string;
  age: number;
  email?: string; // Optional property
}

// Type aliases for complex types
type ID = string;
type UserMap = Map<ID, User>;
```

### Async/Await

```typescript
async function fetchData(url: string): Promise<User> {
  const response = await fetch(url);
  return await response.json();
}
```

### Error Handling

```typescript
try {
  const result = await riskyOperation();
  console.log(result);
} catch (error) {
  // TypeScript knows error is 'unknown' type
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

## Best Practices

1. **Always use explicit return types** for exported functions
2. **Avoid `any` type** - use `unknown` for truly unknown data
3. **Handle undefined** for optional values and array access
4. **Use interfaces** for object shapes, types for unions/intersections
5. **Prefer `const` and `readonly`** for immutable data
6. **Use type guards** for runtime type checking
7. **Enable strict mode** in all new projects

## Migration from JavaScript

When adding TypeScript to existing JavaScript code:

1. Start with `allowJs: true` to mix JS and TS
2. Gradually add type annotations
3. Enable strict options one by one
4. Fix type errors incrementally
5. Eventually enable full `strict: true`

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
