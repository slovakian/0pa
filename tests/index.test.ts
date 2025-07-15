import { describe, it, expect } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Opa Package Integration Tests', () => {
  describe('Basic functionality verification', () => {
    it('should create standalone operations', async () => {
      const operation = op.input(v.object({ name: v.string() })).handler(async ({ input }) => `Hello, ${input.name}!`);

      const result = await operation.execute({ name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('should create context-free operations', async () => {
      const operation = Opa.create()
        .operation.input(z.object({ value: z.number() }))
        .handler(async ({ input }) => input.value * 2);

      const result = await operation.execute({ value: 21 });
      expect(result).toBe(42);
    });

    it('should create context-based operations', async () => {
      const context = { multiplier: 3 };
      const operation = Opa.context(context)
        .create()
        .operation.input(type({ value: 'number' }))
        .handler(async ({ input, ctx }) => input.value * ctx.multiplier);

      const result = await operation.execute({ value: 14 });
      expect(result).toBe(42);
    });
  });

  describe('Schema library compatibility', () => {
    it('should work with all supported schema libraries', async () => {
      // Valibot
      const valibotOp = op
        .input(v.object({ type: v.literal('valibot'), data: v.string() }))
        .handler(async ({ input }) => ({ library: input.type, processed: input.data.toUpperCase() }));

      // Zod
      const zodOp = op
        .input(z.object({ type: z.literal('zod'), data: z.string() }))
        .handler(async ({ input }) => ({ library: input.type, processed: input.data.toLowerCase() }));

      // ArkType
      const arkOp = op
        .input(type({ type: "'arktype'", data: 'string' }))
        .handler(async ({ input }) => ({ library: input.type, processed: input.data.split('').reverse().join('') }));

      const valibotResult = await valibotOp.execute({ type: 'valibot', data: 'test' });
      const zodResult = await zodOp.execute({ type: 'zod', data: 'TEST' });
      const arkResult = await arkOp.execute({ type: 'arktype', data: 'hello' });

      expect(valibotResult).toEqual({ library: 'valibot', processed: 'TEST' });
      expect(zodResult).toEqual({ library: 'zod', processed: 'test' });
      expect(arkResult).toEqual({ library: 'arktype', processed: 'olleh' });
    });
  });

  describe('Error handling verification', () => {
    it('should handle validation errors properly', async () => {
      const operation = op
        .input(v.object({ email: v.pipe(v.string(), v.email()) }))
        .handler(async ({ input }) => `Valid email: ${input.email}`);

      await expect(operation.execute({ email: 'invalid-email' } as any)).rejects.toThrow();

      const validResult = await operation.execute({ email: 'test@example.com' });
      expect(validResult).toBe('Valid email: test@example.com');
    });

    it('should handle handler errors properly', async () => {
      const operation = op.input(v.object({ shouldFail: v.boolean() })).handler(async ({ input }) => {
        if (input.shouldFail) {
          throw new Error('Handler error');
        }
        return 'Success';
      });

      await expect(operation.execute({ shouldFail: true })).rejects.toThrow('Handler error');

      const successResult = await operation.execute({ shouldFail: false });
      expect(successResult).toBe('Success');
    });
  });

  describe('Type safety verification', () => {
    it('should preserve schema types', () => {
      const schema = v.object({ test: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.test);

      expect(operation.schema).toBe(schema);
    });

    it('should provide proper handler access', async () => {
      const operation = op.input(v.object({ value: v.number() })).handler(async ({ input }) => input.value * 2);

      // Direct handler call
      const handlerResult = await operation.handler({ input: { value: 10 } });
      expect(handlerResult).toBe(20);

      // Execute call
      const executeResult = await operation.execute({ value: 10 });
      expect(executeResult).toBe(20);
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle concurrent operations', async () => {
      const operation = op.input(v.object({ id: v.number(), delay: v.number() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return { id: input.id, timestamp: Date.now() };
      });

      const promises = Array.from({ length: 5 }, (_, i) => operation.execute({ id: i, delay: 10 }));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.id).toBe(index);
        expect(typeof result.timestamp).toBe('number');
      });
    });
  });

  describe('Complex data structures', () => {
    it('should handle nested objects and arrays', async () => {
      const schema = v.object({
        user: v.object({
          id: v.number(),
          profile: v.object({
            name: v.string(),
            preferences: v.object({
              theme: v.union([v.literal('light'), v.literal('dark')]),
              notifications: v.boolean(),
            }),
          }),
        }),
        posts: v.array(
          v.object({
            id: v.number(),
            title: v.string(),
            tags: v.array(v.string()),
          }),
        ),
      });

      const operation = op.input(schema).handler(async ({ input }) => {
        return {
          userId: input.user.id,
          userName: input.user.profile.name,
          theme: input.user.profile.preferences.theme,
          postCount: input.posts.length,
          totalTags: input.posts.reduce((sum, post) => sum + post.tags.length, 0),
        };
      });

      const complexData = {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            preferences: {
              theme: 'dark' as const,
              notifications: true,
            },
          },
        },
        posts: [
          { id: 1, title: 'First Post', tags: ['tech', 'typescript'] },
          { id: 2, title: 'Second Post', tags: ['programming', 'javascript', 'node'] },
        ],
      };

      const result = await operation.execute(complexData);
      expect(result).toEqual({
        userId: 1,
        userName: 'John Doe',
        theme: 'dark',
        postCount: 2,
        totalTags: 5,
      });
    });
  });

  describe('Method chaining and fluent API', () => {
    it('should support fluent method chaining', async () => {
      const context = { prefix: 'Processed:' };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ data: v.string() }))
        .handler(async ({ input, ctx }) => `${ctx.prefix} ${input.data}`);

      const result = await operation.execute({ data: 'Hello World' });
      expect(result).toBe('Processed: Hello World');
    });

    it('should maintain type safety through the chain', async () => {
      interface CustomContext {
        config: {
          apiKey: string;
          timeout: number;
        };
        utils: {
          format: (text: string) => string;
        };
      }

      const context: CustomContext = {
        config: {
          apiKey: 'secret-key',
          timeout: 5000,
        },
        utils: {
          format: (text: string) => `[${text.toUpperCase()}]`,
        },
      };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ message: v.string() }))
        .handler(async ({ input, ctx }) => {
          return {
            formatted: ctx.utils.format(input.message),
            apiKey: ctx.config.apiKey.substring(0, 6) + '***',
            timeout: ctx.config.timeout,
          };
        });

      const result = await operation.execute({ message: 'hello' });
      expect(result).toEqual({
        formatted: '[HELLO]',
        apiKey: 'secret***',
        timeout: 5000,
      });
    });
  });
});
