import type { StandardSchemaV1 } from '@standard-schema/spec';

// Type utilities for schema unwrapping
type UnwrapSchema<T> = T extends StandardSchemaV1 ? T : never;

// Helper type to extract the original schema from a standard schema wrapper
type ExtractOriginalSchema<T> = T;

// Context type helper
type InferContext<T> = T extends undefined ? never : T;

// Operation interface
interface Operation<TInput, TOutput, TContext = never, TSchema extends StandardSchemaV1 = any> {
  execute(input: TInput): Promise<TOutput>;
  handler(args: [TContext] extends [never] 
    ? { input: TInput } 
    : { input: TInput; ctx: TContext }
  ): Promise<TOutput>;
  schema: TSchema;
}

// Builder interfaces for type-safe chaining
interface OpaBuilder<TContext = undefined> {
  operation: OperationBuilder<TContext>;
}

interface OperationBuilder<TContext = undefined> {
  input<TSchema extends StandardSchemaV1>(
    schema: TSchema
  ): OperationWithInput<StandardSchemaV1.InferInput<TSchema>, TSchema, TContext>;
}

interface OperationWithInput<TInput, TSchema extends StandardSchemaV1, TContext = undefined> {
  handler<TOutput>(
    fn: [TContext] extends [never]
      ? (args: { input: TInput }) => Promise<TOutput>
      : (args: { input: TInput; ctx: TContext }) => Promise<TOutput>
  ): Operation<TInput, TOutput, TContext, TSchema>;
}

// Context builder interface
interface OpaContextBuilder<TContext> {
  create(): OpaBuilder<TContext>;
}

// Factory interface
interface OpaFactory {
  create(): OpaBuilder<undefined>;
  context<TContext>(ctx: TContext): OpaContextBuilder<TContext>;
}

// Validation helper using the existing standardValidate function
async function validateInput<T extends StandardSchemaV1>(
  schema: T,
  input: unknown
): Promise<StandardSchemaV1.InferOutput<T>> {
  let result = schema['~standard'].validate(input);
  if (result instanceof Promise) result = await result;

  if (result.issues) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }

  return result.value;
}

// Implementation classes
class OperationImpl<TInput, TOutput, TContext = never, TSchema extends StandardSchemaV1 = any> implements Operation<TInput, TOutput, TContext, TSchema> {
  constructor(
    private _schema: TSchema,
    private _handler: any,
    private _context?: TContext
  ) {}

  async execute(input: TInput): Promise<TOutput> {
    // Validate input using standard schema
    const validatedInput = await validateInput(this._schema, input);
    
    // Call handler with validated input
    if (this._context !== undefined) {
      return this._handler({ input: validatedInput, ctx: this._context });
    } else {
      return this._handler({ input: validatedInput });
    }
  }

  async handler(args: any): Promise<TOutput> {
    return this._handler(args);
  }

  get schema() {
    return this._schema;
  }
}

class OperationWithInputImpl<TInput, TSchema extends StandardSchemaV1, TContext = undefined> implements OperationWithInput<TInput, TSchema, TContext> {
  constructor(
    private _schema: TSchema,
    private _context?: TContext
  ) {}

  handler<TOutput>(
    fn: [TContext] extends [never]
      ? (args: { input: TInput }) => Promise<TOutput>
      : (args: { input: TInput; ctx: TContext }) => Promise<TOutput>
  ): Operation<TInput, TOutput, TContext, TSchema> {
    return new OperationImpl<TInput, TOutput, TContext, TSchema>(this._schema, fn, this._context);
  }
}

class OperationBuilderImpl<TContext = undefined> implements OperationBuilder<TContext> {
  constructor(private _context?: TContext) {}

  input<TSchema extends StandardSchemaV1>(
    schema: TSchema
  ): OperationWithInput<StandardSchemaV1.InferInput<TSchema>, TSchema, TContext> {
    return new OperationWithInputImpl(schema, this._context);
  }
}

class OpaBuilderImpl<TContext = undefined> implements OpaBuilder<TContext> {
  constructor(private _context?: TContext) {}

  get operation(): OperationBuilder<TContext> {
    return new OperationBuilderImpl(this._context);
  }
}

class OpaContextBuilderImpl<TContext> implements OpaContextBuilder<TContext> {
  constructor(private _context: TContext) {}

  create(): OpaBuilder<TContext> {
    return new OpaBuilderImpl(this._context);
  }
}

// Main Opa class
export class Opa implements OpaFactory {
  static create(): OpaBuilder<undefined> {
    return new OpaBuilderImpl();
  }

  static context<TContext>(ctx: TContext): OpaContextBuilder<TContext> {
    return new OpaContextBuilderImpl(ctx);
  }

  // Instance methods (for potential future use)
  create(): OpaBuilder<undefined> {
    return Opa.create();
  }

  context<TContext>(ctx: TContext): OpaContextBuilder<TContext> {
    return Opa.context(ctx);
  }
}

// Standalone operation creator
export const op: OperationBuilder<undefined> = new OperationBuilderImpl();

// Export types for external use
export type { Operation, StandardSchemaV1 };