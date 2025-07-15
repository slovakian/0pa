# 0pa

A TypeScript library for creating type-safe, composable operations with schema validation and context management.

## Features

- **Type-safe operations** with full TypeScript support
- **Schema validation** using popular libraries (Zod, Valibot, ArkType)
- **Context management** for dependency injection and shared state
- **Composable architecture** for building complex business logic
- **Zero dependencies**
- **Lightweight** and performant

## Installation

```bash
npm install 0pa
# or
pnpm add 0pa
# or
yarn add 0pa
```

To leverage 0pa's validation capabilities, you can use any Standard Schema-compliant validation library like Zod, Valibot, or ArkType:

```bash
# Choose one:
npm install zod              # Zod 3.24.0+
npm install valibot          # Valibot v1.0+
npm install arktype          # ArkType v2.0+
```

## Philosophy

0pa is built around the factory pattern for operations, which provides several key benefits:

- **Consistent Context Management**: All operations require context to be defined upfront, eliminating runtime context errors
- **Type Safety**: Context types are locked in at factory creation time, providing full TypeScript support throughout the operation lifecycle
- **Dependency Injection**: Context serves as a dependency injection container, making operations testable and portable
- **Composability**: Operations created from the same factory share context, enabling easy composition of complex business logic
- **Clarity**: The factory pattern makes it explicit what dependencies an operation needs

## Quick Start

### Basic Operation

```typescript
import { opFactory } from '0pa';
import { z } from 'zod'; // or any Standard Schema library

// Define your schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0),
});

const createOp = opFactory().context({}).create();

// Create an operation using a factory with empty context
const createUser = createOp()
  .input(UserSchema)
  .handler(async ({ input, ctx }) => {
    // input is fully typed based on your schema
    console.log(`Creating user: ${input.name}`);

    // Your business logic here
    const user = {
      id: Math.random().toString(36),
      ...input,
      createdAt: new Date(),
    };

    return user;
  });

// Execute the operation (context is already bound)
const result = await createUser.execute({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
});
```

### Context Usage

Context is a powerful feature that allows you to inject dependencies and share state across operations. In 0pa, context is always provided upfront when creating the operation factory, ensuring type safety and eliminating the need to pass context during execution.

#### Understanding Context Scope

Context in 0pa has the following characteristics:

- **Factory-bound**: Context is set once when creating the factory and is shared across all operations created from that factory
- **Type-safe**: Context types are locked in at factory creation time, providing full TypeScript support
- **Immutable**: Once set, context cannot be changed for operations created from that factory
- **Accessible**: All operations created from the factory have access to the same context instance

#### Database and Logger Context

```typescript
import { createOpFactory } from '0pa';
import { z } from 'zod';

// Define your context type
interface AppContext {
  database: {
    save: (data: any) => Promise<any>;
    find: (id: string) => Promise<any>;
  };
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

// Create a factory with context
const context: AppContext = {
  database: {
    save: async (data) => ({ ...data, id: 'saved-id' }),
    find: async (id) => ({ id, name: 'Found User' }),
  },
  logger: {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
  },
};

const opFactory = createOpFactory().context<AppContext>(context).create();

// Create operations using the factory
const saveUser = opFactory
  .create()
  .input(
    z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    ctx.logger.info(`Saving user: ${input.name}`);

    try {
      const savedUser = await ctx.database.save(input);
      ctx.logger.info(`User saved with ID: ${savedUser.id}`);
      return savedUser;
    } catch (error) {
      ctx.logger.error(`Failed to save user: ${error}`);
      throw error;
    }
  });

// Execute (context is already bound to the factory operation)
const user = await saveUser.execute({
  name: 'Jane Doe',
  email: 'jane@example.com',
});
```

### Works with Any Standard Schema Library

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

// All work the same way!
const factory = createOpFactory().context({});

const op1 = factory
  .create()
  .input(zodSchema)
  .handler(async ({ input }) => input.toUpperCase());
const op2 = factory
  .create()
  .input(valibotSchema)
  .handler(async ({ input }) => input.toUpperCase());
const op3 = factory
  .create()
  .input(arkTypeSchema)
  .handler(async ({ input }) => input.toUpperCase());

// Access the original schema API through the operation's schema property
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const createUserOp = factory
  .create()
  .input(userSchema)
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

const valibotOp = factory
  .create()
  .input(valibotUserSchema)
  .handler(async ({ input }) => input);

// Access Valibot schema methods
const valibotEntries = valibotOp.schema.entries; // Valibot schema entries
```

### Use with tRPC

You can integrate 0pa operations with tRPC by using the operation's schema directly in tRPC procedures:

```typescript
import { createOpFactory } from '0pa';
import { z } from 'zod';
import { initTRPC } from '@trpc/server';

// Define your operation schema
const createPostSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
});

// Create your operation factory with context
const opFactory = createOpFactory().context<{
  database: Database;
  logger: Logger;
}>({
  database: new Database(),
  logger: new Logger(),
});

// Create your operation
const createPostOp = opFactory
  .create()
  .input(createPostSchema)
  .handler(async ({ input, ctx }) => {
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
      return createPostOp.execute({
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

When input validation fails, operations throw a `ValidationError`:

```typescript
import { createOpFactory, ValidationError } from '0pa';
import { z } from 'zod';

const op = createOpFactory()
  .context({})
  .create()
  .input(z.object({ name: z.string() }))
  .handler(async ({ input }) => input.name);

try {
  await op.execute({ name: 123 });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.issues);
  }
}
```

## Advanced Example: Repos/Services Architecture

Here's how 0pa can be used in a larger application with a repos/services architecture, where services have access to multiple repositories and can compose complex business logic:

```typescript
import { createOpFactory } from '0pa';
import { z } from 'zod';

// Define your service context with access to multiple repos
interface ServiceContext {
  repos: {
    users: UserRepository;
    orders: OrderRepository;
    payments: PaymentRepository;
  };
  logger: {
    info: (msg: string) => void;
    error: (msg: string, err?: any) => void;
  };
  config: {
    maxOrderValue: number;
    taxRate: number;
  };
}

// Create a service factory
const context: ServiceContext = {
  repos: {
    users: new UserRepositoryImpl(),
    orders: new OrderRepositoryImpl(),
    payments: new PaymentRepositoryImpl(),
  },
  logger: {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
  },
  config: {
    maxOrderValue: 10000,
    taxRate: 0.08,
  },
};

const serviceFactory = createOpFactory().context<ServiceContext>(context);

// User Service Operations
const createUserOp = serviceFactory
  .create()
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(18),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const { repos, logger } = ctx;

    // Check if user already exists
    const existingUser = await repos.users.findByEmail(input.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    logger.info(`Creating new user: ${input.email}`);
    const user = await repos.users.create(input);

    logger.info(`User created successfully: ${user.id}`);
    return user;
  });

// Order Service Operations - Complex business logic using multiple repos
const createOrderOp = serviceFactory
  .create()
  .input(
    z.object({
      userId: z.string(),
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().min(1),
          price: z.number().min(0),
        }),
      ),
      paymentMethod: z.enum(['credit_card', 'paypal', 'bank_transfer']),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const { repos, logger, config } = ctx;

    // 1. Validate user exists
    logger.info(`Processing order for user: ${input.userId}`);
    const user = await repos.users.findById(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 2. Calculate order total
    const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * config.taxRate;
    const total = subtotal + tax;

    // 3. Validate order value
    if (total > config.maxOrderValue) {
      throw new Error(`Order value ${total} exceeds maximum allowed ${config.maxOrderValue}`);
    }

    // 4. Create order
    const orderData = {
      userId: input.userId,
      items: input.items,
      subtotal,
      tax,
      total,
      status: 'pending' as OrderStatus,
    };

    const order = await repos.orders.create(orderData);
    logger.info(`Order created: ${order.id}`);

    // 5. Process payment
    try {
      const paymentResult = await repos.payments.processPayment({
        orderId: order.id,
        amount: total,
        method: input.paymentMethod,
        userId: input.userId,
      });

      if (paymentResult.success) {
        // Update order status
        const updatedOrder = await repos.orders.updateStatus(order.id, 'paid');
        logger.info(`Payment successful for order: ${order.id}`);

        return {
          order: updatedOrder,
          payment: paymentResult,
        };
      } else {
        // Payment failed, update order status
        await repos.orders.updateStatus(order.id, 'payment_failed');
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }
    } catch (error) {
      logger.error(`Payment processing failed for order: ${order.id}`, error);
      await repos.orders.updateStatus(order.id, 'payment_failed');
      throw error;
    }
  });

// User Analytics Service - Aggregating data from multiple repos
const getUserAnalyticsOp = serviceFactory
  .create()
  .input(
    z.object({
      userId: z.string(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const { repos, logger } = ctx;

    logger.info(`Generating analytics for user: ${input.userId}`);

    // Fetch user data
    const user = await repos.users.findById(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch user's orders
    const orders = await repos.orders.findByUserId(input.userId);

    // Calculate analytics
    const totalOrders = orders.length;
    const totalSpent = orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.total, 0);

    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    const analytics = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        memberSince: user.createdAt,
      },
      orders: {
        total: totalOrders,
        totalSpent,
        averageOrderValue,
        lastOrderDate: orders.length > 0 ? Math.max(...orders.map((o) => o.createdAt.getTime())) : null,
      },
    };

    logger.info(`Analytics generated for user: ${input.userId}`);
    return analytics;
  });

// Usage in your application

// Execute operations (context is already bound)
const newUser = await createUserOp.execute({
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
});

const orderResult = await createOrderOp.execute({
  userId: newUser.id,
  items: [
    { productId: 'prod-1', quantity: 2, price: 29.99 },
    { productId: 'prod-2', quantity: 1, price: 49.99 },
  ],
  paymentMethod: 'credit_card',
});

const analytics = await getUserAnalyticsOp.execute({
  userId: newUser.id,
});
```

This architecture provides several benefits:

- **Separation of Concerns**: Each operation focuses on specific business logic
- **Reusability**: Operations can be composed and reused across different services
- **Type Safety**: Full TypeScript support with schema validation
- **Testability**: Easy to mock repositories and test business logic in isolation
- **Scalability**: Operations can be distributed across microservices while maintaining the same interface

## API Reference

### `createOpFactory()`

Creates a new operation factory builder that allows you to define shared context.

**Returns:** `OpFactoryBuilder`

### Core Interfaces

#### `Op<TInput, TOutput, TContext, TSchema>`

Represents an operation with bound context that can be executed.

- `execute(input: unknown): Promise<TOutput>` - Execute the operation (context is pre-bound)
- `schema: TSchema` - The input schema
- `handler: OpHandler<TInput, TOutput, TContext>` - The operation handler
- `context: TContext` - The bound context

#### `OpFactoryBuilder`

Builder for creating operation factories.

- `context<TContext>(context: TContext): OpFactory<TContext>` - Set shared context and create factory

#### `OpFactory<TContext>`

Factory for creating operations with shared context.

- `create(): OpBuilder<...>` - Create a new operation builder

#### `OpBuilder<TInput, TOutput, TContext, TSchema>`

Builder for creating operations from a factory.

- `input<TNewSchema>(schema: TNewSchema): OpBuilder<...>` - Set input schema
- `handler<TNewOutput>(handler: OpHandler<TInput, TNewOutput, TContext>): Op<...>` - Set handler and create operation

### Types

- `OpContext` - Base context interface (extends `Record<string, unknown>`)
- `OpHandler<TInput, TOutput, TContext>` - Handler function type: `(params: { input: TInput; ctx: TContext }) => Promise<TOutput> | TOutput`
- `ValidationError` - Error thrown when input validation fails, contains `issues: ReadonlyArray<{ message: string }>`

## License

MIT
