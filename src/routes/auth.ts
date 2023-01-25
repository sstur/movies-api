import { HttpError, Response } from '@nbit/express';
import { Record, String } from 'runtypes';

import { db } from '../db';
import { defineRoutes } from '../server';

const Body = Record({
  username: String,
  password: String,
});

export default defineRoutes((app) => [
  app.post('/login', async (request) => {
    const body = await request.json();
    if (!Body.guard(body)) {
      throw new HttpError({ status: 400 });
    }
    const { username, password } = body;
    const users = await db.User.findWhere((user) => user.username === username);
    const user = users[0];
    if (!user || user.password !== password) {
      return Response.json({ success: false }, { status: 401 });
    }
    const now = new Date().toISOString();
    const session = await db.Session.insert({ user: user.id, createdAt: now });
    return { success: true, token: session.id };
  }),
]);
