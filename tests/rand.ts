import { Opa, op } from '../src/index.js';
import * as v from 'valibot';
import { type } from 'arktype';
import { z } from 'zod';

// Context-based operations
const opaWithContext = Opa.context({ db: { user: 'jason' } }).create().operation;

const testOp = opaWithContext.input(v.object({ name: v.string() })).handler(async ({ input, ctx }) => {
  return `Hello ${input.name} from ${ctx.db.user}`;
});

opaWithContext.input(type({ name: 'string' })).handler(async ({ input, ctx }) => {
  return `Hello ${input.name} from ${ctx.db.user}`;
});

opaWithContext.input(z.object({ name: z.string() })).handler(async ({ input, ctx }) => {
  return `Hello ${input.name} from ${ctx.db.user}`;
});

// Context-free operations using Opa.create()
const opaContextFree = Opa.create().operation;

opaContextFree.input(v.object({ name: v.string() })).handler(async ({ input }) => {
  return `Hello ${input.name}`;
});

// Standalone operation (no context)
op.input(v.object({ name: v.string() })).handler(async ({ input }) => {
  return `Hello ${input.name}`;
});

op.input(z.object({ name: z.string() })).handler(async ({ input }) => {
  return `Hello ${input.name}`;
});
