import { createNextApiHandler } from '@trpc/server/adapters/next';
import { appRouter } from '../../server/routers';

const handler = createNextApiHandler({
  router: appRouter,
  createContext: () => ({}),
});

export default handler;
