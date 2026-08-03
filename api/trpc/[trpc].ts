import { createNextApiHandler } from '@trpc/server/adapters/next';
import { appRouter } from '../../server/routers.js';

const handler = createNextApiHandler({
  router: appRouter,
  createContext: () => ({}),
});

export default handler;
