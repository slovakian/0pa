import { describe, it, expect } from 'vitest';
import { operation } from '../src/operation';
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';

describe('Schema Integration Tests', () => {
  describe('Zod Schema', () => {
    const userSchema = z.object({
      name: z.string(),
      age: z.number().min(0),
      email: z.string().email(),
    });

    const createUserOp = operation(
      userSchema,
      ({ input, schema }) => {
        // Test accessing values within handler
        expect(input.name).toBe('John Doe');
        expect(input.age).toBe(25);
        expect(input.email).toBe('john@example.com');
        expect(schema).toBe(userSchema);

        return {
          id: 1,
          ...input,
          createdAt: new Date('2024-01-01'),
        };
      },
    );

    it('should validate and execute with valid input', async () => {
      const input = {
        name: 'John Doe',
        age: 25,
        email: 'john@example.com',
      };

      const result = await createUserOp.execute(input);

      // Test accessing values on returned object
      expect(result.id).toBe(1);
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(25);
      expect(result.email).toBe('john@example.com');
      expect(result.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should throw error with invalid input', async () => {
      const invalidInput = {
        name: 'John Doe',
        age: -5, // Invalid age
        email: 'invalid-email', // Invalid email
      };

      await expect(createUserOp.execute(invalidInput)).rejects.toThrow('Validation failed');
    });

    it('should have correct schema property', () => {
      expect(createUserOp.schema).toBe(userSchema);
    });
  });

  describe('Valibot Schema', () => {
    const productSchema = v.object({
      title: v.pipe(v.string(), v.minLength(1)),
      price: v.pipe(v.number(), v.minValue(0)),
      category: v.picklist(['electronics', 'clothing', 'books']),
    });

    const createProductOp = operation(
      productSchema,
      ({ input, schema }) => {
        // Test accessing values within handler
        expect(input.title).toBe('Laptop');
        expect(input.price).toBe(999.99);
        expect(input.category).toBe('electronics');
        expect(schema).toBe(productSchema);

        return {
          id: 'prod-123',
          ...input,
          inStock: true,
        };
      },
    );

    it('should validate and execute with valid input', async () => {
      const input = {
        title: 'Laptop',
        price: 999.99,
        category: 'electronics' as const,
      };

      const result = await createProductOp.execute(input);

      // Test accessing values on returned object
      expect(result.id).toBe('prod-123');
      expect(result.title).toBe('Laptop');
      expect(result.price).toBe(999.99);
      expect(result.category).toBe('electronics');
      expect(result.inStock).toBe(true);
    });

    it('should throw error with invalid input', async () => {
      const invalidInput = {
        title: '', // Invalid title (empty)
        price: -10, // Invalid price (negative)
        category: 'invalid' as any, // Invalid category
      };

      await expect(createProductOp.execute(invalidInput)).rejects.toThrow('Validation failed');
    });

    it('should have correct schema property', () => {
      expect(createProductOp.schema).toBe(productSchema);
    });
  });

  describe('ArkType Schema', () => {
    const orderSchema = type({
      orderId: 'string',
      items: 'string[]',
      total: 'number>0',
      status: "'pending'|'completed'|'cancelled'",
    });

    const processOrderOp = operation(
      orderSchema,
      ({ input, schema }) => {
        // Test accessing values within handler
        expect(input.orderId).toBe('order-456');
        expect(input.items).toEqual(['item1', 'item2']);
        expect(input.total).toBe(150.5);
        expect(input.status).toBe('pending');
        expect(schema).toBe(orderSchema);

        return {
          ...input,
          processedAt: new Date('2024-01-01'),
          status: 'completed' as const,
        };
      },
    );

    it('should validate and execute with valid input', async () => {
      const input = {
        orderId: 'order-456',
        items: ['item1', 'item2'],
        total: 150.5,
        status: 'pending' as const,
      };

      const result = await processOrderOp.execute(input);

      // Test accessing values on returned object
      expect(result.orderId).toBe('order-456');
      expect(result.items).toEqual(['item1', 'item2']);
      expect(result.total).toBe(150.5);
      expect(result.status).toBe('completed');
      expect(result.processedAt).toEqual(new Date('2024-01-01'));
    });

    it('should throw error with invalid input', async () => {
      const invalidInput = {
        orderId: 'order-456',
        items: ['item1', 'item2'],
        total: -50, // Invalid total (negative)
        status: 'invalid' as any, // Invalid status
      };

      await expect(processOrderOp.execute(invalidInput)).rejects.toThrow('Validation failed');
    });

    it('should have correct schema property', () => {
      expect(processOrderOp.schema).toBe(orderSchema);
    });
  });

  describe('Complex Schema Operations', () => {
    it('should work with nested Zod schemas', async () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            bio: z.string(),
            age: z.number(),
          }),
        }),
        metadata: z.record(z.string()),
      });

      const complexOp = operation(
        nestedSchema,
        ({ input, schema }) => {
          expect(input.user.name).toBe('Alice');
          expect(input.user.profile.bio).toBe('Developer');
          expect(input.user.profile.age).toBe(30);
          expect(input.metadata.key1).toBe('value1');
          expect(schema).toBe(nestedSchema);

          return {
            processed: true,
            userData: input.user,
          };
        },
      );

      const input = {
        user: {
          name: 'Alice',
          profile: {
            bio: 'Developer',
            age: 30,
          },
        },
        metadata: {
          key1: 'value1',
          key2: 'value2',
        },
      };

      const result = await complexOp.execute(input);
      expect(result.processed).toBe(true);
      expect(result.userData.name).toBe('Alice');
      expect(result.userData.profile.age).toBe(30);
    });

    it('should work with optional fields in Valibot', async () => {
      const optionalSchema = v.object({
        required: v.string(),
        optional: v.optional(v.string()),
      });

      const optionalOp = operation(
        optionalSchema,
        ({ input, schema }) => {
          expect(input.required).toBe('test');
          expect(input.optional).toBeUndefined();
          expect(schema).toBe(optionalSchema);

          return {
            hasOptional: input.optional !== undefined,
            required: input.required,
          };
        },
      );

      const result = await optionalOp.execute({ required: 'test' });
      expect(result.hasOptional).toBe(false);
      expect(result.required).toBe('test');
    });
  });
});
