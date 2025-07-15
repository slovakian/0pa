import { describe, it, expect } from 'vitest';
import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Schema Library Compatibility', () => {
  describe('Valibot schemas', () => {
    it('should work with primitive types', async () => {
      const stringOp = op.input(v.string()).handler(async ({ input }) => input.toUpperCase());
      const numberOp = op.input(v.number()).handler(async ({ input }) => input * 2);
      const booleanOp = op.input(v.boolean()).handler(async ({ input }) => !input);

      expect(await stringOp.execute('hello')).toBe('HELLO');
      expect(await numberOp.execute(5)).toBe(10);
      expect(await booleanOp.execute(true)).toBe(false);
    });

    it('should work with complex nested objects', async () => {
      const schema = v.object({
        user: v.object({
          profile: v.object({
            name: v.string(),
            settings: v.object({
              theme: v.picklist(['light', 'dark']),
              notifications: v.boolean(),
            }),
          }),
          contacts: v.array(
            v.object({
              email: v.pipe(v.string(), v.email()),
              type: v.picklist(['friend', 'colleague', 'family']),
            }),
          ),
        }),
      });

      const operation = op.input(schema).handler(async ({ input }) => ({
        userName: input.user.profile.name,
        theme: input.user.profile.settings.theme,
        contactCount: input.user.contacts.length,
        firstContactEmail: input.user.contacts[0]?.email,
      }));

      const result = await operation.execute({
        user: {
          profile: {
            name: 'John Doe',
            settings: { theme: 'dark', notifications: true },
          },
          contacts: [
            { email: 'friend@example.com', type: 'friend' },
            { email: 'work@example.com', type: 'colleague' },
          ],
        },
      });

      expect(result).toEqual({
        userName: 'John Doe',
        theme: 'dark',
        contactCount: 2,
        firstContactEmail: 'friend@example.com',
      });
    });

    it('should preserve valibot schema reference', () => {
      const schema = v.object({ test: v.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.test);
      expect(operation.schema).toBe(schema);
    });
  });

  describe('Zod schemas', () => {
    it('should work with zod refinements and transforms', async () => {
      const schema = z
        .object({
          email: z.string().email(),
          age: z.number().min(0).max(120),
          password: z
            .string()
            .min(8)
            .refine((val) => /[A-Z]/.test(val), {
              message: 'Password must contain uppercase letter',
            }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords must match',
          path: ['confirmPassword'],
        })
        .transform((data) => ({
          email: data.email.toLowerCase(),
          age: data.age,
          hasValidPassword: true,
        }));

      const operation = op.input(schema).handler(async ({ input }) => ({
        processedEmail: input.email,
        ageGroup: input.age < 18 ? 'minor' : 'adult',
        passwordValid: input.hasValidPassword,
      }));

      const result = await operation.execute({
        email: 'TEST@EXAMPLE.COM',
        age: 25,
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
      });

      expect(result).toEqual({
        processedEmail: 'test@example.com',
        ageGroup: 'adult',
        passwordValid: true,
      });
    });

    it('should work with zod unions and discriminated unions', async () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('user'), name: z.string(), email: z.string() }),
        z.object({ type: z.literal('admin'), name: z.string(), permissions: z.array(z.string()) }),
        z.object({ type: z.literal('guest'), sessionId: z.string() }),
      ]);

      const operation = op.input(schema).handler(async ({ input }) => {
        switch (input.type) {
          case 'user':
            return { role: 'user', identifier: input.email };
          case 'admin':
            return { role: 'admin', identifier: input.name, permissionCount: input.permissions.length };
          case 'guest':
            return { role: 'guest', identifier: input.sessionId };
        }
      });

      const userResult = await operation.execute({
        type: 'user',
        name: 'John',
        email: 'john@example.com',
      });

      const adminResult = await operation.execute({
        type: 'admin',
        name: 'Admin',
        permissions: ['read', 'write', 'delete'],
      });

      expect(userResult).toEqual({ role: 'user', identifier: 'john@example.com' });
      expect(adminResult).toEqual({ role: 'admin', identifier: 'Admin', permissionCount: 3 });
    });

    it('should preserve zod schema reference', () => {
      const schema = z.object({ test: z.string() });
      const operation = op.input(schema).handler(async ({ input }) => input.test);
      expect(operation.schema).toBe(schema);
    });
  });

  describe('ArkType schemas', () => {
    it('should work with arktype complex types', async () => {
      const schema = type({
        id: 'string',
        metadata: {
          version: 'number',
          tags: 'string[]',
          config: {
            enabled: 'boolean',
            priority: '1 | 2 | 3 | 4 | 5',
          },
        },
        'timestamp?': 'Date',
      });

      const operation = op.input(schema).handler(async ({ input }) => ({
        id: input.id,
        version: input.metadata.version,
        tagCount: input.metadata.tags.length,
        isEnabled: input.metadata.config.enabled,
        priority: input.metadata.config.priority,
        hasTimestamp: input.timestamp !== undefined,
      }));

      const result = await operation.execute({
        id: 'test-123',
        metadata: {
          version: 2,
          tags: ['production', 'api'],
          config: {
            enabled: true,
            priority: 3,
          },
        },
      });

      expect(result).toEqual({
        id: 'test-123',
        version: 2,
        tagCount: 2,
        isEnabled: true,
        priority: 3,
        hasTimestamp: false,
      });
    });

    it('should work with arktype unions and intersections', async () => {
      const baseSchema = type({ id: 'string', name: 'string' });
      const extendedSchema = type(baseSchema.and({ role: "'admin' | 'user'", active: 'boolean' }));

      const operation = op.input(extendedSchema).handler(async ({ input }) => ({
        summary: `${input.name} (${input.id}) is ${input.active ? 'active' : 'inactive'} ${input.role}`,
        isAdminActive: input.role === 'admin' && input.active,
      }));

      const result = await operation.execute({
        id: 'usr-123',
        name: 'Alice',
        role: 'admin',
        active: true,
      });

      expect(result).toEqual({
        summary: 'Alice (usr-123) is active admin',
        isAdminActive: true,
      });
    });

    it('should preserve arktype schema reference', () => {
      const schema = type({ test: 'string' });
      const operation = op.input(schema).handler(async ({ input }) => input.test);
      expect(operation.schema).toBe(schema);
    });
  });

  describe('Cross-library consistency', () => {
    it('should produce same results across different schema libraries', async () => {
      const testData = { name: 'Test', count: 42 };

      const valibotOp = op
        .input(v.object({ name: v.string(), count: v.number() }))
        .handler(async ({ input }) => `${input.name}: ${input.count}`);

      const zodOp = op
        .input(z.object({ name: z.string(), count: z.number() }))
        .handler(async ({ input }) => `${input.name}: ${input.count}`);

      const arktypeOp = op
        .input(type({ name: 'string', count: 'number' }))
        .handler(async ({ input }) => `${input.name}: ${input.count}`);

      const valibotResult = await valibotOp.execute(testData);
      const zodResult = await zodOp.execute(testData);
      const arktypeResult = await arktypeOp.execute(testData);

      expect(valibotResult).toBe('Test: 42');
      expect(zodResult).toBe('Test: 42');
      expect(arktypeResult).toBe('Test: 42');
      expect(valibotResult).toBe(zodResult);
      expect(zodResult).toBe(arktypeResult);
    });
  });
});
