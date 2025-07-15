import { describe, it, expect } from 'vitest';
import { Opa } from '../src/index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

describe('Context Operations', () => {
  describe('Opa.context() operations', () => {
    it('should create operation with simple context', async () => {
      const context = { userId: 123 };
      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ message: v.string() }))
        .handler(async ({ input, ctx }) => `User ${ctx.userId}: ${input.message}`);

      const result = await operation.execute({ message: 'Hello' });
      expect(result).toBe('User 123: Hello');
    });

    it('should work with complex nested context', async () => {
      const context = {
        db: { user: 'admin', host: 'localhost' },
        config: { timeout: 5000, retries: 3 },
        permissions: ['read', 'write'],
      };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ action: v.string() }))
        .handler(async ({ input, ctx }) => ({
          action: input.action,
          user: ctx.db.user,
          host: ctx.db.host,
          timeout: ctx.config.timeout,
          canWrite: ctx.permissions.includes('write'),
        }));

      const result = await operation.execute({ action: 'save' });
      expect(result).toEqual({
        action: 'save',
        user: 'admin',
        host: 'localhost',
        timeout: 5000,
        canWrite: true,
      });
    });

    it('should work with different schema libraries and context', async () => {
      const context = { service: 'test-service' };

      const valibotOp = Opa.context(context)
        .create()
        .operation.input(v.object({ name: v.string() }))
        .handler(async ({ input, ctx }) => `${ctx.service}: ${input.name}`);

      const zodOp = Opa.context(context)
        .create()
        .operation.input(z.object({ name: z.string() }))
        .handler(async ({ input, ctx }) => `${ctx.service}: ${input.name}`);

      const arktypeOp = Opa.context(context)
        .create()
        .operation.input(type({ name: 'string' }))
        .handler(async ({ input, ctx }) => `${ctx.service}: ${input.name}`);

      const valibotResult = await valibotOp.execute({ name: 'valibot' });
      const zodResult = await zodOp.execute({ name: 'zod' });
      const arktypeResult = await arktypeOp.execute({ name: 'arktype' });

      expect(valibotResult).toBe('test-service: valibot');
      expect(zodResult).toBe('test-service: zod');
      expect(arktypeResult).toBe('test-service: arktype');
    });

    it('should allow direct handler calls with context', async () => {
      const context = { multiplier: 10 };
      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ value: v.number() }))
        .handler(async ({ input, ctx }) => input.value * ctx.multiplier);

      const result = await operation.handler({
        input: { value: 5 },
        ctx: { multiplier: 20 },
      });
      expect(result).toBe(100);
    });

    it('should preserve context type through chain', async () => {
      interface AppContext {
        user: { id: number; role: string };
        session: { token: string; expires: Date };
      }

      const context: AppContext = {
        user: { id: 1, role: 'admin' },
        session: { token: 'abc123', expires: new Date() },
      };

      const operation = Opa.context(context)
        .create()
        .operation.input(v.object({ resource: v.string() }))
        .handler(async ({ input, ctx }) => ({
          resource: input.resource,
          userId: ctx.user.id,
          userRole: ctx.user.role,
          sessionToken: ctx.session.token,
          hasAdminAccess: ctx.user.role === 'admin',
        }));

      const result = await operation.execute({ resource: 'users' });
      expect(result.userId).toBe(1);
      expect(result.userRole).toBe('admin');
      expect(result.sessionToken).toBe('abc123');
      expect(result.hasAdminAccess).toBe(true);
    });

    it('should expose original schema in context operations', () => {
      const schema = v.object({ test: v.string() });
      const context = { env: 'test' };

      const operation = Opa.context(context)
        .create()
        .operation.input(schema)
        .handler(async ({ input, ctx }) => `${ctx.env}: ${input.test}`);

      expect(operation.schema).toBe(schema);
    });
  });

  describe('Context vs Context-free comparison', () => {
    it('should handle same logic with and without context', async () => {
      const schema = v.object({ name: v.string() });

      const withContext = Opa.context({ prefix: 'Hello' })
        .create()
        .operation.input(schema)
        .handler(async ({ input, ctx }) => `${ctx.prefix} ${input.name}`);

      const withoutContext = Opa.create()
        .operation.input(schema)
        .handler(async ({ input }) => `Hello ${input.name}`);

      const contextResult = await withContext.execute({ name: 'World' });
      const noContextResult = await withoutContext.execute({ name: 'World' });

      expect(contextResult).toBe('Hello World');
      expect(noContextResult).toBe('Hello World');
    });
  });
});
