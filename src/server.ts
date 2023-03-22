import { createApplication } from '@nbit/express';

import { db } from './db';
import type { User } from './types/types';

const { defineRoutes, attachRoutes } = createApplication({
  getContext: (request) => ({
    authenticate: async (): Promise<User | null> => {
      const auth = request.headers.get('authorization') ?? '';
      const token = auth.replace(/^Bearer /i, '');
      if (token) {
        const sessionId = parseInt(token, 36);
        const session = await db.Session.getById(sessionId);
        if (session) {
          const user = await db.User.getById(session.user);
          if (user) {
            return user;
          }
        }
      }
      return null;
    },
  }),
});

export { defineRoutes, attachRoutes };
