import { HttpError } from '@nbit/express';

import { db } from '../db';
import { defineRoutes } from '../server';

import { toMovieListItem } from './movies';

export default defineRoutes((app) => [
  app.get('/me', async (request) => {
    const user = await request.authenticate();
    if (!user) {
      throw new HttpError({ status: 401 });
    }
    const { id, name, username, favorites } = user;
    return { id, name, username, favorites };
  }),

  app.get('/me/favorites', async (request) => {
    const user = await request.authenticate();
    if (!user) {
      throw new HttpError({ status: 401 });
    }
    const favoritedMovies = [];
    for (const movieId of user.favorites) {
      const movie = await db.Movie.getById(movieId);
      if (movie) {
        favoritedMovies.push(toMovieListItem(movie, true));
      }
    }
    return favoritedMovies;
  }),
]);
