import { HttpError } from '@nbit/express';

import { db } from '../db';
import { defineRoutes } from '../server';

export default defineRoutes((app) => [
  app.get('/movies/:id', async (request) => {
    const id = request.params.id;
    const movie = await db.Movie.getById(id);
    return movie ?? undefined;
  }),

  app.post('/movies/:id/favorite', async (request) => {
    const user = await request.authenticate();
    if (!user) {
      throw new HttpError({ status: 401 });
    }
    const id = request.params.id;
    const movie = await db.Movie.getById(id);
    if (!movie) {
      throw new HttpError({ status: 404 });
    }
    const isFavorited = user.favorites.includes(movie.id);
    if (isFavorited) {
      user.favorites = user.favorites.filter((id) => id !== movie.id);
      movie.favoritedBy = movie.favoritedBy.filter((id) => id !== user.id);
    } else {
      user.favorites.push(movie.id);
      movie.favoritedBy.push(user.id);
    }
    await db.User.update(user.id, { favorites: user.favorites });
    await db.Movie.update(movie.id, { favoritedBy: movie.favoritedBy });
    return { isFavorited: !isFavorited };
  }),
]);
