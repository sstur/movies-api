import { defineRoutes } from '../server';

export default defineRoutes((app) => [
  app.get('/movies', async (_request) => {
    return { success: true };
  }),
]);
