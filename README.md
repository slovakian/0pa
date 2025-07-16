# 0pa

```typescript
// Two ways to define operations
const op1 = op.input(schema).handler(async ({ input }) => result);
const op2 = Opa.context(ctx)
  .create()
  .operation.input(schema)
  .handler(async ({ input, ctx }) => result);

// Access properties
op1.execute(data); // validated
op1.schema; // schema
op1.handler(args); // direct
```

## Installation

```bash
npm install 0pa
```

## Works with Any Standard Schema Library

This package works with any library that implements the Standard Schema specification:

```typescript
// With Zod
import { z } from 'zod';
const zodSchema = z.string();

// With Valibot
import * as v from 'valibot';
const valibotSchema = v.string();

// With ArkType
import { type } from 'arktype';
const arkTypeSchema = type('string');

const op = Opa.create().operation;
// All work the same way!
const op1 = op.input(zodSchema).handler(async ({ input }) => input.toUpperCase());
const op2 = op.input(valibotSchema).handler(async ({ input }) => input.toUpperCase());
const op3 = op.input(arkTypeSchema).handler(async ({ input }) => input.toUpperCase());

// Access the original schema API through the operation's schema property
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const createUserOp = Opa.create()
  .operation.input(userSchema)
  .handler(async ({ input }) => ({ ...input, id: 'user-123' }));

// You can access all the original schema methods
const schemaKeys = Object.keys(createUserOp.schema.shape); // ['name', 'email']
const partialSchema = createUserOp.schema.partial(); // Zod partial schema
const pickedSchema = createUserOp.schema.pick({ name: true }); // Zod pick schema

// Works with other libraries too
const valibotUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const valibotOp = Opa.create()
  .operation.input(valibotUserSchema)
  .handler(async ({ input }) => input);

// Access Valibot schema methods
const valibotEntries = valibotOp.schema.entries; // Valibot schema entries
```

### Use with tRPC

You can integrate 0pa operations with tRPC by using the operation's schema directly in tRPC procedures:

```typescript
import { Opa } from '0pa';
import { z } from 'zod';
import { initTRPC } from '@trpc/server';

// Define your operation schema
const createPostSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
});

const baseOp = Opa.context({
  database: new Database(),
  logger: new Logger(),
}).create().operation;
// Create your operation with context
const createPostOp = baseOp.input(createPostSchema).handler(async ({ input, ctx }) => {
  // Your business logic here
  ctx.logger.info(`Creating post: ${input.title}`);
  return ctx.database.posts.create(input);
});

// tRPC setup
const t = initTRPC.context<{ session: { user: { id: string } } }>().create();

const appRouter = t.router({
  createPost: t.procedure
    // Use the operation's schema but omit userId since it comes from session
    .input(createPostOp.schema.omit({ userId: true }))
    .mutation(async ({ input, ctx }) => {
      // Execute the operation with userId from tRPC session
      return await createPostOp.execute({
        ...input,
        userId: ctx.session.user.id, // Inject userId from tRPC context
      });
    }),
});

// Client usage
const result = await trpc.createPost.mutate({
  title: 'My Blog Post',
  content: 'This is the content...',
  tags: ['typescript', 'trpc'],
  // No need to pass userId –– it's already injected from tRPC context
});
```

### Error Handling

When input validation fails, operations throw an error with validation details:

```typescript
import { Opa } from '0pa';
import { z } from 'zod';

const op = Opa.create()
  .operation.input(z.object({ name: z.string() }))
  .handler(async ({ input }) => input.name);

try {
  await op.execute({ name: 123 });
} catch (error) {
  console.log('Validation failed:', error.message);
}
```

## Advanced Example: Repos/Services Architecture

0pa can be used in a repos/services architecture, where repository operations are defined and then used within service operations:

```typescript
import { Opa } from '0pa';
import { z } from 'zod';

// Define repository context
interface RepoContext {
  db: Database;
  logger: {
    info: (msg: string) => void;
    error: (msg: string, err?: any) => void;
  };
}

// Create repo operation builder
const repoContext = {
  db: database,
  logger: {
    info: (msg) => console.log(`[REPO] ${msg}`),
    error: (msg, err) => console.error(`[REPO] ${msg}`, err),
  },
};

const repoOp = Opa.context(repoContext).create().operation;

// Define repository operations
const createUserRepoOp = repoOp
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(18),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const { db, logger } = ctx;

    logger.info(`Creating user in database: ${input.email}`);
    const user = await db.users.create(input);

    return user;
  });

const findUserByEmailRepoOp = repoOp.input(z.object({ email: z.string().email() })).handler(async ({ input, ctx }) => {
  const { db } = ctx;
  return await db.users.findByEmail(input.email);
});

// Create service context with repo operations
const serviceContext = {
  repos: {
    createUser: createUserRepoOp,
    findUserByEmail: findUserByEmailRepoOp,
  },
  logger: {
    info: (msg) => console.log(`[SERVICE] ${msg}`),
    error: (msg, err) => console.error(`[SERVICE] ${msg}`, err),
  },
};

const serviceOp = Opa.context(serviceContext).create().operation;

// Service operation that uses repo operations
const registerUserServiceOp = serviceOp
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(18),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const { repoOps, logger } = ctx;

    logger.info(`Registering new user: ${input.email}`);

    // Check if user already exists using repo operation
    const existingUser = await repos.findUserByEmail.execute({ email: input.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user using repo operation
    const user = await repos.createUser.execute(input);

    logger.info(`User registered successfully: ${user.id}`);
    return {
      user,
      message: 'User registered successfully',
    };
  });

// Usage
const result = await registerUserServiceOp.execute({
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
});
```

This architecture provides several benefits:

- **Separation of Concerns**: Each operation focuses on specific business logic
- **Reusability**: Operations can be composed and reused across different services
- **Type Safety**: Full TypeScript support with schema validation
- **Testability**: Easy to mock repositories and test business logic in isolation
- **Scalability**: Operations can be distributed across microservices while maintaining the same interface

## API Reference

### `Opa`

Main class for creating operations with optional context.

#### Static Methods

- `Opa.create(): OpaBuilder<undefined>` - Create a new operation builder without context
- `Opa.context<TContext>(ctx: TContext): OpaContextBuilder<TContext>` - Create a context builder with shared context

### Core Interfaces

#### `Operation<TInput, TOutput, TContext, TSchema>`

Represents an operation that can be executed.

- `execute(input: TInput): Promise<TOutput>` - Execute the operation with input validation
- `schema: TSchema` - The input schema
- `handler(args: { input: TInput; ctx?: TContext }): Promise<TOutput>` - The operation handler

#### `OpaBuilder<TContext>`

Builder for creating operations.

- `operation: OperationBuilder<TContext>` - Access to operation builder

#### `OperationBuilder<TContext>`

Builder for defining operation input and handler.

- `input<TSchema>(schema: TSchema): OperationWithInput<...>` - Set input schema

#### `OperationWithInput<TInput, TSchema, TContext>`

Builder for defining operation handler after input schema is set.

- `handler<TOutput>(fn: HandlerFunction): Operation<...>` - Set handler and create operation

#### `OpaContextBuilder<TContext>`

Builder for creating operations with shared context.

- `create(): OpaBuilder<TContext>` - Create a new operation builder with bound context

### Standalone Export

- `op: OperationBuilder<undefined>` - Standalone operation builder without context

### Types

- `Operation<TInput, TOutput, TContext, TSchema>` - Main operation interface
- `StandardSchemaV1` - Re-exported from @standard-schema/spec

## License

MIT
