# Document AI

A document processing application built with Node.js and TypeScript, designed to integrate with AWS services (S3, Textract, Bedrock).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## 📋 Project Overview

This project is a learning-focused document processing application that demonstrates modern Node.js and TypeScript development practices. The goal is to build expertise in Node.js and TypeScript while creating a functional document processing system.

### Current Status
- ✅ **TypeScript 5.9** with strict type checking
- ✅ **Vitest** testing framework setup
- ✅ **ESLint + Prettier** code quality tools
- ✅ **Modern development workflow** with hot reload
- 🔄 **AWS Integration**: Coming soon (S3, Textract, Bedrock)

## 🛠️ Tech Stack

### Core Technologies
- **Node.js**: JavaScript runtime
- **TypeScript 5.9**: Type-safe JavaScript
- **Vitest**: Modern testing framework
- **ESLint**: Code quality and linting
- **Prettier**: Code formatting

### Development Tools
- **ts-node**: Run TypeScript directly in development
- **npm**: Package management and scripts

### Planned AWS Integration
- **Amazon S3**: Document storage
- **AWS Textract**: Document text extraction
- **Amazon Bedrock**: AI/ML services

## 📁 Project Structure

```
document-ai/
├── src/                   # TypeScript source code
│   └── index.ts          # Entry point
├── tests/                 # Test files
│   └── example.test.ts   # Example tests
├── docs/                  # Technical documentation
├── dist/                  # Compiled JavaScript (generated)
├── package.json           # Project metadata and scripts
├── tsconfig.json          # TypeScript configuration
├── eslint.config.js       # ESLint configuration
└── .prettierrc           # Prettier configuration
```

## 🎯 Available Commands

### Development
```bash
npm run dev          # Run TypeScript in development
npm run build        # Compile TypeScript to JavaScript
npm start            # Run compiled JavaScript
```

### Testing
```bash
npm test             # Run all tests
npm run test:coverage  # Run tests with coverage
```

### Code Quality
```bash
npm run lint         # Check code quality
npm run format       # Format code with Prettier
npm run typecheck    # Type check without compilation
```

## 📚 Documentation

Comprehensive technical documentation is available in the [docs/](docs/) directory:

### Key Documentation
- **[Commands Reference](docs/commands.md)** - All available npm commands
- **[TypeScript Setup](docs/typescript-setup.md)** - TypeScript configuration and best practices
- **[Testing Guide](docs/testing-guide.md)** - Testing with Vitest
- **[Code Quality Tools](docs/code-quality.md)** - ESLint and Prettier guide
- **[Project Structure](docs/project-structure.md)** - Codebase organization
- **[Development Workflow](docs/development-workflow.md)** - Complete development process
- **[Documentation Index](docs/README.md)** - Guide to all documentation

## 🎓 Learning Objectives

This project focuses on developing expertise in:
- **Modern TypeScript**: Strict type checking, advanced types, patterns
- **Node.js Patterns**: Async/await, streams, error handling
- **Testing Practices**: Test-driven development, coverage, patterns
- **Code Quality**: Linting, formatting, best practices
- **Development Workflow**: Modern development practices

## 🏗️ Architecture Principles

### Current Approach
- **Minimal Foundation**: Start with essential tools only
- **Type-Safe Development**: Leverage TypeScript's type system
- **Test-Driven**: Write tests alongside code
- **Iterative Growth**: Add structure as needed
- **Learning-Focused**: Understand underlying concepts

### Future Evolution
As requirements emerge, the project will naturally evolve to include:
- Service layer for AWS integration
- Configuration management
- Type definitions for domain objects
- Utility libraries for common tasks

## 🔧 Configuration

### TypeScript
- **Strict mode enabled** for maximum type safety
- **Target**: ES2022 (modern JavaScript)
- **Module**: NodeNext (latest Node.js modules)
- **Output**: `dist/` directory with source maps

### Code Quality
- **ESLint**: TypeScript-specific rules with type checking
- **Prettier**: Consistent code formatting (single quotes, 2-space indent)
- **Integration**: ESLint and Prettier work together seamlessly

### Testing
- **Framework**: Vitest with TypeScript support
- **Coverage**: Built-in coverage reporting
- **Watch mode**: Automatic test re-running on file changes

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ (recommended: latest LTS)
- npm 9+ (comes with Node.js)
- Git (for version control)

### Initial Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Verify setup**:
   ```bash
   npm run typecheck  # Check TypeScript types
   npm run lint       # Check code quality
   npm test           # Run tests
   npm run build      # Compile TypeScript
   npm start          # Run application
   ```

3. **Start development**:
   ```bash
   npm run dev  # Runs TypeScript directly
   ```

## 📖 Development Workflow

### 1. Planning
- Review existing code and conventions
- Understand requirements
- Plan TypeScript types and testing strategy

### 2. Implementation
- Define TypeScript interfaces first
- Implement with explicit types
- Write tests alongside code
- Run tests frequently

### 3. Quality Check
```bash
npm run typecheck  # Type checking
npm run lint       # Code quality
npm run format     # Formatting
npm test           # Testing
```

### 4. Build and Verify
```bash
npm run build      # Compile
npm start          # Run production version
```

## 🧪 Testing

### Current Tests
- Basic setup verification (4 passing tests)
- Type safety validation
- Async/await functionality
- TypeScript type handling

### Running Tests
```bash
npm test              # Run all tests (watch mode)
npm run test:coverage # Run with coverage report
```

### Test Structure
```
tests/
└── example.test.ts   # Setup verification tests
```

## 🔍 Code Quality Standards

### TypeScript Standards
- **Strict type checking** enabled
- **Explicit return types** for all functions
- **No implicit any** types
- **Comprehensive type definitions**

### Code Style
- **Single quotes** for strings
- **2-space indentation**
- **Trailing commas** where applicable
- **Semicolons required**

### Quality Checks
- **ESLint**: Type-aware linting with strict rules
- **Prettier**: Consistent code formatting
- **TypeScript**: Compile-time type checking

## 🛣️ Roadmap

### Phase 1: Foundation (Current)
- ✅ TypeScript + Node.js setup
- ✅ Testing framework
- ✅ Code quality tools
- ✅ Development workflow

### Phase 2: Core Features (Next)
- Document upload functionality
- File processing utilities
- Error handling and validation
- Logging and monitoring

### Phase 3: AWS Integration (Future)
- S3 storage integration
- Textract document processing
- Bedrock AI services
- AWS authentication and configuration

### Phase 4: Enhancement (Future)
- Batch processing
- Document workflows
- API endpoints
- User interface

## 🤝 Contributing

### Development Guidelines
1. **Read the documentation**: Start with [docs/README.md](docs/README.md)
2. **Follow the workflow**: Use the established development process
3. **Write tests**: Ensure all code is tested
4. **Maintain quality**: Fix all linting and type issues
5. **Document changes**: Update relevant documentation

### Code Review Process
- All changes go through pull requests
- Automated checks must pass
- Code quality standards maintained
- Documentation updated as needed

## 📞 Support

### Documentation
- Comprehensive guides in [docs/](docs/) directory
- [Documentation Index](docs/README.md) for navigation
- Troubleshooting sections in each guide

### Learning Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Documentation](https://nodejs.org/docs)
- [Vitest Documentation](https://vitest.dev/)

## 📄 License

ISC

## 👤 Author

Building expertise in Node.js and TypeScript through practical application development.

---

**Note**: This project is designed for learning and skill development. The focus is on understanding modern Node.js and TypeScript practices rather than rapid feature delivery. Quality, type safety, and maintainability are prioritized over speed.

For detailed technical documentation, see the [docs/](docs/) directory.
