import { defineRoutes } from '../server';

export default defineRoutes((app) => [
  app.post('/login', async (_request) => {
    return { success: true };
  }),
]);
