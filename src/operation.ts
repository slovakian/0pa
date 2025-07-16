import type { StandardSchemaV1 } from '@standard-schema/spec';

// Type helpers for Standard Schema
export type InferInput<T> = T extends StandardSchemaV1<infer I, any> ? I : unknown;
export type InferOutput<T> = T extends StandardSchemaV1<any, infer O> ? O : unknown;

// Handler type for operations with schema
type OperationHandler<TSchema extends StandardSchemaV1> = (params: {
  input: InferInput<TSchema>;
  schema: TSchema;
}) => any;

// Operation interface
export interface Operation<TSchema extends StandardSchemaV1> {
  handler: (input: InferInput<TSchema>) => any;
  schema: TSchema;
  execute: (input: InferInput<TSchema>) => Promise<InferOutput<TSchema>>;
}

// Simple defineOperation function
export function defineOperation<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  handler: OperationHandler<TSchema>,
): Operation<TSchema> {
  return {
    handler: (input: InferInput<TSchema>) => {
      return handler({ input, schema });
    },
    schema,
    execute: async (input: InferInput<TSchema>): Promise<InferOutput<TSchema>> => {
      // Validate input using Standard Schema
      let result = schema['~standard'].validate(input);
      if (result instanceof Promise) result = await result;

      if (result.issues) {
        throw new Error(`Validation failed: ${JSON.stringify(result.issues, null, 2)}`);
      }

      // Call handler with validated input and schema
      const validatedInput = (result as any).value as InferInput<TSchema>;
      const handlerResult = await handler({ input: validatedInput, schema });
      return handlerResult as InferOutput<TSchema>;
    },
  };
}
