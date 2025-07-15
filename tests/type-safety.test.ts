import { describe, it, expect, expectTypeOf } from 'vitest';
import { Opa, op, type Operation } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';
import type { StandardSchemaV1 } from '@standard-schema/spec';

describe('Type Safety and TypeScript Features', () => {
  describe('Input type inference', () => {
    it('should infer correct input types from valibot schemas', async () => {
      const schema = v.object({
        name: v.string(),
        age: v.number(),
        active: v.boolean(),
        tags: v.array(v.string()),
      });

      const operation = op.input(schema).handler(async ({ input }) => {
        // TypeScript should infer these types correctly
        expectTypeOf(input.name).toEqualTypeOf<string>();
        expectTypeOf(input.age).toEqualTypeOf<number>();
        expectTypeOf(input.active).toEqualTypeOf<boolean>();
        expectTypeOf(input.tags).toEqualTypeOf<string[]>();

        return `${input.name} is ${input.age} years old`;
      });

      const result = await operation.execute({
        name: 'John',
        age: 30,
        active: true,
        tags: ['developer', 'typescript'],
      });

      expect(result).toBe('John is 30 years old');
    });

    it('should infer correct input types from zod schemas', async () => {
      const schema = z.object({
        email: z.string().email(),
        count: z.number().positive(),
        metadata: z.record(z.string(), z.any()),
      });

      const operation = op.input(schema).handler(async ({ input }) => {
        expectTypeOf(input.email).toEqualTypeOf<string>();
        expectTypeOf(input.count).toEqualTypeOf<number>();
        expectTypeOf(input.metadata).toEqualTypeOf<Record<string, any>>();

        return { processedEmail: input.email.toLowerCase(), doubledCount: input.count * 2 };
      });

      const result = await operation.execute({
        email: 'TEST@EXAMPLE.COM',
        count: 5,
        metadata: { source: 'test' },
      });

      expect(result).toEqual({ processedEmail: 'test@example.com', doubledCount: 10 });
    });

    it('should infer correct input types from arktype schemas', async () => {
      const schema = type({
        id: 'string',
        priority: '1 | 2 | 3',
        config: {
          enabled: 'boolean',
          'timeout?': 'number',
        },
      });

      const operation = op.input(schema).handler(async ({ input }) => {
        expectTypeOf(input.id).toEqualTypeOf<string>();
        expectTypeOf(input.priority).toEqualTypeOf<1 | 2 | 3>();
        expectTypeOf(input.config.enabled).toEqualTypeOf<boolean>();
        expectTypeOf(input.config.timeout).toEqualTypeOf<number | undefined>();

        return {
          id: input.id,
          isHighPriority: input.priority === 1,
          hasTimeout: input.config.timeout !== undefined,
        };
      });

      const result = await operation.execute({
        id: 'task-123',
        priority: 1,
        config: { enabled: true },
      });

      expect(result).toEqual({
        id: 'task-123',
        isHighPriority: true,
        hasTimeout: false,
      });
    });
  });

  describe('Context type inference', () => {
    it('should infer context types correctly', async () => {
      interface DatabaseContext {
        db: {
          host: string;
          port: number;
          credentials: {
            username: string;
            password: string;
          };
        };
        logger: {
          info: (message: string) => void;
          error: (message: string) => void;
        };
      }

      const context: DatabaseContext = {
        db: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'admin',
            password: 'secret',
          },
        },
        logger: {
          info: (msg) => console.log(`INFO: ${msg}`),
          error: (msg) => console.error(`ERROR: ${msg}`),
        },
      };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ query: v.string() }))
        .handler(async ({ input, ctx }) => {
          // TypeScript should infer context types
          expectTypeOf(ctx.db.host).toEqualTypeOf<string>();
          expectTypeOf(ctx.db.port).toEqualTypeOf<number>();
          expectTypeOf(ctx.db.credentials.username).toEqualTypeOf<string>();
          expectTypeOf(ctx.logger.info).toEqualTypeOf<(message: string) => void>();

          return {
            query: input.query,
            host: ctx.db.host,
            port: ctx.db.port,
            user: ctx.db.credentials.username,
          };
        });

      const result = await operation.execute({ query: 'SELECT * FROM users' });
      expect(result).toEqual({
        query: 'SELECT * FROM users',
        host: 'localhost',
        port: 5432,
        user: 'admin',
      });
    });

    it('should handle optional context properties', async () => {
      interface OptionalContext {
        required: string;
        optional?: number;
        nested: {
          value: string;
          optional?: boolean;
        };
      }

      const context: OptionalContext = {
        required: 'test',
        nested: {
          value: 'nested-value',
        },
      };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ input: v.string() }))
        .handler(async ({ input, ctx }) => {
          expectTypeOf(ctx.required).toEqualTypeOf<string>();
          expectTypeOf(ctx.optional).toEqualTypeOf<number | undefined>();
          expectTypeOf(ctx.nested.value).toEqualTypeOf<string>();
          expectTypeOf(ctx.nested.optional).toEqualTypeOf<boolean | undefined>();

          return {
            input: input.input,
            required: ctx.required,
            hasOptional: ctx.optional !== undefined,
            nestedValue: ctx.nested.value,
            hasNestedOptional: ctx.nested.optional !== undefined,
          };
        });

      const result = await operation.execute({ input: 'test-input' });
      expect(result).toEqual({
        input: 'test-input',
        required: 'test',
        hasOptional: false,
        nestedValue: 'nested-value',
        hasNestedOptional: false,
      });
    });
  });

  describe('Return type inference', () => {
    it('should infer return types correctly', async () => {
      const operation = op.input(v.object({ value: v.number() })).handler(async ({ input }) => ({
        original: input.value,
        doubled: input.value * 2,
        isEven: input.value % 2 === 0,
        metadata: {
          processedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      }));

      // TypeScript should infer the return type
      type ExpectedReturnType = {
        original: number;
        doubled: number;
        isEven: boolean;
        metadata: {
          processedAt: string;
          version: string;
        };
      };

      const result = await operation.execute({ value: 10 });
      expectTypeOf(result).toEqualTypeOf<ExpectedReturnType>();

      expect(result.original).toBe(10);
      expect(result.doubled).toBe(20);
      expect(result.isEven).toBe(true);
      expect(typeof result.metadata.processedAt).toBe('string');
      expect(result.metadata.version).toBe('1.0.0');
    });
  });

  describe('Schema type preservation', () => {
    it('should preserve valibot schema type', () => {
      const schema = v.object({ test: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.test);

      expectTypeOf(operation.schema).toEqualTypeOf<typeof schema>();
      expect(operation.schema).toBe(schema);
    });

    it('should preserve zod schema type', () => {
      const schema = z.object({ test: z.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.test);

      expectTypeOf(operation.schema).toEqualTypeOf<typeof schema>();
      expect(operation.schema).toBe(schema);
    });

    it('should preserve arktype schema type', () => {
      const schema = type({ test: 'string' });
      const operation = op.input(schema).handler(async ({ input }) => input.test);

      expectTypeOf(operation.schema).toEqualTypeOf<typeof schema>();
      expect(operation.schema).toBe(schema);
    });
  });

  describe('Operation interface compliance', () => {
    it('should implement Operation interface correctly', () => {
      const schema = v.object({ value: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.value.toUpperCase());

      // Should implement the Operation interface
      expectTypeOf(operation).toMatchTypeOf<Operation<{ value: string }, string, never, typeof schema>>();

      // Should have all required methods
      expectTypeOf(operation.execute).toEqualTypeOf<(input: { value: string }) => Promise<string>>();
      expectTypeOf(operation.handler).toEqualTypeOf<(args: { input: { value: string } }) => Promise<string>>();
      expectTypeOf(operation.schema).toEqualTypeOf<typeof schema>();
    });

    it('should implement Operation interface with context correctly', () => {
      const schema = v.object({ value: v.string() });
      const context = { prefix: 'Hello' };
      const operation = Opa.context(context)
        .create()
        .operation.input(schema)
        .handler(async ({ input, ctx }) => `${ctx.prefix} ${input.value}`);

      // Should implement the Operation interface with context
      expectTypeOf(operation).toMatchTypeOf<Operation<{ value: string }, string, typeof context, typeof schema>>();

      // Handler should require context
      expectTypeOf(operation.handler).toEqualTypeOf<
        (args: { input: { value: string }; ctx: typeof context }) => Promise<string>
      >();
    });
  });

  describe('Standard Schema compliance', () => {
    it('should work with any StandardSchemaV1 compliant schema', async () => {
      // Custom schema that implements StandardSchemaV1
      const customSchema: StandardSchemaV1<{ custom: string }, { custom: string }> = {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: (input: unknown) => {
            if (typeof input === 'object' && input !== null && 'custom' in input) {
              const obj = input as any;
              if (typeof obj.custom === 'string') {
                return { value: { custom: obj.custom } };
              }
            }
            return { issues: [{ message: 'Invalid custom input' }] };
          },
          types: undefined,
        },
      };

      const operation = op.input(customSchema).handler(async ({ input }) => `Custom: ${input.custom}`);

      const result = await operation.execute({ custom: 'test' });
      expect(result).toBe('Custom: test');
      expect(operation.schema).toBe(customSchema);
    });
  });
});
