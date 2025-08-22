# Contributing to Proto.io

Thank you for your interest in contributing to Proto.io! This document provides guidelines and information for contributors.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Submitting Changes](#submitting-changes)
7. [Release Process](#release-process)

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- PostgreSQL (for running tests)
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/proto.io.git
cd proto.io
```

3. Add the upstream remote:
```bash
git remote add upstream https://github.com/o2ter/proto.io.git
```

## Development Setup

### Install Dependencies

```bash
npm install
```

### Environment Setup

Create a `.env` file for testing:

```bash
# Database for testing
DATABASE_URL=postgresql://postgres:password@localhost:5432/proto_io_test

# Test configuration
SERVER_URL=http://localhost:1337/api
JWT_SECRET=test_jwt_secret
MASTER_KEY=test_master_key

# Optional: Redis for pub/sub testing
REDIS_URL=redis://localhost:6379
```

### Build the Project

```bash
npm run rollup
```

### Run Tests

```bash
npm test
```

## Project Structure

```
src/
├── index.ts                 # Main entry point and exports
├── client/                  # Client-side SDK
│   ├── index.ts            # Client exports
│   ├── options.ts          # Configuration types
│   ├── query.ts            # Query builder
│   ├── request.ts          # HTTP client
│   └── proto/              # Protocol implementation
├── server/                  # Server-side implementation
│   ├── auth/               # Authentication middleware
│   ├── crypto/             # Cryptographic utilities
│   ├── file/               # File handling
│   ├── proto/              # Core service
│   ├── pubsub/             # Real-time messaging
│   ├── query/              # Query processing
│   ├── routes/             # API routes
│   ├── storage/            # Storage interface
│   └── utils.ts            # Utilities
├── internals/              # Internal types and utilities
│   ├── buffer.ts           # Buffer operations
│   ├── codec.ts            # Serialization
│   ├── const.ts            # Constants
│   ├── options.ts          # Option types
│   ├── private.ts          # Private symbols
│   ├── schema.ts           # Schema definitions
│   ├── types.ts            # Core types
│   ├── utils.ts            # Utility functions
│   ├── liveQuery/          # Live query system
│   ├── object/             # Object types
│   ├── proto/              # Protocol types
│   └── query/              # Query types
└── adapters/               # Storage and file adapters
    ├── file/               # File storage adapters
    └── storage/            # Database adapters
```

### Key Components

#### Server Layer
- **ProtoService**: Main service class orchestrating all operations
- **Route Handlers**: Express.js route handlers for API endpoints
- **Query Processor**: Translates Proto.io queries to database queries
- **Authentication**: JWT-based auth with role-based permissions

#### Client Layer
- **ProtoClient**: Main client class for API communication
- **Query Builder**: Type-safe query construction
- **Real-time Client**: WebSocket-based live queries

#### Adapters
- **Storage Adapters**: Database abstraction (PostgreSQL, SQL base)
- **File Adapters**: File storage abstraction (Database, Filesystem, Cloud)

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript**: Enable all strict checks
2. **Type everything**: Avoid `any` types when possible
3. **Use interfaces for public APIs**: Prefer interfaces over types for external APIs
4. **Generic constraints**: Use proper generic constraints

```typescript
// Good
interface QueryOptions<T extends string> {
  className: T;
  limit?: number;
}

// Avoid
function query(options: any): any {
  // ...
}
```

### Code Style

We use ESLint and Prettier for code formatting. Run before committing:

```bash
npm run lint
npm run format
```

### Naming Conventions

- **Classes**: PascalCase (`ProtoService`, `PostgresStorage`)
- **Functions/Methods**: camelCase (`createUser`, `findAll`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)
- **Files**: kebab-case (`proto-service.ts`, `user-routes.ts`)
- **Interfaces**: PascalCase with `T` prefix for types (`TUser`, `TQuery`)

### Documentation

- **JSDoc comments**: Document all public APIs
- **README updates**: Update documentation for new features
- **Examples**: Include usage examples for new functionality

```typescript
/**
 * Creates a new query for the specified class.
 * @param className - The name of the class to query
 * @returns A new query instance
 * @example
 * ```typescript
 * const posts = await proto.Query('Post').find();
 * ```
 */
Query<T extends string>(className: T): TQuery<T, Ext, boolean>
```

## Testing

### Test Structure

Tests are organized by feature area:

```
tests/
├── codec/              # Serialization tests
├── event/              # Event system tests
├── extends/            # Class extension tests
├── job/                # Background job tests
├── liveQuery/          # Live query tests
├── query/              # Query system tests
│   ├── crud/           # CRUD operation tests
│   ├── expr/           # Expression tests
│   ├── permission/     # Permission tests
│   └── relation/       # Relation tests
├── random/             # Random utilities tests
├── reference/          # Reference tests
├── request/            # HTTP request tests
├── storage/            # Storage adapter tests
├── triggers/           # Trigger tests
├── unique/             # Uniqueness tests
└── vector/             # Vector operation tests
```

### Writing Tests

Use Jest for testing:

```typescript
describe('ProtoService', () => {
  let proto: ProtoService;

  beforeEach(async () => {
    proto = new ProtoService({
      // Test configuration
    });
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  it('should create objects', async () => {
    const user = await proto.Query('User').insert({
      username: 'testuser',
      email: 'test@example.com'
    }, { master: true });

    expect(user.get('username')).toBe('testuser');
    expect(user.id).toBeTruthy();
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions/methods
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete workflows
4. **Performance Tests**: Test query performance and scaling

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=query

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Submitting Changes

### Branch Naming

Use descriptive branch names:

- `feature/live-query-improvements`
- `fix/postgres-connection-leak`
- `docs/api-reference-update`
- `refactor/query-builder-types`

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

Examples:
```
feat(query): add vector similarity search support

Add support for vector fields and similarity search operations
using cosine distance. Includes PostgreSQL pgvector integration.

Closes #123

fix(auth): prevent session token reuse after logout

Session tokens are now invalidated on logout to prevent
security issues with token reuse.

docs(readme): update installation instructions

Add requirements for PostgreSQL and update setup steps
for development environment.
```

### Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** following coding standards
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Run the test suite** and ensure it passes
6. **Submit a pull request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes
   - Breaking change notes if applicable

### Pull Request Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Added tests for new functionality
- [ ] All existing tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## Code Review Guidelines

### For Authors

- Keep PRs focused and reasonably sized
- Write clear commit messages and PR descriptions
- Respond to feedback promptly and professionally
- Be open to suggestions and alternative approaches

### For Reviewers

- Be constructive and respectful in feedback
- Focus on code quality, security, and maintainability
- Ask questions if anything is unclear
- Approve when ready, request changes when needed

### Review Checklist

- [ ] Code follows project standards and conventions
- [ ] Adequate test coverage for new functionality
- [ ] Documentation updated appropriately
- [ ] No obvious security vulnerabilities
- [ ] Performance implications considered
- [ ] Breaking changes properly documented

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Version Bump**: Update version in `package.json`
2. **Changelog**: Update `CHANGELOG.md` with changes
3. **Tag Release**: Create git tag with version
4. **Publish**: Publish to npm registry
5. **GitHub Release**: Create GitHub release with notes

### Release Notes Format

```markdown
## [1.2.0] - 2023-12-01

### Added
- Vector similarity search support
- PostgreSQL pgvector integration
- New file storage adapters

### Changed
- Improved query performance
- Updated authentication flow

### Fixed
- Connection pool leak in PostgreSQL adapter
- Race condition in live queries

### Breaking Changes
- Removed deprecated `findFirst` method
- Changed `config` API structure
```

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to follow our community guidelines of respectful and constructive collaboration.

### Getting Help

- **Documentation**: Check the docs and API reference first
- **GitHub Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Discord**: Join our community Discord for real-time chat

### Reporting Issues

When reporting issues, please include:

- **Environment**: OS, Node.js version, Proto.io version
- **Reproduction**: Minimal code example reproducing the issue
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Error messages**: Full error messages and stack traces

### Suggesting Features

For feature requests:

- **Use case**: Describe the problem you're trying to solve
- **Proposed solution**: Your idea for how to solve it
- **Alternatives**: Other solutions you've considered
- **Examples**: Code examples of how it would work

## Development Tips

### Debugging

Use the built-in logger for debugging:

```typescript
proto.logger.debug('Query executed', {
  className: 'Post',
  duration: 45,
  sql: 'SELECT * FROM "Post"...'
});
```

### Performance Testing

Test performance with realistic data:

```typescript
// Generate test data
const users = Array.from({ length: 1000 }, (_, i) => ({
  username: `user${i}`,
  email: `user${i}@example.com`
}));

await proto.Query('User').insertMany(users, { master: true });
```

### Local Development

For local development with external services:

```bash
# Start PostgreSQL with Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# Start Redis with Docker
docker run --name redis -p 6379:6379 -d redis
```

Thank you for contributing to Proto.io! Your contributions help make this project better for everyone.
