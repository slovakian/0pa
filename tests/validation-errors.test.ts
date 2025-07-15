import { describe, it, expect } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Validation and Error Handling', () => {
  describe('Input validation errors', () => {
    it('should throw validation error for invalid valibot input', async () => {
      const operation = op
        .input(v.object({ name: v.string(), age: v.number() }))
        .handler(async ({ input }) => `${input.name} is ${input.age}`);

      await expect(operation.execute({ name: 'John' } as any)).rejects.toThrow();
      await expect(operation.execute({ name: 123, age: 25 } as any)).rejects.toThrow();
      await expect(operation.execute({} as any)).rejects.toThrow();
    });

    it('should throw validation error for invalid zod input', async () => {
      const operation = op
        .input(z.object({ email: z.string().email(), count: z.number().positive() }))
        .handler(async ({ input }) => `${input.email}: ${input.count}`);

      await expect(operation.execute({ email: 'invalid-email', count: 5 } as any)).rejects.toThrow();
      await expect(operation.execute({ email: 'test@test.com', count: -1 } as any)).rejects.toThrow();
      await expect(operation.execute({ email: 'test@test.com' } as any)).rejects.toThrow();
    });

    it('should throw validation error for invalid arktype input', async () => {
      const operation = op
        .input(type({ id: 'number', status: "'active' | 'inactive'" }))
        .handler(async ({ input }) => `${input.id}: ${input.status}`);

      await expect(operation.execute({ id: 'not-a-number', status: 'active' } as any)).rejects.toThrow();
      await expect(operation.execute({ id: 1, status: 'invalid' } as any)).rejects.toThrow();
      await expect(operation.execute({ id: 1 } as any)).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const operation = op
        .input(
          v.object({
            name: v.pipe(v.string(), v.minLength(2)),
            age: v.pipe(v.number(), v.minValue(0), v.maxValue(120)),
          }),
        )
        .handler(async ({ input }) => input);

      try {
        await operation.execute({ name: 'A', age: 150 });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('validation');
        expect(error.message).toContain('min_length');
        expect(error.message).toContain('max_value');
      }
    });
  });

  describe('Context validation with errors', () => {
    it('should handle validation errors in context operations', async () => {
      const operation = Opa.context({ service: 'test' })
        .create()
        .operation.input(v.object({ required: v.string() }))
        .handler(async ({ input, ctx }) => `${ctx.service}: ${input.required}`);

      await expect(operation.execute({} as any)).rejects.toThrow();
      await expect(operation.execute({ required: 123 } as any)).rejects.toThrow();
    });
  });

  describe('Handler errors', () => {
    it('should propagate handler errors', async () => {
      const operation = op.input(v.object({ shouldFail: v.boolean() })).handler(async ({ input }) => {
        if (input.shouldFail) {
          throw new Error('Handler intentionally failed');
        }
        return 'success';
      });

      const successResult = await operation.execute({ shouldFail: false });
      expect(successResult).toBe('success');

      await expect(operation.execute({ shouldFail: true })).rejects.toThrow('Handler intentionally failed');
    });

    it('should handle async handler errors', async () => {
      const operation = op.input(v.object({ delay: v.number() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        if (input.delay > 100) {
          throw new Error('Timeout exceeded');
        }
        return 'completed';
      });

      const result = await operation.execute({ delay: 50 });
      expect(result).toBe('completed');

      await expect(operation.execute({ delay: 200 })).rejects.toThrow('Timeout exceeded');
    });
  });

  describe('Edge cases', () => {
    it('should handle null and undefined inputs', async () => {
      const operation = op
        .input(v.object({ value: v.optional(v.string()) }))
        .handler(async ({ input }) => input.value || 'default');

      const result1 = await operation.execute({ value: 'test' });
      const result2 = await operation.execute({});

      expect(result1).toBe('test');
      expect(result2).toBe('default');

      await expect(operation.execute(null as any)).rejects.toThrow();
      await expect(operation.execute(undefined as any)).rejects.toThrow();
    });

    it('should handle empty objects and arrays', async () => {
      const operation = op
        .input(
          v.object({
            items: v.array(v.string()),
            metadata: v.object({}),
          }),
        )
        .handler(async ({ input }) => ({
          count: input.items.length,
          hasMetadata: Object.keys(input.metadata).length > 0,
        }));

      const result = await operation.execute({
        items: [],
        metadata: {},
      });

      expect(result).toEqual({ count: 0, hasMetadata: false });
    });

    it('should handle very large inputs', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`);

      const operation = op
        .input(v.object({ items: v.array(v.string()) }))
        .handler(async ({ input }) => input.items.length);

      const result = await operation.execute({ items: largeArray });
      expect(result).toBe(10000);
    });
  });
});
