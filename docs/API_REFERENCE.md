# API Reference

## ProtoService

The main service class that orchestrates all Proto.io functionality.

### Constructor

```typescript
new ProtoService<Ext>(options: ProtoServiceOptions<Ext>)
```

### ProtoServiceOptions

```typescript
interface ProtoServiceOptions<Ext> {
  // Core Configuration
  endpoint: string;              // Server endpoint URL
  
  // Schema and Storage  
  schema: Record<string, TSchema>;
  storage: TStorage;
  fileStorage?: TFileStorage;
  
  // Authentication (corrected)
  jwtToken: string;              // JWT secret key
  jwtSignOptions?: jwt.SignOptions;
  jwtVerifyOptions?: jwt.VerifyOptions;
  jwtUploadSignOptions?: jwt.SignOptions;
  jwtUploadVerifyOptions?: jwt.VerifyOptions;
  cookieOptions?: CookieOptions;
  
  // Master Access
  masterUsers: Array<{ user: string; pass: string; }>;
  
  // Performance
  objectIdSize?: number;        // Default: 10
  maxFetchLimit?: number;       // Default: 1000
  maxUploadSize?: number;       // Default: 20MB
  
  // Security
  passwordHashOptions?: PasswordHashOptions;
  
  // Real-time
  pubsub?: {
    publish: (channel: string, message: any) => void;
    subscribe: (channel: string, callback: (message: any) => void) => () => void;
  };
  
  // Extensions
  classExtends?: TExtensions<Ext>;
  
  // Role Management
  roleResolver?: {
    inheritKeys?: string[];
    resolver?: (user: TUser, defaultResolver: () => Promise<TRole[]>) => Promise<TRole[]>;
  };
  
  // Logging
  logger?: {
    loggerLevel?: 'all' | 'debug' | 'info' | 'warn' | 'error';
    debug?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
  };
}
```

### Core Methods

#### Query Operations

##### `Query<T>(className: T): TQuery<T, Ext, boolean>`
Creates a new query for the specified class.

```typescript
const posts = await proto.Query('Post')
  .equalTo('published', true)
  .includes('author')
  .find();
```

##### `Relation<T>(object: TObject, key: PathName<T>): TQuery<string, Ext, boolean>`
Creates a query for objects related to the given object.

```typescript
const user = await proto.Query('User').get('user123');
const posts = await proto.Relation(user, 'posts').find();
```

##### `InsecureQuery<T>(className: T): TQuery<T, Ext, true>`
Creates a query that bypasses all access control checks.

```typescript
// Master access only
const allUsers = await proto.InsecureQuery('User').find();
```

#### Authentication & Session Management

##### `sessionInfo(): Promise<Session | undefined>`
Gets the current session information.

```typescript
const session = await proto.sessionInfo();
if (session?.user) {
  console.log('Current user:', session.user.get('username'));
}
```

##### `currentUser(): Promise<TUser | undefined>`
Gets the currently authenticated user.

```typescript
const user = await proto.currentUser();
```

##### `currentRoles(): Promise<string[]>`
Gets the current user's role names.

```typescript
const roles = await proto.currentRoles();
if (roles.includes('admin')) {
  // User has admin privileges
}
```

##### `becomeUser(req: Request, user: TUser, options?): Promise<void>`
Signs in as the specified user.

```typescript
await proto.becomeUser(req, user, {
  cookieOptions: { maxAge: 86400000 }, // 1 day
  jwtSignOptions: { expiresIn: '1d' }
});
```

##### `logoutUser(req: Request, options?): Promise<void>`
Signs out the current user.

```typescript
await proto.logoutUser(req);
```

#### Password Management

##### `verifyPassword(user: TUser, password: string, options: ExtraOptions<true>): Promise<boolean>`
Verifies a user's password.

```typescript
const isValid = await proto.verifyPassword(user, 'plaintext_password', { master: true });
```

##### `setPassword(user: TUser, password: string, options: ExtraOptions<true>): Promise<void>`
Sets a user's password.

```typescript
await proto.setPassword(user, 'new_password', { master: true });
```

##### `unsetPassword(user: TUser, options: ExtraOptions<true>): Promise<void>`
Removes a user's password.

```typescript
await proto.unsetPassword(user, { master: true });
```

#### Cloud Functions

##### `define<P, R>(name: string, callback: ProtoFunction<Ext, P, R>, options?): void`
Defines a cloud function.

```typescript
proto.define('sendEmail', async ({ params, user, master }) => {
  if (!user && !master) throw new Error('Authentication required');
  
  const { to, subject, body } = params;
  await emailService.send({ to, subject, body });
  
  return { success: true };
}, {
  validator: {
    requireUser: true,
  }
});
```

##### `run<R>(name: string, params?, options?): Promise<R>`
Executes a cloud function.

```typescript
const result = await proto.run('sendEmail', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our app!'
});
```

#### Background Jobs

##### `defineJob<P>(name: string, callback: ProtoJobFunction<Ext, P>, options?): void`
Defines a background job.

```typescript
proto.defineJob('processImages', async ({ params, user, master }) => {
  const { imageIds } = params;
  
  for (const imageId of imageIds) {
    const image = await proto.Query('File').get(imageId, { master: true });
    await processImage(image);
  }
}, {
  priority: 'high',
  retryLimit: 3,
  retryDelay: 5000
});
```

##### `scheduleJob(name: string, params?, options?): Promise<string>`
Schedules a background job for execution.

```typescript
const jobId = await proto.scheduleJob('processImages', {
  imageIds: ['img1', 'img2', 'img3']
});
```

#### Triggers

##### `afterCreate<T>(className: string, callback: ProtoTriggerFunction<T, Ext>): void`
Registers a trigger to run after object creation.

```typescript
proto.afterCreate('User', async ({ object, user, master }) => {
  // Send welcome email
  await proto.run('sendEmail', {
    to: object.get('email'),
    subject: 'Welcome!',
    body: 'Welcome to our platform!'
  });
});
```

##### `afterUpdate<T>(className: string, callback: ProtoTriggerFunction<T, Ext>): void`
Registers a trigger to run after object updates.

##### `afterDelete<T>(className: string, callback: ProtoTriggerFunction<T, Ext>): void`
Registers a trigger to run after object deletion.

#### Configuration

##### `config(options?): Promise<Record<string, any>>`
Gets application configuration.

```typescript
const config = await proto.config();
const publicSettings = await proto.config({ master: false });
```

##### `setConfig(values: Record<string, any>, options: { master: true; acl?: string[] }): Promise<void>`
Sets configuration values.

```typescript
await proto.setConfig({
  appName: 'My App',
  version: '1.0.0',
  maintenanceMode: false
}, { master: true });
```

#### Real-time Features

##### `notify(data: Record<string, any> & { _rperm?: string[] }): Promise<void>`
Sends a real-time notification.

```typescript
await proto.notify({
  type: 'new_message',
  message: 'Hello World!',
  from: user.id,
  _rperm: [user1.id, user2.id] // Only these users will receive it - use actual user IDs from user objects
});

// Or for roles:
await proto.notify({
  type: 'new_message',
  message: 'Hello World!',
  _rperm: ['role:admin', 'role:moderator'] // Role permissions - use "role:" prefix
});
```

##### `listen(callback: (data: EventData) => void, selector?): { remove: () => void }`
Listens for real-time notifications.

```typescript
const { remove } = proto.listen((data) => {
  console.log('Received notification:', data);
}, {
  type: 'new_message' // Only listen for specific event types
});

// Later: remove()
```

#### Transaction Management

##### `withTransaction<T>(callback: (connection: ProtoService<Ext>) => Promise<T>, options?): Promise<T>`
Executes operations within a database transaction.

```typescript
const result = await proto.withTransaction(async (txProto) => {
  const user = await txProto.Query('User').get(userId, { master: true });
  
  await txProto.Query('User')
    .equalTo('_id', userId)
    .updateOne({
      balance: { $set: user.get('balance') - amount }
    }, { master: true });
  
  const transaction = await txProto.Query('Transaction').insert({
    user: user,
    amount: -amount,
    type: 'debit'
  }, { master: true });
  }, { master: true });
  
  return transaction;
});
```

#### Utility Methods

##### `classes(): string[]`
Returns all defined class names.

```typescript
const classNames = proto.classes(); // ['User', 'Post', 'Comment', ...]
```

##### `generateUploadToken(options?): string`
Generates a JWT token for file uploads.

```typescript
const uploadToken = proto.generateUploadToken({
  maxUploadSize: 10 * 1024 * 1024, // 10MB
  attributes: { userId: 'user123' }
});
```

##### `refs(object: TObject, options?): AsyncIterable<TObject>`
Gets all objects that reference the given object.

```typescript
const post = await proto.Query('Post').get('post123');
for await (const ref of proto.refs(post)) {
  console.log('Referenced by:', ref.className, ref.id);
}
```

##### `gc(classNames?): Promise<void>`
Runs garbage collection on expired objects.

```typescript
await proto.gc(['File']); // Clean up expired files
await proto.gc(); // Clean up all classes
```

---

## ProtoClient

Client-side SDK for interacting with Proto.io servers.

### Constructor

```typescript
new ProtoClient(options: ProtoClientOptions)
```

#### Options

```typescript
interface ProtoClientOptions {
  endpoint: string;                     // Server endpoint URL
  socketEndpoint?: string;              // WebSocket endpoint (optional)
  masterUser?: { 
    user: string; 
    pass: string; 
  };                                   // Master user credentials (optional)
  classExtends?: TExtensions<Ext>;     // Class extensions (optional)
  axiosOptions?: {                     // Axios configuration (optional)
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
    retryLimit?: number;
    cookieKey?: string;
  };
}
```

### Core Methods

#### Query Operations

##### `Query<T>(className: T): ClientQuery<T>`
Creates a client-side query.

```typescript
const posts = await client.Query('Post')
  .equalTo('published', true)
  .includes('author')
  .limit(10)
  .find();
```

##### `Object<T>(className: T): TObjectType<T, Ext>`
Creates a new object instance.

```typescript
const post = client.Object('Post');
post.set('title', 'Hello World');
post.set('content', 'This is my first post');
await post.save();
```

##### `File(name: string, data: string | Buffer | ReadableStream, mimeType: string): TFile`
Creates a file object.

```typescript
const file = client.File('document.txt', 'Hello World', 'text/plain');
await file.save({ 
  uploadToken: await client.run('generateUploadToken') as string 
});
```

##### `run<R>(name: string, data?: any, options?: RequestOptions): Promise<R>`
Executes a cloud function.

```typescript
const result = await client.run('sendEmail', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our app!'
});
```

##### `online(): Promise<boolean>`
Checks if the server is online.

```typescript
const isOnline = await client.online();
```

##### `currentUser(options?: RequestOptions): Promise<TUser | undefined>`
Gets the current authenticated user.

```typescript
const user = await client.currentUser();
if (user) {
  console.log('Logged in as:', user.get('username'));
}
```

##### `logout(options?: RequestOptions): Promise<void>`
Logs out the current user.

```typescript
await client.logout();
```

##### `setSessionToken(token?: string): void`
Sets the session token for authentication.

```typescript
client.setSessionToken('your-jwt-token');
```

##### `sessionInfo(options?: RequestOptions): Promise<SessionInfo>`
Gets information about the current session.

```typescript
const sessionInfo = await client.sessionInfo();
```

##### `setPassword(user: TUser, password: string, options: RequestOptions<true>): Promise<void>`
Sets a password for a user (requires master permission).

```typescript
await client.setPassword(user, 'new-password', { master: true });
```

##### `unsetPassword(user: TUser, options: RequestOptions<true>): Promise<void>`
Removes a user's password (requires master permission).

```typescript
await client.unsetPassword(user, { master: true });
```

##### `configAcl(options: RequestOptions<true>): Promise<Record<string, string[]>>`
Gets configuration ACLs (requires master permission).

```typescript
const acls = await client.configAcl({ master: true });
```

##### `setConfig(values: Record<string, any>, options: RequestOptions<true> & { acl?: string[]; }): Promise<void>`
Sets configuration values (requires master permission).

```typescript
await client.setConfig({ 
  appName: 'My App',
  maxUsers: 1000 
}, { 
  master: true,
  acl: ['admin'] 
});
```

##### `scheduleJob(name: string, data?: any, options?: RequestOptions): Promise<any>`
Schedules a background job.

```typescript
await client.scheduleJob('processData', { userId: '123' });
```

##### `notify(data: Record<string, any> & { _rperm?: string[]; }, options?: RequestOptions): Promise<void>`
Sends a custom notification.

```typescript
await client.notify({
  type: 'user_notification',
  message: 'Hello World!',
  _rperm: [user.id] // Use actual user ID from user object
});

// Or for roles:
await client.notify({
  type: 'user_notification',
  message: 'Hello World!',
  _rperm: ['role:admin'] // Role permissions - use "role:" prefix
});
```

##### `listen(callback: (data: EventData) => void, selector?: TQuerySelector): { remove: () => void; socket?: Socket; }`
Listens for custom events.

```typescript
const { remove } = client.listen((data) => {
  console.log('Event received:', data);
});

// Remove listener
remove();
```

##### `refs(object: TObject, options?: RequestOptions): AsyncIterable<TObjectType<string, Ext>>`
Gets all references to an object.

```typescript
for await (const ref of client.refs(myObject)) {
  console.log('Reference:', ref);
}
```

##### `refreshSocketSession(): void`
Refreshes the WebSocket session.

```typescript
client.refreshSocketSession();
```

##### `rebind<T>(object: T): T`
Rebinds an object to the proto instance.

```typescript
const boundObject = client.rebind(rawObject);
```

#### Live Queries

```typescript
// Subscribe to live updates
const subscription = client.Query('Post')
  .equalTo('published', true)
  .subscribe();

// Listen for events
subscription.on('create', (post) => {
  console.log('New post:', post);
});

subscription.on('update', (post) => {
  console.log('Updated post:', post);
});

subscription.on('delete', (post) => {
  console.log('Deleted post:', post);
});

// Remove specific event listener
const { remove } = subscription.on('create', callback);
remove();
```

### Authentication

##### `currentUser(options?): Promise<TUser | undefined>`
Gets the currently authenticated user.

```typescript
const user = await client.currentUser();
```

##### `logout(options?): Promise<void>`
Logs out the current user.

```typescript
await client.logout();
```

**Note**: For user authentication, you typically create users through Query operations and then authenticate using server-side functions or by creating your own login endpoints. Proto.io doesn't provide built-in `User.login()` or `User.signup()` methods on the client.

#### Cloud Functions

##### `run<R>(name: string, params?): Promise<R>`
Executes a cloud function.

```typescript
const result = await client.run('sendEmail', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Hello World!'
});
```

#### Real-time Events

##### `on(event: string, callback: (data: any) => void): void`
Listens for custom events.

```typescript
client.on('notification', (data) => {
  console.log('Received notification:', data);
});
```

##### `off(event: string, callback?: (data: any) => void): void`
Removes event listeners.

```typescript
client.off('notification'); // Remove all listeners
client.off('notification', specificCallback); // Remove specific listener
```

---

## Query API

### Query Building

#### Filtering

##### `equalTo(field: string, value: any): Query`
Basic equality filter.

```typescript
query.equalTo('published', true)
query.equalTo('author', userObject)
```

##### `filter(selector: TQuerySelector): Query`
Advanced filtering with query selectors.

```typescript
query.filter({ score: { $gt: 100 } })
query.filter({ createdAt: { $gte: new Date('2023-01-01') } })
query.filter({ tags: { $in: ['typescript', 'node'] } })
```

##### Common Filter Methods
- `equalTo(field, value)` - Equality
- `notEqualTo(field, value)` - Not equal
- `greaterThan(field, value)` - Greater than
- `greaterThanOrEqualTo(field, value)` - Greater than or equal
- `lessThan(field, value)` - Less than
- `lessThanOrEqualTo(field, value)` - Less than or equal
- `containedIn(field, values)` - Array membership
- `notContainedIn(field, values)` - Not in array
- `pattern(field, regex)` - Regular expression matching

##### `or(...conditions): Query`
OR conditions.

```typescript
query.or(
  q => q.equalTo('status', 'published'),
  q => q.equalTo('featured', true)
)
```

##### `and(...conditions): Query`
AND conditions (default behavior).

```typescript
query.and(
  q => q.equalTo('published', true),
  q => q.filter({ score: { $gt: 50 } })
)
```

#### Relationships

##### `includes(...fields): Query`
Include related objects.

```typescript
query.includes('author', 'comments.user')
```

#### Sorting

##### `sort(fields: Record<string, 1 | -1>): Query`
Multiple field sorting.

```typescript
query.sort({ featured: -1, createdAt: -1 })
```

#### Pagination

##### `limit(count: number): Query`
Limit results.

```typescript
query.limit(10)
```

##### `skip(count: number): Query`
Skip results.

```typescript
query.skip(20)
```

#### Aggregation

##### `count(): Promise<number>`
Count matching objects.

```typescript
const count = await query.count();
```

##### `groupMatches(key: string, accumulators: Record<string, TQueryAccumulator>): Query`
Performs aggregations on relation fields.

```typescript
// Count items in a relation
const orderWithCount = await client.Query('Order')
  .equalTo('_id', orderId)
  .groupMatches('items', {
    count: { $count: true },
    total: { $sum: { $key: 'price' } },
    average: { $avg: { $key: 'price' } }
  })
  .first();

console.log(orderWithCount?.get('items.count'));
console.log(orderWithCount?.get('items.total'));
```

**Available Aggregation Operators:**
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

#### Vector Operations

Vector similarity searches are performed using distance expressions in filter operations and sort clauses:

```typescript
// Vector similarity search with distance threshold
const similar = await query
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
    order: 1, // 1 for ascending (closest first)
    expr: {
      $distance: [
        { $key: 'embedding' },
        { $value: queryVector }
      ]
    }
  }])
  .limit(10)
  .find();

// Available distance functions:
// $distance - Euclidean distance
// $innerProduct - Inner product
// $cosineDistance - Cosine distance
// $rectilinearDistance - Manhattan distance

// For structured vector fields (like coordinates):
const coordinateSearch = await query
  .filter({
    $expr: {
      $lt: [
        {
          $distance: [
            [{ $key: 'coordinates.x' }, { $key: 'coordinates.y' }, { $key: 'coordinates.z' }],
            { $value: [0, 0, 0] }
          ]
        },
        { $value: 10.0 }
      ]
    }
  })
  .find();
```

### Execution Methods

##### `find(options?): Promise<TObject[]>`
Execute query and return objects.

```typescript
const posts = await query.find();
const posts = await query.find({ master: true });
```

##### `first(options?): Promise<TObject | undefined>`
Get first matching object.

```typescript
const post = await query.first();
```

##### `get(id: string, options?): Promise<TObject>`
Get object by ID.

```typescript
const post = await query.get('post123');
```

##### `insert(data: Record<string, any>, options?): Promise<TObject>`
Create new object.

```typescript
const post = await client.Query('Post').insert({
  title: 'Hello World',
  content: 'This is my first post',
  author: currentUser
});
```

##### `updateOne(update: Record<string, TUpdateOp>, options?): Promise<TObject | undefined>`
Update a single record using update operations.

```typescript
const updated = await client.Query('Post')
  .equalTo('_id', 'post123')
  .updateOne({
    title: { $set: 'Updated Title' },
    views: { $inc: 1 },
    published: { $set: true }
  });
```

##### `updateMany(update: Record<string, TUpdateOp>, options?): Promise<TObject[]>`
Update multiple records using update operations.

```typescript
const updated = await client.Query('Post')
  .equalTo('category', 'tech')
  .updateMany({
    featured: { $set: true },
    views: { $inc: 10 }
  });
```

##### `upsertOne(update: Record<string, TUpdateOp>, setOnInsert: Record<string, any>, options?): Promise<TObject>`
Insert or update a single record.

```typescript
const user = await client.Query('User')
  .equalTo('username', 'john_doe')
  .upsertOne(
    { lastLogin: { $set: new Date() } },
    { username: 'john_doe', email: 'john@example.com', createdAt: new Date() }
  );
```

##### `upsertMany(update: Record<string, TUpdateOp>, setOnInsert: Record<string, any>, options?): Promise<TObject[]>`
Insert or update multiple records.

```typescript
const users = await client.Query('User')
  .equalTo('status', 'active')
  .upsertMany(
    { lastSeen: { $set: new Date() } },
    { status: 'active', createdAt: new Date() }
  );
```

#### Update Operations

The update methods use `TUpdateOp` objects with the following operators:

- **`$set`**: Set field value
- **`$inc`**: Increment number field
- **`$dec`**: Decrement number field  
- **`$mul`**: Multiply number field
- **`$div`**: Divide number field
- **`$max`**: Set to maximum of current and new value
- **`$min`**: Set to minimum of current and new value
- **`$addToSet`**: Add unique elements to array
- **`$push`**: Add elements to array
- **`$removeAll`**: Remove all matching elements from array
- **`$popFirst`**: Remove first N elements from array
- **`$popLast`**: Remove last N elements from array

```typescript
// Examples of update operations
await query.updateOne({
  title: { $set: 'New Title' },
  views: { $inc: 1 },
  tags: { $addToSet: ['javascript', 'typescript'] },
  comments: { $push: [newComment] },
  priority: { $max: 5 }
});
```

##### `deleteOne(options?): Promise<TObject | undefined>`
Delete a single matching record.

```typescript
const deleted = await client.Query('Post')
  .equalTo('_id', 'post123')
  .deleteOne();
```

##### `deleteMany(options?): Promise<TObject[]>`
Delete all matching records.

```typescript
const deleted = await client.Query('Post')
  .equalTo('published', false)
  .deleteMany();
```

---

## Schema Definition

### Field Types

#### `schema.boolean(defaultValue?)`
Boolean field.

```typescript
{
  active: schema.boolean(true),
  verified: schema.boolean()
}
```

#### `schema.number(defaultValue?)`
Number field.

```typescript
{
  score: schema.number(0),
  price: schema.number()
}
```

#### `schema.decimal(defaultValue?)`
High-precision decimal field.

```typescript
{
  balance: schema.decimal(new Decimal('0.00')),
  rate: schema.decimal()
}
```

#### `schema.string(defaultValue?)`
String field.

```typescript
{
  title: schema.string(),
  status: schema.string('draft')
}
```

#### `schema.stringArray(defaultValue?)`
Array of strings.

```typescript
{
  tags: schema.stringArray([]),
  categories: schema.stringArray()
}
```

#### `schema.date(defaultValue?)`
Date field.

```typescript
{
  publishedAt: schema.date(),
  createdAt: schema.date(() => new Date())
}
```

#### `schema.object(defaultValue?)`
Generic object field.

```typescript
{
  metadata: schema.object({}),
  settings: schema.object()
}
```

#### `schema.array(defaultValue?)`
Generic array field.

```typescript
{
  items: schema.array([]),
  data: schema.array()
}
```

#### `schema.vector(dimension, defaultValue?)`
Vector field for ML/AI applications.

```typescript
{
  embedding: schema.vector(1536), // OpenAI embedding
  features: schema.vector(512, new Array(512).fill(0))
}
```

#### `schema.shape(definition)`
Structured object with typed fields.

```typescript
{
  address: schema.shape({
    street: schema.string(),
    city: schema.string(),
    zipCode: schema.string(),
    country: schema.string('US')
  })
}
```

#### `schema.pointer(targetClass)`
Reference to another object.

```typescript
{
  author: schema.pointer('User'),
  category: schema.pointer('Category')
}
```

#### `schema.relation(targetClass, foreignField?)`
One-to-many relation.

```typescript
{
  posts: schema.relation('Post', 'author'),
  comments: schema.relation('Comment', 'post')
}
```

### Schema Configuration

#### Permission Values

Valid permission values in Proto.io:

- **`'*'`** - Public access (anyone)
- **`'role:roleName'`** - Users with specific role (e.g., `'role:admin'`, `'role:moderator'`)
- **User IDs** - Specific user access (e.g., `'user123'`)
- **`[]`** - Empty array (no access)

#### Class-Level Permissions

```typescript
{
  classLevelPermissions: {
    find: ['*'],                    // Public read
    get: ['*'],                     // Public get
    create: ['*'],                  // Public create
    update: ['role:admin'],         // Admin role only
    delete: ['role:admin']          // Admin role only
  }
}
```

#### Field-Level Permissions

```typescript
{
  fieldLevelPermissions: {
    email: {
      read: ['role:admin'],
      create: [],
      update: []
    },
    password: {
      create: [],
      update: []
    }
  }
}
```

#### Indexes

Proto.io supports two types of indexes:

**Basic Indexes** (default):
```typescript
{
  indexes: [
    { keys: { username: 1 }, unique: true },     // Unique ascending index
    { keys: { email: 1 }, unique: true },        // Unique ascending index
    { keys: { createdAt: -1 } },                 // Descending index
    { keys: { category: 1, priority: -1 } },     // Compound index
  ]
}
```

**Vector Indexes** (for AI/ML vector similarity):
```typescript
{
  indexes: [
    { 
      type: 'vector', 
      keys: 'embedding',                         // Single vector field
      method: 'hnsw'                            // Optional: 'hnsw' or 'ivfflat'
    },
    { 
      type: 'vector', 
      keys: ['x', 'y', 'z']                     // Multiple fields as vector
    }
  ]
}
```

**Index Properties**:
- `keys`: Field names with sort order (1 = ascending, -1 = descending) for basic indexes, or field name(s) for vector indexes
- `unique`: Boolean (basic indexes only) - ensures uniqueness
- `type`: 'basic' (default) or 'vector'
- `method`: 'hnsw' or 'ivfflat' (vector indexes only)

---

This API reference covers the core functionality of Proto.io. For more advanced usage and examples, see the full documentation and examples in the repository.
