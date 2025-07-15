import { describe, it, expect } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Basic Operations', () => {
  describe('Standalone operations (op)', () => {
    it('should create operation with valibot schema', async () => {
      const operation = op.input(v.object({ name: v.string() })).handler(async ({ input }) => `Hello ${input.name}`);

      const result = await operation.execute({ name: 'John' });
      expect(result).toBe('Hello John');
    });

    it('should create operation with zod schema', async () => {
      const operation = op.input(z.object({ name: z.string() })).handler(async ({ input }) => `Hello ${input.name}`);

      const result = await operation.execute({ name: 'Jane' });
      expect(result).toBe('Hello Jane');
    });

    it('should create operation with arktype schema', async () => {
      const operation = op.input(type({ name: 'string' })).handler(async ({ input }) => `Hello ${input.name}`);

      const result = await operation.execute({ name: 'Bob' });
      expect(result).toBe('Hello Bob');
    });

    it('should work with synchronous handler', async () => {
      const operation = op.input(v.object({ value: v.number() })).handler(async ({ input }) => input.value * 2);

      const result = await operation.execute({ value: 5 });
      expect(result).toBe(10);
    });

    it('should expose original schema', () => {
      const schema = v.object({ name: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.name);

      expect(operation.schema).toBe(schema);
    });
  });

  describe('Opa.create() operations', () => {
    it('should create context-free operation', async () => {
      const operation = Opa.create()
        .operation.input(v.object({ message: v.string() }))
        .handler(async ({ input }) => `Message: ${input.message}`);

      const result = await operation.execute({ message: 'test' });
      expect(result).toBe('Message: test');
    });

    it('should work with complex data types', async () => {
      const operation = Opa.create()
        .operation.input(
          v.object({
            user: v.object({
              id: v.number(),
              name: v.string(),
              active: v.boolean(),
            }),
            tags: v.array(v.string()),
          }),
        )
        .handler(async ({ input }) => ({
          userId: input.user.id,
          greeting: `Hello ${input.user.name}`,
          isActive: input.user.active,
          tagCount: input.tags.length,
        }));

      const result = await operation.execute({
        user: { id: 1, name: 'Alice', active: true },
        tags: ['admin', 'user'],
      });

      expect(result).toEqual({
        userId: 1,
        greeting: 'Hello Alice',
        isActive: true,
        tagCount: 2,
      });
    });
  });

  describe('Direct handler calls', () => {
    it('should allow direct handler execution without validation', async () => {
      const operation = op.input(v.object({ name: v.string() })).handler(async ({ input }) => `Direct: ${input.name}`);

      const result = await operation.handler({ input: { name: 'Direct' } });
      expect(result).toBe('Direct: Direct');
    });
  });
});
