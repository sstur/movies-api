import { HttpError, Response } from '@nbit/express';
import { Record, String } from 'runtypes';

import { db } from '../db';
import { defineRoutes } from '../server';

const Body = Record({
  name: String,
  username: String,
  password: String,
});

export default defineRoutes((app) => [
  app.post('/signup', async (request) => {
    const body = await request.json();
    if (!Body.guard(body)) {
      throw new HttpError({ status: 400 });
    }
    const { name, username, password } = body;
    const users = await db.User.findWhere((user) => user.username === username);
    if (users.length) {
      return Response.json(
        { success: false, error: 'Username not available' },
        { status: 400 },
      );
    }
    const user = await db.User.insert({
      name,
      username,
      password,
      favorites: [],
    });
    const now = new Date().toISOString();
    const session = await db.Session.insert({ user: user.id, createdAt: now });
    return {
      success: true,
      user: {
        id: user.id,
        name,
        username,
      },
      token: session.id,
    };
  }),
]);
