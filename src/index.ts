import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface OpContext {
  [key: string]: unknown;
}

export interface OpHandler<TInput, TOutput, TContext = never> {
  (params: TContext extends never ? { input: TInput } : { input: TInput; ctx: TContext }): Promise<TOutput> | TOutput;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues?: ReadonlyArray<{ message: string }>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface Op<TInput, TOutput, TContext = never> {
  (input: TInput): Promise<TOutput>;
}

export interface OpBuilder<TInput, TOutput, TContext = never> {
  input<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, TOutput, TContext>;
  handler<TNewOutput>(handler: OpHandler<TInput, TNewOutput, TContext>): Op<TInput, TNewOutput, TContext>;
}

export interface OpFactory<TContext = never> {
  create(): {
    operation: {
      input<TSchema extends StandardSchemaV1>(
        schema: TSchema,
      ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, unknown, TContext>;
    };
  };
}

export interface OpFactoryBuilder {
  context<TContext extends OpContext>(contextObject: TContext): OpFactory<TContext>;
}

function createOp<TInput, TOutput, TContext = never>(
  schema: StandardSchemaV1 | null,
  handler: OpHandler<TInput, TOutput, TContext>,
  context: TContext,
): Op<TInput, TOutput, TContext> {
  const op = async (input: TInput): Promise<TOutput> => {
    let validatedInput: TInput;

    if (schema) {
      const result = schema['~standard'].validate(input);
      const resolvedResult = result instanceof Promise ? await result : result;

      if (resolvedResult.issues) {
        throw new ValidationError('Input validation failed', resolvedResult.issues);
      }

      validatedInput = (resolvedResult as any).value as TInput;
    } else {
      validatedInput = input;
    }

    const params =
      (context as any) === undefined || (context as any) === null
        ? { input: validatedInput }
        : { input: validatedInput, ctx: context };

    return handler(params as any);
  };

  return op as Op<TInput, TOutput, TContext>;
}

class OpBuilderImpl<TInput, TOutput, TContext = never> implements OpBuilder<TInput, TOutput, TContext> {
  constructor(
    private readonly schema: StandardSchemaV1 | null,
    private readonly context: TContext,
  ) {}

  input<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, TOutput, TContext> {
    return new OpBuilderImpl(schema, this.context);
  }

  handler<TNewOutput>(handler: OpHandler<TInput, TNewOutput, TContext>): Op<TInput, TNewOutput, TContext> {
    return createOp(this.schema, handler, this.context);
  }
}

class OpFactoryImpl<TContext = never> implements OpFactory<TContext> {
  constructor(private readonly context: TContext) {}

  create(): {
    operation: {
      input<TSchema extends StandardSchemaV1>(
        schema: TSchema,
      ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, unknown, TContext>;
    };
  } {
    return {
      operation: {
        input<TSchema extends StandardSchemaV1>(
          schema: TSchema,
        ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, unknown, TContext> {
          return new OpBuilderImpl<StandardSchemaV1.InferOutput<TSchema>, unknown, TContext>(schema, this.context);
        },
      },
    };
  }
}

export class Opa {
  static create(): {
    operation: {
      input<TSchema extends StandardSchemaV1>(
        schema: TSchema,
      ): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, unknown, never>;
    };
  } {
    return new OpFactoryImpl(undefined as never).create();
  }

  static context<TContext extends OpContext>(ctx: TContext): OpFactory<TContext> {
    return new OpFactoryImpl(ctx);
  }
}

// Standalone operation builder for direct use
export const op = {
  input<TSchema extends StandardSchemaV1>(schema: TSchema): OpBuilder<StandardSchemaV1.InferOutput<TSchema>, unknown, never> {
    return new OpBuilderImpl<StandardSchemaV1.InferOutput<TSchema>, unknown, never>(schema, undefined as never);
  }
};
