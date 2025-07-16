import { defineOperation, withContext } from '.';
import z from 'zod';

// 1. Regular operation definition with Zod schema
const createUserOp = defineOperation(
  z.object({ name: z.string(), age: z.number(), id: z.string() }),
  async ({ input, schema }) => {
    console.log(schema.shape);
    return input;
  },
);

createUserOp.schema;
createUserOp.execute({ name: 'hi there!', age: 18, id: '123' });
createUserOp.handler({ name: 'hi there!', age: 18, id: '123' });

// Case 1: Type-only context - requires context at execution
const repoOp = withContext<{ db: any }>(defineOperation);
// Case 2: Value-only context - no context required at execution (context is injected)
const repoOp2 = withContext(defineOperation, { random: 'Random context value' });
// Case 3: Merged context - provided context + required context at execution
const repoOp3 = withContext<{ db: any }>(defineOperation, { random: 'Random context value' });
// Context is merged in any case

const doSum = repoOp(z.object({ name: z.string() }), async ({ input, schema, ctx }) => {
  console.log(ctx);
  return input;
});

// Case 1: Requires ctx object since we provided generic in repoOp def
doSum.execute({ name: '' }, { db: '' });

const doSum2 = repoOp2(z.object({ name: z.string() }), async ({ input, schema, ctx }) => {
  console.log(ctx); // ctx will be { random: 'Random context value' }
  return input;
});

// Case 2: No ctx required - context is already injected
doSum2.handler({ name: '' });

const doSum3 = repoOp3(z.object({ name: z.string() }), async ({ input, schema, ctx }) => {
  console.log(ctx); // ctx will be { db: any, random: string }
  return input;
});

// Case 3: Requires ctx object for the required context type
doSum3.handler({ name: '' }, { db: '' });
