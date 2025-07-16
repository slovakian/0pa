import { operation } from '.';
import z from 'zod';
import { type } from 'arktype';

// 1. Regular operation definition with Zod schema
const createUserOp = operation(
  'createUser',
  async ({ input, schema }) => {
    return input;
  },
  z.object({ name: z.string() }),
);

createUserOp.schema;
createUserOp.execute({ name: 'hi there!' });
createUserOp.handler({ name: 'hi there!' });

const globalRepo = registry({
  users: {
    createUser: createUserOp,
  },
});

const registryAccess = registry([createUserOp]);

registryAccess.select((reg) => reg.users.createUser);
