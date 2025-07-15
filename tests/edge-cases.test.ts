import { describe, it, expect } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Edge Cases and Error Scenarios', () => {
  describe('Null and undefined handling', () => {
    it('should handle null inputs appropriately', async () => {
      const schema = v.nullable(v.object({ value: v.string() }));
      const operation = op.input(schema).handler(async ({ input }) => {
        return input ? `Value: ${input.value}` : 'No value provided';
      });

      const result1 = await operation.execute({ value: 'test' });
      expect(result1).toBe('Value: test');

      const result2 = await operation.execute(null);
      expect(result2).toBe('No value provided');
    });

    it('should handle undefined inputs with optional schemas', async () => {
      const schema = v.optional(v.object({ value: v.string() }));
      const operation = op.input(schema).handler(async ({ input }) => {
        return input ? `Value: ${input.value}` : 'No value provided';
      });

      const result1 = await operation.execute({ value: 'test' });
      expect(result1).toBe('Value: test');

      const result2 = await operation.execute(undefined);
      expect(result2).toBe('No value provided');
    });

    it('should reject undefined for required schemas', async () => {
      const schema = v.object({ value: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.value);

      await expect(operation.execute(undefined as any)).rejects.toThrow();
    });
  });

  describe('Empty data structures', () => {
    it('should handle empty objects', async () => {
      const schema = v.object({});
      const operation = op.input(schema).handler(async ({ input }) => {
        return { isEmpty: Object.keys(input).length === 0 };
      });

      const result = await operation.execute({});
      expect(result).toEqual({ isEmpty: true });
    });

    it('should handle empty arrays', async () => {
      const schema = v.array(v.string());
      const operation = op.input(schema).handler(async ({ input }) => {
        return { count: input.length, isEmpty: input.length === 0 };
      });

      const result = await operation.execute([]);
      expect(result).toEqual({ count: 0, isEmpty: true });
    });

    it('should handle empty strings', async () => {
      const schema = v.string();
      const operation = op.input(schema).handler(async ({ input }) => {
        return { value: input, isEmpty: input === '' };
      });

      const result = await operation.execute('');
      expect(result).toEqual({ value: '', isEmpty: true });
    });
  });

  describe('Large data handling', () => {
    it('should handle large objects', async () => {
      const largeObject: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = i;
      }

      const schema = v.record(v.string(), v.number());
      const operation = op.input(schema).handler(async ({ input }) => {
        const keys = Object.keys(input);
        const sum = Object.values(input).reduce((a, b) => a + b, 0);
        return { keyCount: keys.length, sum };
      });

      const result = await operation.execute(largeObject);
      expect(result.keyCount).toBe(1000);
      expect(result.sum).toBe(499500); // Sum of 0 to 999
    });

    it('should handle large arrays', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const schema = v.array(v.number());
      const operation = op.input(schema).handler(async ({ input }) => {
        return {
          length: input.length,
          sum: input.reduce((a, b) => a + b, 0),
          first: input[0],
          last: input[input.length - 1],
        };
      });

      const result = await operation.execute(largeArray);
      expect(result.length).toBe(10000);
      expect(result.sum).toBe(49995000); // Sum of 0 to 9999
      expect(result.first).toBe(0);
      expect(result.last).toBe(9999);
    });

    it('should handle deeply nested objects', async () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return { value: 'leaf' };
        return { nested: createNestedObject(depth - 1), level: depth };
      };

      const deepObject = createNestedObject(50);

      const schema = v.any(); // Use any for deeply nested structure
      const operation = op.input(schema).handler(async ({ input }) => {
        const getDepth = (obj: any): number => {
          if (!obj || typeof obj !== 'object' || !obj.nested) return 0;
          return 1 + getDepth(obj.nested);
        };

        return { depth: getDepth(input) };
      });

      const result = await operation.execute(deepObject);
      expect(result.depth).toBe(50);
    });
  });

  describe('Special characters and encoding', () => {
    it('should handle unicode characters', async () => {
      const unicodeString = '🚀 Hello 世界 🌍 Émojis and ñoñó';

      const schema = v.object({ text: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => {
        return {
          original: input.text,
          length: input.text.length,
          hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
            input.text,
          ),
          hasChinese: /[\u4e00-\u9fff]/.test(input.text),
        };
      });

      const result = await operation.execute({ text: unicodeString });
      expect(result.original).toBe(unicodeString);
      expect(result.hasEmoji).toBe(true);
      expect(result.hasChinese).toBe(true);
    });

    it('should handle special JSON characters', async () => {
      const specialString = '\"\\\n\r\t\b\f';

      const schema = v.object({ text: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => {
        return {
          original: input.text,
          escaped: JSON.stringify(input.text),
          length: input.text.length,
        };
      });

      const result = await operation.execute({ text: specialString });
      expect(result.original).toBe(specialString);
      expect(result.length).toBe(7);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple concurrent executions', async () => {
      const schema = v.object({ id: v.number(), delay: v.number() });
      const operation = op.input(schema).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return { id: input.id, processedAt: Date.now() };
      });

      const promises = Array.from({ length: 10 }, (_, i) => operation.execute({ id: i, delay: Math.random() * 50 }));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Check that all operations completed
      results.forEach((result, index) => {
        expect(result.id).toBe(index);
        expect(typeof result.processedAt).toBe('number');
      });
    });

    it('should handle concurrent operations with shared context', async () => {
      const context = { counter: 0, results: [] as number[] };

      const schema = v.object({ value: v.number() });
      const operation = Opa.context(context)
        .create()
        .operation.input(schema)
        .handler(async ({ input, ctx }) => {
          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          ctx.counter++;
          ctx.results.push(input.value);
          return { value: input.value, counter: ctx.counter };
        });

      const promises = Array.from({ length: 5 }, (_, i) => operation.execute({ value: i }));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(context.counter).toBe(5);
      expect(context.results).toHaveLength(5);
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should handle operations with large return values', async () => {
      const schema = v.object({ size: v.number() });
      const operation = op.input(schema).handler(async ({ input }) => {
        const largeArray = Array.from({ length: input.size }, (_, i) => ({
          id: i,
          data: `item-${i}`,
          timestamp: Date.now(),
        }));

        return {
          items: largeArray,
          count: largeArray.length,
          totalSize: JSON.stringify(largeArray).length,
        };
      });

      const result = await operation.execute({ size: 1000 });
      expect(result.count).toBe(1000);
      expect(result.items).toHaveLength(1000);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should handle rapid successive calls', async () => {
      const schema = v.object({ iteration: v.number() });
      const operation = op.input(schema).handler(async ({ input }) => {
        return { iteration: input.iteration, timestamp: Date.now() };
      });

      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(await operation.execute({ iteration: i }));
      }

      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result.iteration).toBe(index);
      });
    });
  });

  describe('Schema validation edge cases', () => {
    it('should handle schema with complex unions', async () => {
      const schema = v.union([
        v.object({ type: v.literal('string'), value: v.string() }),
        v.object({ type: v.literal('number'), value: v.number() }),
        v.object({ type: v.literal('boolean'), value: v.boolean() }),
      ]);

      const operation = op.input(schema).handler(async ({ input }) => {
        switch (input.type) {
          case 'string':
            return { type: 'string', length: input.value.length };
          case 'number':
            return { type: 'number', doubled: input.value * 2 };
          case 'boolean':
            return { type: 'boolean', negated: !input.value };
        }
      });

      const result1 = await operation.execute({ type: 'string', value: 'hello' });
      expect(result1).toEqual({ type: 'string', length: 5 });

      const result2 = await operation.execute({ type: 'number', value: 42 });
      expect(result2).toEqual({ type: 'number', doubled: 84 });

      const result3 = await operation.execute({ type: 'boolean', value: true });
      expect(result3).toEqual({ type: 'boolean', negated: false });
    });

    it('should handle schema with transformations', async () => {
      const schema = v.pipe(
        v.string(),
        v.transform((input) => input.trim()),
        v.transform((input) => input.toLowerCase()),
        v.minLength(1),
      );

      const operation = op.input(schema).handler(async ({ input }) => {
        return { processed: input, length: input.length };
      });

      const result = await operation.execute('  HELLO WORLD  ');
      expect(result).toEqual({ processed: 'hello world', length: 11 });
    });

    it('should handle recursive schemas', async () => {
      interface TreeNode {
        value: string;
        children?: TreeNode[];
      }

      const treeSchema: any = v.object({
        value: v.string(),
        children: v.optional(v.array(v.lazy(() => treeSchema))),
      });

      const operation = op.input(treeSchema).handler(async ({ input }) => {
        const countNodes = (node: TreeNode): number => {
          let count = 1;
          if (node.children) {
            count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
          }
          return count;
        };

        return { nodeCount: countNodes(input) };
      });

      const treeData: TreeNode = {
        value: 'root',
        children: [
          { value: 'child1' },
          {
            value: 'child2',
            children: [{ value: 'grandchild1' }, { value: 'grandchild2' }],
          },
        ],
      };

      const result = await operation.execute(treeData);
      expect(result.nodeCount).toBe(5);
    });
  });

  describe('Error propagation and recovery', () => {
    it('should handle errors in nested async operations', async () => {
      const schema = v.object({ shouldFail: v.boolean(), value: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => {
        const asyncOperation = async () => {
          if (input.shouldFail) {
            throw new Error('Nested operation failed');
          }
          return input.value.toUpperCase();
        };

        try {
          const result = await asyncOperation();
          return { success: true, result };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });

      const result1 = await operation.execute({ shouldFail: false, value: 'hello' });
      expect(result1).toEqual({ success: true, result: 'HELLO' });

      const result2 = await operation.execute({ shouldFail: true, value: 'hello' });
      expect(result2).toEqual({ success: false, error: 'Nested operation failed' });
    });

    it('should handle timeout scenarios', async () => {
      const schema = v.object({ timeout: v.number() });
      const operation = op.input(schema).handler(async ({ input }) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timed out')), input.timeout),
        );

        const workPromise = new Promise((resolve) => setTimeout(() => resolve('Work completed'), input.timeout + 100));

        try {
          const result = await Promise.race([workPromise, timeoutPromise]);
          return { success: true, result };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });

      const result = await operation.execute({ timeout: 50 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation timed out');
    });
  });
});
