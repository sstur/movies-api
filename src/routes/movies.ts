import fetch from 'node-fetch';

import { db } from '../db';
import { defineRoutes } from '../server';
import { TMDB_API_KEY } from '../support/constants';
import { memoize } from '../support/memoize';
import type { Movie } from '../types/types';

type ApiMovieListItem = {
  id: number;
  adult: boolean;
  title: string;
  overview: string;
  release_date: string;
  original_language: string;
  genre_ids: Array<number>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
};

const maxPages = 6;

const loadMoviesFromApi = memoize(async () => {
  const promises = Array.from({ length: maxPages }).map(async (_, i) => {
    const page = i + 1;
    const url = new URL('https://api.themoviedb.org/3/movie/popular');
    url.searchParams.set('page', String(page));
    url.searchParams.set('api_key', TMDB_API_KEY);
    const response = await fetch(url.toString());
    return await response.json();
  });
  const pages = await Promise.all(promises);
  const results: Array<Movie> = [];
  for (const page of pages) {
    for (const result of page.results as Array<ApiMovieListItem>) {
      if (result.original_language === 'en' && !result.adult) {
        const movie = toMovie(result);
        results.push(movie);
      }
    }
  }
  const existing = new Set(await db.Movie.getList());
  for (const movie of results) {
    if (!existing.has(movie.id)) {
      await db.Movie.insert(movie);
    }
  }
});

function toMovie(input: ApiMovieListItem): Movie {
  return {
    id: input.id,
    title: input.title,
    overview: input.overview,
    release_date: input.release_date,
    genre_ids: input.genre_ids,
    popularity: input.popularity,
    vote_average: input.vote_average,
    poster_path: input.poster_path,
    backdrop_path: input.backdrop_path,
    favorited_by: [],
    comments: [],
  };
}

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
    await loadMoviesFromApi();
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
