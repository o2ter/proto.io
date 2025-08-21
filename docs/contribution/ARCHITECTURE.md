# Architecture Overview

## Core Design Principles

Proto.io is built around several key architectural principles:

1. **Modularity**: Clear separation between client, server, and adapter layers
2. **Extensibility**: Plugin-based architecture for storage and file adapters
3. **Type Safety**: Full TypeScript support with compile-time type checking
4. **Performance**: Optimized query processing and connection pooling
5. **Security**: Built-in authentication, authorization, and permission systems

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client SDK    │    │   HTTP API       │    │   ProtoService  │
│                 │    │                  │    │                 │
│ - Query Builder │◄──►│ - REST Routes    │◄──►│ - Schema Mgmt   │
│ - Real-time     │    │ - WebSocket      │    │ - Query Proc    │
│ - Auth          │    │ - Auth Middleware│    │ - Permissions   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌────────────────────────────────┼────────────────────────────────┐
                       │                                │                                │
                       ▼                                ▼                                ▼
              ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
              │ Storage Adapter │            │ File Adapter    │            │   Job Queue     │
              │                 │            │                 │            │                 │
              │ - PostgreSQL    │            │ - Database      │            │ - Scheduler     │
              │ - SQL Base      │            │ - Filesystem    │            │ - Worker Pool   │
              │ - Custom        │            │ - Cloud Storage │            │ - Triggers      │
              └─────────────────┘            └─────────────────┘            └─────────────────┘
```

## Component Breakdown

### 1. Client Layer (`src/client/`)

The client layer provides a JavaScript/TypeScript SDK for interacting with Proto.io servers.

**Key Components:**
- **ProtoClient**: Main client class for API interactions
- **Query Builder**: Type-safe query construction
- **Real-time Client**: WebSocket-based live queries and notifications
- **Request Manager**: HTTP request handling with authentication

**Features:**
- Automatic session management
- Connection pooling and retry logic
- Offline support and caching
- Type-safe API methods

### 2. Server Layer (`src/server/`)

The server layer implements the core backend functionality.

**Key Components:**
- **ProtoService**: Central service orchestrating all operations
- **Route Handlers**: HTTP API endpoints for CRUD, auth, files, etc.
- **Authentication**: JWT-based auth with role-based permissions
- **Query Processor**: SQL generation and execution
- **File Handler**: Upload/download and storage management
- **Job Scheduler**: Background task processing

### 3. Internal Layer (`src/internals/`)

Contains shared types, utilities, and core abstractions.

**Key Components:**
- **Schema System**: Type definitions and validation
- **Codec**: Serialization/deserialization
- **Object Types**: Core data structures (User, Role, File, etc.)
- **Query Types**: Type-safe query building blocks
- **Permission System**: ACL and role-based access control

### 4. Adapter Layer (`src/adapters/`)

Pluggable adapters for different storage backends and file systems.

**Storage Adapters:**
- **PostgreSQL**: Full-featured SQL adapter with advanced query support
- **SQL Base**: Abstract base class for SQL adapters

**File Adapters:**
- **Database**: Store files as chunks in the database
- **Filesystem**: Local filesystem storage
- **Google Cloud Storage**: Google Cloud integration
- **Aliyun OSS**: Alibaba Cloud Object Storage

## Data Flow

### 1. Query Processing Flow

```
Client Query → HTTP Request → Route Handler → ProtoService → Storage Adapter → Database
                                    │
                                    ▼
                              Permission Check → Schema Validation → SQL Generation
```

### 2. Real-time Flow

```
Database Change → Trigger → ProtoService → PubSub → WebSocket → Client Update
```

### 3. File Upload Flow

```
Client Upload → HTTP Route → File Validation → Storage Adapter → Chunk Storage
                                    │
                                    ▼
                              Metadata → Database → File Object Creation
```

## Security Architecture

### Authentication Flow

1. **Login**: Client sends credentials
2. **Verification**: Server validates against user database
3. **Token Generation**: JWT token created with user info
4. **Session Management**: Token stored client-side, validated on requests

### Authorization Layers

1. **Master Key**: Bypasses all permissions (server-to-server)
2. **User Sessions**: Authenticated user context
3. **Class-level Permissions**: Control access to collections
4. **Field-level Permissions**: Control access to specific fields
5. **Object-level ACL**: Per-object access control

### Permission Resolution

```typescript
// Permission check order:
1. Master key check (bypass all)
2. Class-level permissions (create, read, update, delete)
3. Field-level permissions (read, write specific fields)
4. Object ACL (_rperm, _wperm arrays)
5. Role-based permissions (inherited roles)
```

## Storage Architecture

### Database Schema

Proto.io dynamically creates and manages database tables based on your schema definition:

```sql
-- Example generated table for a "Post" class
CREATE TABLE "Post" (
  "_id" varchar(10) PRIMARY KEY,
  "_created_at" timestamp DEFAULT NOW(),
  "_updated_at" timestamp DEFAULT NOW(),
  "_rperm" text[],
  "_wperm" text[],
  "title" text,
  "content" text,
  "author" varchar(10) REFERENCES "User"("_id"),
  "published" boolean DEFAULT false
);

-- Indexes are automatically created
CREATE INDEX "Post_author_idx" ON "Post"("author");
CREATE INDEX "Post_published_idx" ON "Post"("published");
```

### Query Translation

Proto.io queries are translated to optimized SQL:

```typescript
// Proto.io Query
client.Query('Post')
  .where('published', true)
  .where('author.username', 'john')
  .includes('author')
  .sort('-createdAt')
  .limit(10)

// Generated SQL
SELECT p.*, u."username" as "author.username"
FROM "Post" p
LEFT JOIN "User" u ON p."author" = u."_id"
WHERE p."published" = true 
  AND u."username" = 'john'
  AND (/* ACL conditions */)
ORDER BY p."_created_at" DESC
LIMIT 10
```

## File Storage Architecture

### Chunked Storage

Large files are split into chunks for efficient storage and transfer:

```
Original File (10MB)
    │
    ▼
┌────────┬────────┬────────┬────────┐
│Chunk 1 │Chunk 2 │Chunk 3 │Chunk 4 │
│ 16KB   │ 16KB   │ 16KB   │ ...    │
└────────┴────────┴────────┴────────┘
    │        │        │        │
    ▼        ▼        ▼        ▼
Storage Adapter (Database/FS/Cloud)
```

### File Metadata

```typescript
// File object structure
{
  _id: "file_abc123",
  name: "document.pdf",
  mimeType: "application/pdf",
  size: 10485760,
  token: "upload_token_xyz",
  _created_at: Date,
  _updated_at: Date,
  _rperm: ["abc123def456"], // Actual generated user ID
  _wperm: ["abc123def456"] // Actual generated user ID
}
```

## Real-time Architecture

### Live Queries

Live queries provide real-time updates when data matching a query changes:

```typescript
```typescript
// Subscribe to real-time updates
const subscription = client.Query('Post')
  .where('published', true)
  .subscribe();

subscription.on('create', (post) => {
  console.log('New post created:', post);
});
```

// Server detects changes and pushes updates
Database Trigger → Change Detection → Filter by Query → WebSocket Push
```

### Event System

```typescript
// Custom events
proto.notify({
  type: 'user_mentioned',
  userId: userId, // Use actual user ID variable
  postId: 'post_456',
  _rperm: [userId] // Use actual user ID for permissions
});

// Client receives notification
client.on('user_mentioned', (data) => {
  showNotification(`You were mentioned in post ${data.postId}`);
});
```

## Performance Optimizations

### Connection Pooling

```typescript
// PostgreSQL connection pool
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000
});
```

### Query Optimization

1. **Index Management**: Automatic index creation for common queries
2. **Query Planning**: SQL query optimization
3. **Connection Reuse**: Persistent connections for better performance
4. **Prepared Statements**: Cached query execution plans

### Caching Strategy

```typescript
// Schema caching
const schemaCache = new Map();

// Query result caching (optional)
const queryCache = new LRUCache({
  max: 1000,
  ttl: 60000 // 1 minute
});
```

## Scalability Considerations

### Horizontal Scaling

1. **Stateless Servers**: All state stored in database/cache
2. **Load Balancing**: Multiple server instances behind load balancer
3. **Database Clustering**: Read replicas and sharding support
4. **Microservices**: Separate services for different functionality

### Vertical Scaling

1. **Connection Pooling**: Efficient database connection management
2. **Query Optimization**: Minimized database round trips
3. **Memory Management**: Efficient object creation and garbage collection
4. **CPU Optimization**: Optimized algorithms and data structures

## Error Handling

### Error Hierarchy

```typescript
ProtoError
├── ValidationError
├── AuthenticationError
├── AuthorizationError
├── NotFoundError
├── ConflictError
└── InternalError
```

### Error Response Format

```typescript
{
  code: 101,
  error: "Object not found",
  details: {
    className: "Post",
    objectId: "post_123"
  }
}
```

## Monitoring and Observability

### Logging

```typescript
proto.logger.info('Query executed', {
  className: 'Post',
  duration: 45,
  count: 10
});
```

### Metrics

- Query performance (duration, count)
- Connection pool status
- Error rates and types
- Real-time connection counts
- File upload/download volumes

### Health Checks

```typescript
// Built-in health endpoint
GET /health
// Returns: 200 OK if service is healthy
```

This architecture provides a solid foundation for building scalable, maintainable applications while maintaining flexibility for different use cases and deployment scenarios.
