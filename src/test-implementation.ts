import { Opa, op } from './index.js';
import * as v from 'valibot';
import { z } from 'zod';
import { type } from 'arktype';

// Test context-based operations
const opaWithContext = Opa.context({ db: { user: 'jason' } }).create().operation;

// Test with Valibot
const valibotOp = opaWithContext
  .input(v.object({ name: v.string() }))
  .handler(async ({ input, ctx }) => {
    return `Hello ${input.name} from ${ctx.db.user}`;
  });

// Test with ArkType
const arktypeOp = opaWithContext
  .input(type({ name: 'string' }))
  .handler(async ({ input, ctx }) => {
    return `Hello ${input.name} from ${ctx.db.user}`;
  });

// Test with Zod
const zodOp = opaWithContext
  .input(z.object({ name: z.string() }))
  .handler(async ({ input, ctx }) => {
    return `Hello ${input.name} from ${ctx.db.user}`;
  });

// Test context-free operations
const opaContextFree = Opa.create().operation;

const simpleOp = opaContextFree
  .input(v.object({ name: v.string() }))
  .handler(async ({ input }) => {
    return `Hello ${input.name}`;
  });

// Test standalone operations
const standaloneOp = op
  .input(v.object({ name: v.string() }))
  .handler(async ({ input }) => {
    return `Hello ${input.name}`;
  });

// Test usage
async function testOperations() {
  // Test execution
  const result1 = await valibotOp.execute({ name: 'John' });
  console.log('Valibot result:', result1);
  
  const result2 = await arktypeOp.execute({ name: 'Jane' });
  console.log('ArkType result:', result2);
  
  const result3 = await zodOp.execute({ name: 'Bob' });
  console.log('Zod result:', result3);
  
  const result4 = await simpleOp.execute({ name: 'Alice' });
  console.log('Simple result:', result4);
  
  const result5 = await standaloneOp.execute({ name: 'Charlie' });
  console.log('Standalone result:', result5);
  
  // Test direct handler calls
  const handlerResult = await valibotOp.handler({ 
    input: { name: 'Direct' }, 
    ctx: { db: { user: 'jason' } } 
  });
  console.log('Handler result:', handlerResult);
  
  // Test schema access (should return unwrapped original schema)
  console.log('Valibot schema:', valibotOp.schema);
  console.log('ArkType schema:', arktypeOp.schema);
  console.log('Zod schema:', zodOp.schema);
}

// Export for testing
export { testOperations, valibotOp, arktypeOp, zodOp, simpleOp, standaloneOp };