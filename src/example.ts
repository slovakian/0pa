import z from 'zod';

export const createUserOp = defineOperation<{ db: AppContext["DB"]}>( // We need to provide a type generic if context is not provided by factory
  'createUser',
  async ({ input, ctx, schema }) => {
    console.log(input);
    return await ctx.db.user.create({ data: { name: input.name, email: input.email } })
  },
  z.object({ name: z.string(), email: z.string().email() }),
);

// Usage

createUserOp.schema.shape;
// Unvalidated handler call
createUserOp.handler(input, ctx); // We provide ctx to individual ops when it is not prebound or provided by factory
// Validated handler call
createUserOp.execute(input, ctx);
// OR we prebind the context like...
const [createUser] = getOperation({ ctx, selector: (ops) => [ops.createUser] }); // type of ctx that we need to pass in should match the type provided during op definition
// OR
const { createUser } = getOperation({ ctx, selector: (ops) => ({ops.createUser})});
// OR
const createUser = getOperation({ ctx, selector: (ops) => ops.createUser});
// OR We use a factory function to provide context at operation definition
const defineOperationWithContext = operationWithContextFactory({ ctx })
const createUser = defineOperationWithContext('createUser', // Notice no need to provide ctx type since it is provided by factory
  ({ input, ctx, schema }) => {
    console.log(input);
    return { id: 1, name: input.name, email: input.email };
  },
  z.object({ name: z.string(), email: z.string().email() }),)
// And THEN in either case here (prebinding or using factory), we can simply call the function without passing in ctx, since it's already provided
const user = await createUser({ name: 'Jason', email: 'jason@example.com' });
