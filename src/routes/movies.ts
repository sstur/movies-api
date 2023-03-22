import { db } from '../db';
import { defineRoutes } from '../server';
import type { Movie } from '../types/types';

export function toMovieListItem(movie: Movie, favoritedByViewer: boolean) {
  return {
    id: movie.id,
    title: movie.title,
    release_date: movie.release_date,
    popularity: movie.popularity,
    vote_average: movie.vote_average,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    favorited_count: movie.favorited_by.length,
    favorited_by_viewer: favoritedByViewer,
    comment_count: movie.comments.length,
  };
}

export default defineRoutes((app) => [
  app.get('/movies', async (request) => {
    const user = await request.authenticate();
    const movies = await db.Movie.getAll();
    return movies.map((movie) => {
      return toMovieListItem(
        movie,
        user ? user.favorites.includes(movie.id) : false,
      );
    });
  }),
]);
