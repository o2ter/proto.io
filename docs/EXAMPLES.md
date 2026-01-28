# Examples

This document contains practical examples demonstrating various Proto.io features and use cases. The examples here are comprehensive guides showing complete implementations rather than separate directory structures.

## Quick Start Examples

### 1. Basic Setup (`basic-setup/`)

Simple server setup with basic CRUD operations.

```typescript
// server.ts
import express from 'express';
import { ProtoRoute, ProtoService, schema } from 'proto.io';
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';

const app = express();

const mySchema = schema({
  Post: {
    fields: {
      title: schema.string(),
      content: schema.string(),
      published: schema.boolean(false),
    }
  }
});

const proto = new ProtoService({
  endpoint: 'http://localhost:1337/api',
  schema: mySchema,
  storage: new PostgresStorage({
    connectionString: process.env.DATABASE_URL
  }),
  jwtToken: 'your-jwt-secret',
  masterUsers: [{ user: 'master', pass: 'master-key' }]
});

app.use('/api', await ProtoRoute({ proto }));
app.listen(1337);
```

### 2. Client Usage (`client-usage/`)

Client-side SDK usage examples.

```typescript
// client.ts
import { ProtoClient } from 'proto.io/client';

const client = new ProtoClient({
  endpoint: 'http://localhost:1337/api'
});

// Create a post
const post = await client.Query('Post').insert({
  title: 'Hello World',
  content: 'This is my first post'
});

// Query posts
const posts = await client.Query('Post')
  .equalTo('published', true)
  .sort({ createdAt: -1 })
  .find();
```

## Feature Examples

### 3. Authentication & Authorization (`auth/`)

Complete authentication system with user management and permissions.

**Server Setup:**
```typescript
// auth/server.ts
const schema = {
  User: {
    fields: {
      username: schema.string(),
      email: schema.string(),
      emailVerified: schema.boolean(false),
      profile: schema.object(),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: [],
      delete: ['role:admin']
    }
  },
  Post: {
    fields: {
      title: schema.string(),
      content: schema.string(),
      author: schema.pointer('User'),
      published: schema.boolean(false),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: [],
      delete: ['role:admin']
    }
  }
};
```

**Client Usage:**
```typescript
// auth/client.ts
// Create user (signup) - this would need custom server handling
const user = await client.run('createUser', {
  username: 'john_doe',
  email: 'john@example.com',
  password: 'secure_password'
});

// Login would typically be handled via cloud functions
const result = await client.run('loginUser', {
  username: 'john_doe', 
  password: 'secure_password'
});

// Get current user
const currentUser = await client.currentUser();

// Create post as authenticated user
const post = await client.Query('Post').insert({
  title: 'My Post',
  content: 'Post content here',
  author: currentUser
});
```

### 4. Real-time Features (`realtime/`)

Live queries and event notifications.

**Server:**
```typescript
// realtime/server.ts
import { registerProtoSocket } from 'proto.io';
import { Server } from '@o2ter/server-js';

// Register WebSocket support
const server = new Server(app);
registerProtoSocket(proto, server);

// Send custom notifications
proto.define('sendNotification', async ({ params }) => {
  await proto.notify({
    type: 'user_notification',
    message: params.message,
    _rperm: [params.userId] // Use actual user ID passed as parameter
  });
});
```

**Client:**
```typescript
// realtime/client.ts
// Live query for real-time updates
const subscription = client.Query('Post')
  .equalTo('published', true)
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

// Listen for custom events
client.on('user_notification', (data) => {
  showNotification(data.message);
});
```

### 5. File Storage (`file-storage/`)

File upload and management with different storage backends.

**Server:**
```typescript
// file-storage/server.ts
import { DatabaseFileStorage } from 'proto.io/adapters/file/database';
import { FileSystemStorage } from 'proto.io/adapters/file/filesystem';
import multer from 'multer';

const upload = multer();

// Setup file storage
const proto = new ProtoService({
  // ... other options
  fileStorage: new FileSystemStorage('/uploads'),
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  const proto = req.proto; // Assume middleware sets this
  
  const file = await proto.Query('File').insert({
    name: req.file.originalname,
    data: req.file.buffer,
    mimeType: req.file.mimetype,
  });
  
  res.json(file);
});
```

**Client:**
```typescript
// file-storage/client.ts
// Upload file using ProtoClient
const fileInput = document.querySelector('input[type="file"]');
const file = client.File(
  fileInput.files[0].name,
  fileInput.files[0],
  fileInput.files[0].type
);

// Save the file (requires authentication)
await file.save();

// Or upload via custom endpoint with session info
const sessionInfo = await client.sessionInfo();
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${sessionInfo?.token}`
  }
});

const uploadedFile = await response.json();
```

### 6. Cloud Functions (`cloud-functions/`)

Server-side functions and background jobs.

**Server:**
```typescript
// cloud-functions/server.ts
// Define cloud function
proto.define('sendEmail', async ({ params, user }) => {
  if (!user) throw new Error('Authentication required');
  
  const { to, subject, body } = params;
  
  await emailService.send({
    from: 'noreply@myapp.com',
    to,
    subject,
    body
  });
  
  return { success: true, sentAt: new Date() };
});

// Define background job
proto.defineJob('processImages', async ({ params }) => {
  const { imageIds } = params;
  
  for (const imageId of imageIds) {
    const image = await proto.Query('File').get(imageId, { master: true });
    await processImage(image);
  }
});
```

**Client:**
```typescript
// cloud-functions/client.ts
// Call cloud function
const result = await client.run('sendEmail', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our platform!'
});

console.log('Email sent:', result.sentAt);
```

### 7. Advanced Queries (`advanced-queries/`)

Complex query examples with relations, aggregations, and vector search.

```typescript
// advanced-queries/examples.ts

// Complex filtering with relations
const posts = await client.Query('Post')
  .equalTo('published', true)
  .equalTo('author.verified', true)
  .containedIn('tags', ['typescript', 'nodejs'])
  .greaterThanOrEqualTo('createdAt', new Date('2023-01-01'))
  .includes('author', 'comments.user')
  .sort({ featured: -1, createdAt: -1 })
  .limit(20)
  .find();

// Aggregation queries using groupMatches
const orderStats = await client.Query('Order')
  .equalTo('_id', orderId)
  .groupMatches('items', {
    count: { $count: true },
    total: { $sum: { $key: 'price' } },
    average: { $avg: { $key: 'price' } },
    maxPrice: { $max: { $key: 'price' } }
  })
  .first();

console.log('Total items:', orderStats?.get('items.count'));
console.log('Total price:', orderStats?.get('items.total'));
console.log('Average price:', orderStats?.get('items.average'));

// Grouped aggregations - group by category and aggregate each group
const orderWithGrouping = await client.Query('Order')
  .equalTo('_id', orderId)
  .groupMatches('items', {
    countByCategory: {
      $group: {
        key: { $key: 'category' },
        value: { $count: true }
      }
    },
    totalByCategory: {
      $group: {
        key: { $key: 'category' },
        value: { $sum: { $key: 'price' } }
      }
    }
  })
  .first();

// Results are arrays of { key, value } objects
const countByCategory = orderWithGrouping?.get('items.countByCategory');
console.log('Items per category:', countByCategory);
// Example: [{ key: 'Electronics', value: 5 }, { key: 'Books', value: 3 }]

const totalByCategory = orderWithGrouping?.get('items.totalByCategory');
console.log('Total price per category:', totalByCategory);
// Example: [{ key: 'Electronics', value: 1500 }, { key: 'Books', value: 50 }]

// Vector similarity search (for AI applications)
const similar = await client.Query('Document')
  .filter({
    $expr: {
      $lt: [
        {
          $distance: [
            { $key: 'embedding' },
            { $value: queryVector }
          ]
        },
        { $value: 0.2 } // threshold of 0.2
      ]
    }
  })
  .sort([{
    order: 1, // ascending order - closest first
    expr: {
      $distance: [
        { $key: 'embedding' },
        { $value: queryVector }
      ]
    }
  }])
  .limit(10)
  .includes('metadata')
  .find();

// Regex pattern search
const patternResults = await client.Query('Post')
  .pattern('title', /^Hello/)
  .equalTo('published', true)
  .find();
```

### 8. Database Adapters (`adapters/`)

Examples of using different storage adapters.

**PostgreSQL:**
```typescript
// adapters/postgres.ts
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';

const storage = new PostgresStorage({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password',
  ssl: false,
  
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Custom Storage Adapter:**
```typescript
// adapters/custom.ts
// Note: TStorage interface is internal to Proto.io
// Custom storage adapters would need to match the expected interface
// This is an advanced use case - most users should use the provided adapters

class CustomStorage {
  async find(options) {
    // Implement custom find logic
  }
  
  async insert(options) {
    // Implement custom insert logic
  }
  
  // ... implement other required methods
}
}
```

### 9. Schema Design (`schema-design/`)

Advanced schema examples with relations, permissions, and validation.

```typescript
// schema-design/blog.ts
const blogSchema = schema({
  User: {
    fields: {
      username: schema.string(),
      email: schema.string(),
      profile: schema.shape({
        firstName: schema.string(),
        lastName: schema.string(),
        bio: schema.string(),
        avatar: schema.pointer('File'),
      }),
      settings: schema.object({
        emailNotifications: true,
        theme: 'light'
      }),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: ['owner'],
      delete: ['owner']
    },
    fieldLevelPermissions: {
      email: { read: ['role:admin'] }
    },
    indexes: [
      { keys: { username: 1 }, unique: true },
      { keys: { email: 1 }, unique: true }
    ]
  },
  
  Category: {
    fields: {
      name: schema.string(),
      slug: schema.string(),
      description: schema.string(),
      posts: schema.relation('Post', 'category'),
    },
    indexes: [
      { keys: { slug: 1 }, unique: true }
    ]
  },
  
  Post: {
    fields: {
      title: schema.string(),
      slug: schema.string(),
      content: schema.string(),
      excerpt: schema.string(),
      author: schema.pointer('User'),
      category: schema.pointer('Category'),
      tags: schema.stringArray([]),
      published: schema.boolean(false),
      publishedAt: schema.date(),
      featuredImage: schema.pointer('File'),
      metadata: schema.object(),
      comments: schema.relation('Comment', 'post'),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: ['role:editor'],
      delete: ['role:admin']
    },
    indexes: [
      { keys: { slug: 1 }, unique: true },
      { keys: { published: 1, publishedAt: -1 } },
      { keys: { author: 1 } },
      { keys: { tags: 1 } }
    ]
  },
  
  Comment: {
    fields: {
      content: schema.string(),
      author: schema.pointer('User'),
      post: schema.pointer('Post'),
      approved: schema.boolean(false),
    },
    classLevelPermissions: {
      find: ['*'],
      get: ['*'],
      create: ['*'],
      update: ['role:moderator'],
      delete: ['role:moderator']
    }
  }
});
```

### 10. Testing (`testing/`)

Examples of testing Proto.io applications.

```typescript
// testing/proto.test.ts
import { ProtoService, schema } from 'proto.io';
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';

describe('Blog API', () => {
  let proto: ProtoService;
  
  beforeAll(async () => {
    proto = new ProtoService({
      endpoint: 'http://localhost:1337/api',
      jwtToken: 'test-jwt-secret',
      masterUsers: [{ user: 'master', pass: 'test-key' }],
      schema: blogSchema,
      storage: new PostgresStorage({
        connectionString: process.env.TEST_DATABASE_URL
      })
    });
  });
  
  afterAll(async () => {
    // Cleanup if needed
  });
  
  beforeEach(async () => {
    // Clean database before each test
    await proto.Query('Post').deleteMany({ master: true });
    await proto.Query('User').deleteMany({ master: true });
  });
  
  it('should create and query posts', async () => {
    // Create user
    const user = await proto.Query('User').insert({
      username: 'testuser',
      email: 'test@example.com'
    }, { master: true });
    
    // Create post
    const post = await proto.Query('Post').insert({
      title: 'Test Post',
      content: 'Test content',
      author: user,
      published: true
    }, { master: true });
    
    // Query posts
    const posts = await proto.Query('Post')
      .equalTo('published', true)
      .includes('author')
      .find({ master: true });
    
    expect(posts).toHaveLength(1);
    expect(posts[0].get('title')).toBe('Test Post');
    expect(posts[0].get('author').get('username')).toBe('testuser');
  });
  
  it('should enforce permissions', async () => {
    const user = await proto.Query('User').insert({
      username: 'testuser',
      email: 'test@example.com'
    }, { master: true });
    
    // Connect as user
    const userProto = proto.connect({} as any, { session: { user } });
    
    // User can create posts
    const post = await userProto.Query('Post').insert({
      title: 'User Post',
      content: 'User content',
      author: user
    });
    
    expect(post.get('title')).toBe('User Post');
    
    // User cannot access other users' private data  
    await expect(
      userProto.Query('User').find()
    ).rejects.toThrow();
  });
});
```

### 11. Production Setup (`production/`)

Production-ready configuration examples.

```typescript
// production/server.ts
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ProtoRoute, ProtoService, registerProtoSocket } from 'proto.io';
import { PostgresStorage } from 'proto.io/adapters/storage/postgres';
import { GoogleCloudStorage } from 'proto.io/adapters/file/google-cloud-storage';
import { Storage } from '@google-cloud/storage';
import Redis from 'ioredis';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Redis for pub/sub
const redis = new Redis(process.env.REDIS_URL);
const pubsub = {
  publish: (channel: string, message: any) => {
    redis.publish(channel, JSON.stringify(message));
  },
  subscribe: (channel: string, callback: (message: any) => void) => {
    const subscriber = redis.duplicate();
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) callback(JSON.parse(msg));
    });
    return () => subscriber.unsubscribe(channel);
  }
};

// Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
});

const proto = new ProtoService({
  endpoint: process.env.SERVER_URL!,
  jwtToken: process.env.JWT_SECRET!,
  masterUsers: [{ user: 'master', pass: process.env.MASTER_KEY! }],
  schema: mySchema,
  
  // Production storage
  storage: new PostgresStorage({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000
  }),
  
  // Cloud file storage
  fileStorage: new GoogleCloudStorage(
    storage, 
    process.env.GOOGLE_CLOUD_BUCKET!
  ),
  
  // Real-time support
  pubsub,
  
  // Security settings
  jwtSignOptions: { expiresIn: '30d' },
  cookieOptions: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
  },
  
  // Performance settings
  maxFetchLimit: 100,
  maxUploadSize: 50 * 1024 * 1024, // 50MB
  
  // Logging
  logger: {
    loggerLevel: 'info',
    info: console.info,
    warn: console.warn,
    error: console.error
  }
});

// Setup routes
app.use('/api', await ProtoRoute({ proto }));

// WebSocket support
const server = require('http').createServer(app);
registerProtoSocket(proto, server);

const port = process.env.PORT || 1337;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### 12. Microservices (`microservices/`)

Example of splitting Proto.io into microservices.

```typescript
// microservices/user-service.ts
const userService = new ProtoService({
  schema: schema({
    User: userSchema,
    Role: roleSchema
  }),
  // ... other config
});

// microservices/content-service.ts  
const contentService = new ProtoService({
  schema: schema({
    Post: postSchema,
    Comment: commentSchema
  }),
  // ... other config
});

// microservices/gateway.ts
// API Gateway that routes to appropriate services
app.use('/api/users', await ProtoRoute({ proto: userService }));
app.use('/api/content', await ProtoRoute({ proto: contentService }));
```

## Running the Examples

The examples provided in this document are comprehensive code samples that demonstrate Proto.io features. To use them:

1. **Copy the relevant code** from the examples below
2. **Set up your environment** with the required dependencies
3. **Adapt the code** to your specific use case
4. **Test thoroughly** in your development environment

### Basic Setup

For all examples, you'll need:

```bash
npm install proto.io
# Choose your storage adapter:
npm install pg @types/pg  # For PostgreSQL
# Choose your file storage:
npm install @google-cloud/storage  # For Google Cloud Storage
```

## Example Index

| Example | Description | Complexity |
|---------|-------------|------------|
| basic-setup | Simple server and client setup | Beginner |
| client-usage | Client SDK usage patterns | Beginner |
| auth | Authentication and authorization | Intermediate |
| realtime | Live queries and events | Intermediate |
| file-storage | File upload and storage | Intermediate |
| cloud-functions | Server functions and jobs | Intermediate |
| advanced-queries | Complex query patterns | Advanced |
| adapters | Custom storage adapters | Advanced |
| schema-design | Advanced schema patterns | Advanced |
| testing | Testing strategies | Advanced |
| production | Production deployment | Advanced |
| microservices | Microservice architecture | Expert |

These examples should help you understand how to use Proto.io effectively in different scenarios and provide a foundation for your own applications.
