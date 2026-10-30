import { createNextApiHandler } from '@trpc/server/adapters/next';
import { appRouter } from '../../server/routers';
import { createContext as createExpressContext } from '../../server/_core/context';

const handler = createNextApiHandler({
  router: appRouter,
  createContext: ({ req, res }: any) => createExpressContext({ req, res } as any),
});

export default handler;
