import { HttpError } from '@nbit/express';

import { db } from '../db';
import { defineRoutes } from '../server';
import type { Movie } from '../types/types';

function toImageUrl(path: string) {
  if (path.startsWith('/')) {
    return `https://image.tmdb.org/t/p/w500` + path;
  } else {
    return path;
  }
}

export function toMovieListItem(movie: Movie, favoritedByViewer: boolean) {
  return {
    id: movie.id,
    title: movie.title,
    release_date: movie.release_date,
    popularity: movie.popularity,
    vote_average: movie.vote_average,
    poster_path: toImageUrl(movie.poster_path),
    backdrop_path: toImageUrl(movie.backdrop_path),
    favorited_count: movie.favorited_by.length,
    favorited_by_viewer: favoritedByViewer,
    comment_count: movie.comments.length,
  };
}

export default defineRoutes((app) => [
  app.get('/movies', async (request) => {
    const user = await request.authenticate();
    const movies = await db.Movie.getAll();
    movies.sort((a, b) => b.popularity - a.popularity);
    return movies.map((movie) => {
      return toMovieListItem(
        movie,
        user ? user.favorites.includes(movie.id) : false,
      );
    });
  }),

  app.get('/movies/:id', async (request) => {
    const user = await request.authenticate();
    const id = parseInt(request.params.id, 10);
    const movie = await db.Movie.getById(id);
    if (movie) {
      return {
        ...movie,
        poster_path: toImageUrl(movie.poster_path),
        backdrop_path: toImageUrl(movie.backdrop_path),
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
    const id = parseInt(request.params.id, 10);
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
