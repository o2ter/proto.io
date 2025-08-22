# Proto.io

A full-featured backend-as-a-service (BaaS) framework built with TypeScript, providing database abstraction, real-time capabilities, file storage, authentication, and more.

## Overview

Proto.io is a comprehensive backend framework that provides a Parse-like API for building scalable applications. It includes support for multiple database backends, file storage adapters, real-time queries, authentication, role-based permissions, and job scheduling.

## Features

- **Database Abstraction**: Support for PostgreSQL with extensible adapter pattern
- **Real-time Capabilities**: Live queries and event notifications via Socket.io
- **File Storage**: Multiple storage backends (filesystem, database, cloud providers)
- **Authentication & Authorization**: JWT-based auth with role-based permissions
- **Schema Management**: Type-safe schema definitions with validation
- **Job Scheduling**: Background job processing with cron-like scheduling
- **Cloud Functions**: Server-side function execution
- **Vector Support**: Vector database operations for ML/AI applications

## Installation

```bash
npm install proto.io
```

## Quick Start

### Server Setup

```typescript
import { ProtoRoute, ProtoService, schema } from 'proto.io';
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';
import { DatabaseFileStorage } from 'proto.io/adapters/file/database';

// Define your schema
const mySchema = schema({
  Post: {
    fields: {
      title: schema.string(),
      content: schema.string(),
      author: schema.pointer('User'),
      tags: schema.stringArray(),
      published: schema.boolean(false),
      publishedAt: schema.date(),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['authenticated'],
      update: ['authenticated'],
      delete: ['authenticated'],
    }
  }
});

// Create ProtoService
const proto = new ProtoService({
  endpoint: 'http://localhost:1337/api',
  schema: mySchema,
  storage: new PostgresStorage({
    connectionString: 'postgresql://user:pass@localhost/db'
  }),
  fileStorage: new DatabaseFileStorage(),
  jwtToken: 'your-jwt-secret',
  masterUsers: [{ user: 'master', pass: 'your-master-key' }],
});

// Create Express router
const router = await ProtoRoute({ proto });

// Mount to your Express app
app.use('/api', router);
```

### Client Usage

```typescript
import { ProtoClient } from 'proto.io/client';

const client = new ProtoClient({
  endpoint: 'http://localhost:1337/api',
});

// Query data
const posts = await client.Query('Post')
  .equalTo('published', true)
  .includes('author')
  .find();

// Create objects using Query
const post = await client.Query('Post').insert({
  title: 'Hello World',
  content: 'This is my first post',
  published: true,
});

// Alternative: Create objects using Object
const post2 = client.Object('Post');
post2.set('title', 'Hello World');
post2.set('content', 'This is my first post');
post2.set('published', true);
await post2.save();

// Real-time subscriptions
const subscription = client.Query('Post')
  .equalTo('published', true)
  .subscribe();

subscription.on('create', (post) => {
  console.log('New post created:', post);
});

subscription.on('update', (post) => {
  console.log('Post updated:', post);
});
```

## Architecture

### Core Components

#### ProtoService
The main service class that orchestrates all functionality:
- Schema validation and management
- Database operations
- Authentication and authorization
- File handling
- Job scheduling
- Real-time notifications

#### Storage Adapters
Pluggable storage backends:
- **PostgreSQL**: Primary SQL database adapter with full feature support
- **SQL Base**: Abstract base for SQL adapters

#### File Storage Adapters
Multiple file storage options:
- **Database**: Store files as base64 chunks in database
- **Filesystem**: Store files on local filesystem
- **Google Cloud Storage**: Google Cloud Storage integration
- **Aliyun OSS**: Alibaba Cloud Object Storage Service

#### Query System
Type-safe query builder with:
- Filtering and sorting
- Relations and joins
- Aggregations and grouping
- Pagination
- Live queries for real-time updates

### Project Structure

```
src/
├── index.ts                 # Main exports and ProtoRoute factory
├── client/                  # Client-side SDK
│   ├── index.ts            # Client exports
│   ├── options.ts          # Client configuration
│   ├── query.ts            # Client query builder
│   ├── request.ts          # HTTP request handling
│   └── proto/              # Client protocol implementation
├── server/                  # Server-side implementation
│   ├── auth/               # Authentication middleware
│   ├── crypto/             # Password hashing and utilities
│   ├── file/               # File handling interface
│   ├── proto/              # Core ProtoService implementation
│   ├── pubsub/             # Pub/Sub for real-time features
│   ├── query/              # Query processing and dispatching
│   ├── routes/             # HTTP API endpoints
│   ├── storage/            # Storage interface
│   ├── schedule.ts         # Job scheduling
│   └── utils.ts            # Server utilities
├── internals/              # Internal type definitions and utilities
│   ├── buffer.ts           # Buffer utilities
│   ├── codec.ts            # Serialization/deserialization
│   ├── const.ts            # Constants
│   ├── options.ts          # Option types
│   ├── private.ts          # Private key for internal access
│   ├── schema.ts           # Schema type definitions
│   ├── types.ts            # Core type definitions
│   ├── utils.ts            # Utility functions
│   ├── liveQuery/          # Live query implementation
│   ├── object/             # Object type definitions
│   ├── proto/              # Protocol type definitions
│   └── query/              # Query type definitions
└── adapters/               # Storage and file adapters
    ├── file/               # File storage adapters
    │   ├── base/           # Base file storage classes
    │   ├── database/       # Database file storage
    │   ├── filesystem/     # Filesystem storage
    │   ├── google-cloud-storage/ # Google Cloud Storage
    │   └── aliyun-oss/     # Aliyun Object Storage
    └── storage/            # Database storage adapters
        ├── sql/            # SQL base adapter
        └── postgres/       # PostgreSQL adapter
```

## Schema Definition

Proto.io uses a type-safe schema system:

```typescript
import { schema } from 'proto.io';

const mySchema = schema({
  User: {
    fields: {
      username: schema.string(),
      email: schema.string(),
      emailVerified: schema.boolean(false),
      profile: schema.object(),
      tags: schema.stringArray(),
      avatar: schema.pointer('File'),
      preferences: schema.shape({
        theme: schema.string('light'),
        notifications: schema.boolean(true),
      }),
      embedding: schema.vector(1536), // For AI/ML applications
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: [],
      delete: [],
    },
    fieldLevelPermissions: {
      email: { read: [] },
    },
    indexes: [
      { keys: { username: 1 }, unique: true },
      { keys: { email: 1 }, unique: true },
    ]
  },
  
  Post: {
    fields: {
      title: schema.string(),
      content: schema.string(),
      author: schema.pointer('User'),
      comments: schema.relation('Comment', 'post'),
      publishedAt: schema.date(),
    }
  },
  
  Comment: {
    fields: {
      content: schema.string(),
      author: schema.pointer('User'),
      post: schema.pointer('Post'),
    }
  }
});
```

### Schema Types

- `schema.boolean(defaultValue?)` - Boolean field
- `schema.number(defaultValue?)` - Number field
- `schema.decimal(defaultValue?)` - Decimal.js field for precision
- `schema.string(defaultValue?)` - String field
- `schema.stringArray(defaultValue?)` - Array of strings
- `schema.date(defaultValue?)` - Date field
- `schema.object(defaultValue?)` - Generic object
- `schema.array(defaultValue?)` - Generic array
- `schema.vector(dimension, defaultValue?)` - Vector for ML/AI
- `schema.shape(definition)` - Structured object with typed fields
- `schema.pointer(targetClass)` - Reference to another object
- `schema.relation(targetClass, foreignField?)` - One-to-many relation

## Authentication & Authorization

### User Authentication

Proto.io uses server-side cloud functions for authentication rather than built-in client methods:

```typescript
// Server-side: Define authentication functions
proto.define('createUser', async ({ params, req }) => {
  const { username, email, password } = params;
  const user = await proto.Query('User').insert({ username, email }, { master: true });
  await proto.setPassword(user, password, { master: true });
  await proto.becomeUser(req, user);
  return user;
});

proto.define('loginUser', async ({ params, req }) => {
  const { username, password } = params;
  const user = await proto.Query('User')
    .equalTo('username', username)
    .first({ master: true });
  
  if (!user || !await proto.verifyPassword(user, password, { master: true })) {
    throw new Error('Invalid credentials');
  }
  
  await proto.becomeUser(req, user);
  return user;
});

// Client-side: Use cloud functions for authentication
await client.run('createUser', {
  username: 'john_doe',
  email: 'john@example.com',
  password: 'secure_password'
});

await client.run('loginUser', {
  username: 'john_doe',
  password: 'secure_password'
});

// Get current user
const currentUser = await client.currentUser();

// Log out
await client.logout();
```

### Permissions

#### Valid Permission Values

Proto.io supports the following permission values:

- **`'*'`** - Public access (anyone)
- **`'role:roleName'`** - Users with specific role (e.g., `'role:admin'`, `'role:moderator'`)
- **User IDs** - Specific user access (e.g., `'user123'`)
- **`[]`** - Empty array (no access)

#### Class-Level Permissions
Control access to entire collections:

```typescript
classLevelPermissions: {
  find: ['*'],                    // Anyone can query
  get: ['*'],                     // Anyone can get by ID
  create: ['*'],                  // Anyone can create
  update: ['role:admin'],         // Admin role only
  delete: ['role:admin']          // Admin role only
}
```

#### Field-Level Permissions
Control access to specific fields:

```typescript
fieldLevelPermissions: {
  email: { 
    read: ['role:admin'],          // Only admin can read
    create: [],                    // No one can create
    update: []                     // No one can update
  },
  password: { 
    create: [],                    // No one can create
    update: []                     // No one can update
  }
}
```

### Roles

```typescript
// Create role
const adminRole = await proto.Query('Role').insert({
  name: 'admin',
  users: [user],
  roles: [moderatorRole] // Role inheritance
}, { master: true });

// Check user roles
const roles = await proto.currentRoles();
```

## Real-time Features

### Live Queries

```typescript
// Client-side live query
const subscription = client.Query('Post')
  .where('published', true)
  .subscribe();

subscription.on('create', (post) => {
  console.log('New post created:', post);
});

subscription.on('update', (post) => {
  console.log('Post updated:', post);
});

subscription.on('delete', (post) => {
  console.log('Post deleted:', post);
});

// Unsubscribe from specific events
const { remove } = subscription.on('create', callback);
remove(); // Remove this specific listener
```

### Event Notifications

```typescript
// Server-side: Send notification
await proto.notify({
  type: 'new_message',
  message: 'Hello!',
  _rperm: [user.id] // Read permissions - use actual user ID from user object
});

// Or for roles:
await proto.notify({
  type: 'new_message',
  message: 'Hello!',
  _rperm: ['role:admin'] // Role permissions - use "role:" prefix
});

// Client-side: Listen for events
client.on('new_message', (data) => {
  console.log('New message:', data.message);
});
```

## File Storage

### Upload Files

```typescript
// Server-side file upload
app.post('/upload', upload.single('file'), async (req, res) => {
  const proto = getProtoInstance(req);
  
  const file = await proto.Query('File').insert({
    name: req.file.originalname,
    data: req.file.buffer,
    mimeType: req.file.mimetype,
  });
  
  res.json(file);
});

// Client-side
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
});
```

### File Storage Adapters

#### Database Storage
```typescript
import { DatabaseFileStorage } from 'proto.io/adapters/file/database';

const fileStorage = new DatabaseFileStorage({
  chunkSize: 16 * 1024, // 16KB chunks
  parallel: 8           // Parallel uploads
});
```

#### Filesystem Storage
```typescript
import { FileSystemStorage } from 'proto.io/adapters/file/filesystem';

const fileStorage = new FileSystemStorage('/var/uploads', {
  chunkSize: 64 * 1024
});
```

#### Google Cloud Storage
```typescript
import { GoogleCloudStorage } from 'proto.io/adapters/file/google-cloud-storage';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'your-project-id',
  keyFilename: 'path/to/service-account.json'
});

const fileStorage = new GoogleCloudStorage(storage, 'your-bucket-name');
```

## Cloud Functions

```typescript
// Define server function
proto.define('sendEmail', async ({ params, user, master }) => {
  if (!user && !master) throw new Error('Authentication required');
  
  const { to, subject, body } = params;
  
  await emailService.send({
    to,
    subject,
    body,
    from: 'noreply@yourapp.com'
  });
  
  return { success: true };
});

// Call from client
const result = await client.run('sendEmail', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our app!'
});
```

## Background Jobs

```typescript
// Define job
proto.defineJob('processImages', async ({ params, user, master }) => {
  const { imageIds } = params;
  
  for (const imageId of imageIds) {
    const image = await proto.Query('File').get(imageId, { master: true });
    // Process image...
    await processImage(image);
  }
});

// Schedule job
await proto.scheduleJob('processImages', {
  imageIds: ['img1', 'img2', 'img3']
});

// Recurring jobs can be scheduled with cron syntax
// This would be done in your scheduler setup
```

## Database Adapters

### PostgreSQL Adapter

```typescript
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';

const storage = new PostgresStorage({
  connectionString: 'postgresql://user:pass@localhost:5432/dbname',
  // or individual options:
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password',
  ssl: false,
  
  // Connection pool options
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Advanced Features

### Vector Search (AI/ML)

```typescript
// Define schema with vector field
const schema = {
  Document: {
    fields: {
      content: schema.string(),
      embedding: schema.vector(1536), // OpenAI embedding dimension
    }
  }
};

// Store embeddings
await client.Query('Document').insert({
  content: 'This is a sample document',
  embedding: await getEmbedding('This is a sample document')
});

// Vector similarity search using distance expressions
const similar = await client.Query('Document')
  .filter({
    $expr: {
      $lt: [
        {
          $distance: [
            { $key: 'embedding' },
            { $value: queryEmbedding }
          ]
        },
        { $value: 0.2 } // threshold of 0.2
      ]
    }
  })
  .sort([{
    order: 1, // 1 for ascending (closest first), -1 for descending
    expr: {
      $distance: [
        { $key: 'embedding' },
        { $value: queryEmbedding }
      ]
    }
  }])
  .limit(10)
  .find();
```

### Transactions

```typescript
await proto.withTransaction(async (txProto) => {
  const user = await txProto.Query('User').get(userId, { master: true });
  
  await txProto.Query('User').update(userId, {
    balance: user.get('balance') - amount
  }, { master: true });
  
  await txProto.Query('Transaction').insert({
    user: user,
    amount: -amount,
    type: 'debit'
  }, { master: true });
});
```

### Aggregations

Proto.io provides aggregation functionality through the `groupMatches` method, which performs aggregations on relation fields:

```typescript
// Count items in a relation
const result = await client.Query('Order')
  .equalTo('_id', orderId)
  .groupMatches('items', {
    count: { $count: true }
  })
  .first();

console.log(result?.get('items.count')); // Number of items

// Sum total values in order items
const orderTotal = await client.Query('Order')
  .equalTo('_id', orderId)
  .groupMatches('items', {
    total: { $sum: { $key: 'price' } },
    average: { $avg: { $key: 'price' } },
    maxPrice: { $max: { $key: 'price' } },
    minPrice: { $min: { $key: 'price' } }
  })
  .first();

console.log(orderTotal?.get('items.total'));
console.log(orderTotal?.get('items.average'));

// Advanced aggregations with percentiles
const stats = await client.Query('Survey')
  .equalTo('_id', surveyId)
  .groupMatches('responses', {
    median: {
      $percentile: {
        input: { $key: 'rating' },
        p: 0.5
      }
    },
    standardDev: { $stdDevPop: { $key: 'rating' } },
    variance: { $varPop: { $key: 'rating' } }
  })
  .first();
```

#### Available Aggregation Operators

- `$count` - Count of documents
- `$sum` - Sum of values  
- `$avg` - Average of values
- `$max` - Maximum value
- `$min` - Minimum value
- `$most` - Most frequent value (mode)
- `$stdDevPop` - Population standard deviation
- `$stdDevSamp` - Sample standard deviation  
- `$varPop` - Population variance
- `$varSamp` - Sample variance
- `$percentile` - Percentile calculation with options for discrete/continuous mode

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# App Configuration
SERVER_URL=http://localhost:1337/api
MASTER_KEY=your-master-key
JWT_SECRET=your-jwt-secret

# File Storage
FILE_STORAGE_TYPE=filesystem
FILE_STORAGE_PATH=/var/uploads

# Redis (for pub/sub)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_EXPIRES_IN=30d
```

### Full Configuration Example

```typescript
const proto = new ProtoService({
  // Core configuration
  endpoint: process.env.SERVER_URL,
  jwtToken: process.env.JWT_SECRET,
  masterUsers: [{ user: 'master', pass: process.env.MASTER_KEY }],
  
  // Schema definition
  schema: mySchema,
  
  // Storage adapter
  storage: new PostgresStorage({
    connectionString: process.env.DATABASE_URL
  }),
  
  // File storage
  fileStorage: new FileSystemStorage('/var/uploads'),
  
  // Performance settings
  objectIdSize: 10,
  maxFetchLimit: 1000,
  maxUploadSize: 20 * 1024 * 1024, // 20MB
  
  // Authentication
  jwtSignOptions: { expiresIn: '30d' },
  cookieOptions: { 
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  },
  
  // Password hashing
  passwordHashOptions: {
    alg: 'scrypt',
    log2n: 14,
    blockSize: 8,
    parallel: 1,
    keySize: 64,
    saltSize: 64,
  },
  
  // Pub/Sub for real-time features
  pubsub: redisPubSub,
  
  // Role resolution
  roleResolver: {
    inheritKeys: ['users', 'roles'],
    resolver: async (user, defaultResolver) => {
      // Custom role resolution logic
      return defaultResolver();
    }
  },
  
  // Class extensions
  classExtends: {
    User: {
      prototype: {
        async sendWelcomeEmail() {
          // Custom user methods
        }
      }
    }
  },
  
  // Logging
  logger: {
    loggerLevel: 'info',
    info: console.info,
    warn: console.warn,
    error: console.error,
  }
});
```

## Testing

The project includes comprehensive tests covering:

- CRUD operations
- Query functionality
- Real-time features
- Authentication and authorization
- File storage
- Background jobs
- Vector operations
- Edge cases and error handling

```bash
# Run tests
npm test

# Run specific test suites
npm test -- --testPathPattern=query
npm test -- --testPathPattern=auth
```

## API Reference

### ProtoService Methods

#### Query Operations
- `Query(className)` - Create a query for a class
- `Relation(object, key)` - Create a relation query
- `InsecureQuery(className)` - Create an insecure query (bypasses ACL)

#### Authentication
- `currentUser()` - Get current authenticated user
- `currentRoles()` - Get current user's roles
- `becomeUser(req, user)` - Sign in as user
- `logoutUser(req)` - Sign out current user

#### Functions & Jobs
- `run(name, params)` - Execute cloud function
- `define(name, callback)` - Define cloud function
- `scheduleJob(name, params)` - Schedule background job
- `defineJob(name, callback)` - Define job handler

#### Configuration
- `config()` - Get app configuration
- `setConfig(values)` - Set configuration values

#### Real-time
- `notify(data)` - Send notification
- `listen(callback)` - Listen for notifications

#### Utilities
- `withTransaction(callback)` - Execute in transaction
- `generateUploadToken()` - Generate file upload token
- `gc()` - Run garbage collection

### ProtoClient Methods

#### Queries & Real-time
- `Query(className)` - Create query for data access
- `Query(className).subscribe()` - Create live query subscription
- `Relation(object, key)` - Create relation query

#### Objects & Files
- `Object(className, id?)` - Create new object instance
- `File(name, data, mimeType)` - Create file object

#### Functions & Jobs
- `run(name, params)` - Execute cloud function
- `scheduleJob(name, params)` - Schedule background job

#### Authentication & Session
- `currentUser()` - Get current authenticated user
- `logout()` - Log out current user
- `setSessionToken(token)` - Set session token
- `sessionInfo()` - Get session information
- `setPassword(user, password, options)` - Set user password (requires master)
- `unsetPassword(user, options)` - Remove user password (requires master)

#### Configuration & System
- `online()` - Check if server is online
- `config(options?)` - Get configuration values
- `configAcl(options)` - Get configuration ACLs (requires master)
- `setConfig(values, options)` - Set configuration (requires master)
- `schema(options)` - Get schema information (requires master)

#### Real-time Events
- `listen(callback, selector?)` - Listen for custom events
- `notify(data, options?)` - Send custom notifications

#### Utilities
- `refs(object, options?)` - Get all references to an object
- `refreshSocketSession()` - Refresh WebSocket session
- `rebind(object)` - Rebind object to proto instance

## Migration Guide

When upgrading between versions, check the migration guide for breaking changes and upgrade instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: Report bugs and request features
- Documentation: Full API documentation available
- Examples: Sample applications and use cases
