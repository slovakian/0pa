import { defineOperation } from './operation';
import type { InferInput } from './operation';
import type { StandardSchemaV1 } from '@standard-schema/spec';

// Contextual operation interface
export interface ContextualOperation<TSchema extends StandardSchemaV1> {
  handler: (input: InferInput<TSchema>, ctx?: any) => unknown;
  schema: TSchema;
  execute: (input: InferInput<TSchema>, ctx?: any) => Promise<unknown>;
}

export interface ContextualOperationWithContext<TSchema extends StandardSchemaV1, TContext> {
  handler: (input: InferInput<TSchema>, ctx: TContext) => unknown;
  schema: TSchema;
  execute: (input: InferInput<TSchema>, ctx: TContext) => Promise<unknown>;
}

export interface ContextualOperationNoContext<TSchema extends StandardSchemaV1> {
  handler: (input: InferInput<TSchema>) => unknown;
  schema: TSchema;
  execute: (input: InferInput<TSchema>) => Promise<unknown>;
}

// Case 1: Type-only context - requires context at execution
export function withContext<TContext>(
  operationDefiner: typeof defineOperation
): <TSchema extends StandardSchemaV1>(
  schema: TSchema,
  handler: (params: {
    input: InferInput<TSchema>;
    schema: TSchema;
    ctx: TContext;
  }) => any
) => ContextualOperationWithContext<TSchema, TContext>;

// Case 2: Value-only context - no context required at execution
export function withContext<TProvidedContext extends Record<string, any>>(
  operationDefiner: typeof defineOperation,
  providedContext: TProvidedContext
): <TSchema extends StandardSchemaV1>(
  schema: TSchema,
  handler: (params: {
    input: InferInput<TSchema>;
    schema: TSchema;
    ctx: TProvidedContext;
  }) => any
) => ContextualOperationNoContext<TSchema>;

// Case 3: Merged context - combining both approaches
export function withContext<TRequiredContext>(
  operationDefiner: typeof defineOperation,
  providedContext: Record<string, any>
): <TSchema extends StandardSchemaV1>(
  schema: TSchema,
  handler: (params: {
    input: InferInput<TSchema>;
    schema: TSchema;
    ctx: TRequiredContext & typeof providedContext;
  }) => any
) => ContextualOperationWithContext<TSchema, TRequiredContext>;

// Implementation
export function withContext(
  operationDefiner: typeof defineOperation,
  providedContext?: Record<string, any>
): any {
  if (providedContext !== undefined) {
    // Cases 2 & 3: Context value provided
    return function createContextualOperation<TSchema extends StandardSchemaV1>(
      schema: TSchema,
      handler: (params: { input: InferInput<TSchema>; schema: TSchema; ctx: any }) => any
    ) {
      const validateInput = async (input: unknown): Promise<InferInput<TSchema>> => {
        if ('~standard' in schema) {
          const result = schema['~standard'].validate(input);
          if (result instanceof Promise) {
            const resolved = await result;
            if (resolved.issues) {
              throw new Error(`Validation failed: ${JSON.stringify(resolved.issues)}`);
            }
            return resolved.value as InferInput<TSchema>;
          } else {
            if (result.issues) {
              throw new Error(`Validation failed: ${JSON.stringify(result.issues)}`);
            }
            return result.value as InferInput<TSchema>;
          }
        }
        return input as InferInput<TSchema>;
      };

      return {
        schema,
        handler: (input: InferInput<TSchema>, additionalCtx?: any) => {
          const mergedCtx = additionalCtx 
            ? Object.assign({}, providedContext, additionalCtx) 
            : providedContext;
          return handler({ input, schema, ctx: mergedCtx });
        },
        execute: async (input: InferInput<TSchema>, additionalCtx?: any) => {
          const validatedInput = await validateInput(input);
          const mergedCtx = additionalCtx 
            ? Object.assign({}, providedContext, additionalCtx) 
            : providedContext;
          return handler({ input: validatedInput, schema, ctx: mergedCtx });
        },
      };
    };
  } else {
    // Case 1: Type-only context
    return function createTypedContextualOperation<TSchema extends StandardSchemaV1>(
      schema: TSchema,
      handler: (params: { input: InferInput<TSchema>; schema: TSchema; ctx: any }) => any
    ) {
      const validateInput = async (input: unknown): Promise<InferInput<TSchema>> => {
        if ('~standard' in schema) {
          const result = schema['~standard'].validate(input);
          if (result instanceof Promise) {
            const resolved = await result;
            if (resolved.issues) {
              throw new Error(`Validation failed: ${JSON.stringify(resolved.issues)}`);
            }
            return resolved.value as InferInput<TSchema>;
          } else {
            if (result.issues) {
              throw new Error(`Validation failed: ${JSON.stringify(result.issues)}`);
            }
            return result.value as InferInput<TSchema>;
          }
        }
        return input as InferInput<TSchema>;
      };

      return {
        schema,
        handler: (input: InferInput<TSchema>, ctx: any) => {
          return handler({ input, schema, ctx });
        },
        execute: async (input: InferInput<TSchema>, ctx: any) => {
          const validatedInput = await validateInput(input);
          return handler({ input: validatedInput, schema, ctx });
        },
      };
    };
  }
}
