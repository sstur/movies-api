import { HttpError } from '@nbit/express';

import { db } from '../db';
import { defineRoutes } from '../server';

export default defineRoutes((app) => [
  app.get('/movies/:id', async (request) => {
    const user = await request.authenticate();
    const id = request.params.id;
    const movie = await db.Movie.getById(id);
    if (movie) {
      return {
        ...movie,
        favorited_by_viewer: user ? user.favorites.includes(movie.id) : false,
      };
    }
    return undefined;
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
      movie.favorited_by = movie.favorited_by.filter((id) => id !== user.id);
    } else {
      user.favorites.push(movie.id);
      movie.favorited_by.push(user.id);
    }
    await db.User.update(user.id, { favorites: user.favorites });
    await db.Movie.update(movie.id, { favorited_by: movie.favorited_by });
    return { isFavorited: !isFavorited };
  }),
]);
