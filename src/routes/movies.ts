import { defineRoutes } from '../server';

export default defineRoutes((app) => [
  app.get('/', async (_request) => {
    return { success: true };
  }),
]);
