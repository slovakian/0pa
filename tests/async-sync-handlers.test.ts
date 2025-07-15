import { describe, it, expect, vi } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';

describe('Async and Sync Handler Patterns', () => {
  describe('Synchronous handlers', () => {
    it('should work with sync handler returning immediate value', async () => {
      const operation = op.input(v.object({ value: v.number() })).handler(async ({ input }) => input.value * 2);

      const result = await operation.execute({ value: 10 });
      expect(result).toBe(20);
    });

    it('should work with sync handler doing computations', async () => {
      const operation = op.input(v.object({ numbers: v.array(v.number()) })).handler(async ({ input }) => {
        return input.numbers.reduce((sum, num) => sum + num, 0);
      });

      const result = await operation.execute({ numbers: [1, 2, 3, 4, 5] });
      expect(result).toBe(15);
    });

    it('should handle sync errors properly', async () => {
      const operation = op.input(v.object({ shouldThrow: v.boolean() })).handler(async ({ input }) => {
        if (input.shouldThrow) {
          throw new Error('Sync error');
        }
        return 'success';
      });

      await expect(operation.execute({ shouldThrow: true })).rejects.toThrow('Sync error');

      const result = await operation.execute({ shouldThrow: false });
      expect(result).toBe('success');
    });
  });

  describe('Asynchronous handlers', () => {
    it('should work with async operations', async () => {
      const operation = op.input(v.object({ delay: v.number(), message: v.string() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return `Delayed: ${input.message}`;
      });

      const start = Date.now();
      const result = await operation.execute({ delay: 50, message: 'Hello' });
      const elapsed = Date.now() - start;

      expect(result).toBe('Delayed: Hello');
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should handle async database-like operations', async () => {
      const mockDb = {
        users: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        async findUser(id: number) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return this.users.find((user) => user.id === id);
        },
      };

      const operation = Opa.context({ db: mockDb })
        .create()
        .operation.input(v.object({ userId: v.number() }))
        .handler(async ({ input, ctx }) => {
          const user = await ctx.db.findUser(input.userId);
          if (!user) {
            throw new Error('User not found');
          }
          return { name: user.name, email: user.email };
        });

      const result = await operation.execute({ userId: 1 });
      expect(result).toEqual({ name: 'Alice', email: 'alice@example.com' });

      await expect(operation.execute({ userId: 999 })).rejects.toThrow('User not found');
    });

    it('should handle async API calls', async () => {
      const mockApiClient = {
        async fetchData(endpoint: string) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (endpoint === '/error') {
            throw new Error('API Error');
          }
          return { endpoint, data: `Data from ${endpoint}`, timestamp: Date.now() };
        },
      };

      const operation = Opa.context({ api: mockApiClient })
        .create()
        .operation.input(v.object({ endpoint: v.string() }))
        .handler(async ({ input, ctx }) => {
          const response = await ctx.api.fetchData(input.endpoint);
          return {
            source: response.endpoint,
            result: response.data,
            fetchedAt: new Date(response.timestamp).toISOString(),
          };
        });

      const result = await operation.execute({ endpoint: '/users' });
      expect(result.source).toBe('/users');
      expect(result.result).toBe('Data from /users');
      expect(result.fetchedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);

      await expect(operation.execute({ endpoint: '/error' })).rejects.toThrow('API Error');
    });
  });

  describe('Promise handling and concurrency', () => {
    it('should handle multiple concurrent operations', async () => {
      const operation = op.input(v.object({ id: v.number(), delay: v.number() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return `Result-${input.id}`;
      });

      const promises = [
        operation.execute({ id: 1, delay: 30 }),
        operation.execute({ id: 2, delay: 20 }),
        operation.execute({ id: 3, delay: 10 }),
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual(['Result-1', 'Result-2', 'Result-3']);
    });

    it('should handle Promise.race scenarios', async () => {
      const fastOperation = op.input(v.object({ value: v.string() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `Fast: ${input.value}`;
      });

      const slowOperation = op.input(v.object({ value: v.string() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `Slow: ${input.value}`;
      });

      const result = await Promise.race([
        fastOperation.execute({ value: 'test' }),
        slowOperation.execute({ value: 'test' }),
      ]);

      expect(result).toBe('Fast: test');
    });

    it('should handle async errors in concurrent operations', async () => {
      const operation = op.input(v.object({ shouldFail: v.boolean(), id: v.number() })).handler(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (input.shouldFail) {
          throw new Error(`Error in operation ${input.id}`);
        }
        return `Success ${input.id}`;
      });

      const promises = [
        operation.execute({ shouldFail: false, id: 1 }),
        operation.execute({ shouldFail: true, id: 2 }),
        operation.execute({ shouldFail: false, id: 3 }),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('Success 1');

      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason.message).toBe('Error in operation 2');

      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe('Success 3');
    });
  });

  describe('Performance and timing', () => {
    it('should execute operations efficiently', async () => {
      const operation = op.input(v.object({ iterations: v.number() })).handler(async ({ input }) => {
        let sum = 0;
        for (let i = 0; i < input.iterations; i++) {
          sum += i;
        }
        return sum;
      });

      const start = Date.now();
      const result = await operation.execute({ iterations: 10000 });
      const elapsed = Date.now() - start;

      expect(result).toBe(49995000); // Sum of 0 to 9999
      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it('should handle timeout scenarios', async () => {
      const operation = op.input(v.object({ timeout: v.number() })).handler(async ({ input }) => {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), input.timeout);
        });

        const workPromise = new Promise((resolve) => {
          setTimeout(() => resolve('Work completed'), input.timeout + 50);
        });

        return Promise.race([workPromise, timeoutPromise]);
      });

      await expect(operation.execute({ timeout: 50 })).rejects.toThrow('Operation timeout');
    });
  });

  describe('Memory and resource management', () => {
    it('should handle large data processing', async () => {
      const operation = op.input(v.object({ size: v.number() })).handler(async ({ input }) => {
        const largeArray = new Array(input.size).fill(0).map((_, i) => i);
        const processed = largeArray.map((x) => x * 2);
        return {
          originalSize: largeArray.length,
          processedSize: processed.length,
          sum: processed.reduce((a, b) => a + b, 0),
        };
      });

      const result = await operation.execute({ size: 100000 });
      expect(result.originalSize).toBe(100000);
      expect(result.processedSize).toBe(100000);
      expect(result.sum).toBe(9999900000); // Sum of 0*2 + 1*2 + ... + 99999*2
    });
  });
});
