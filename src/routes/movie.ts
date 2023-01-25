import fetch from 'node-fetch';

import { db } from '../db';
import { defineRoutes } from '../server';
import { TMDB_API_KEY } from '../support/constants';
import type { Movie } from '../types/types';

type ApiMovie = {
  id: number;
  title: string;
  // tagline: string;
  overview: string;
  release_date: string;
  // runtime: number;
  genres: Array<{ id: number; name: string }>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  // status: string;
  // homepage: string;
};

const getMovie = memoize(async (id: string): Promise<Movie> => {
  const url = new URL(`https://api.themoviedb.org/3/movie/${id}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  const response = await fetch(url.toString());
  const data = await response.json();
  return toMovie(data as ApiMovie);
});

function toMovie(input: ApiMovie): Movie {
  const {
    id,
    title,
    overview,
    release_date,
    genres,
    popularity,
    vote_average,
    poster_path,
    backdrop_path,
  } = input;
  return {
    id: 'm' + String(id),
    title: title,
    overview: overview,
    release_date: release_date,
    genres: genres.map(({ id }) => 'g' + String(id)),
    popularity: popularity,
    vote_average: vote_average,
    poster_path: poster_path,
    backdrop_path: backdrop_path,
    favoritedBy: [],
    comments: [],
  };
}

export default defineRoutes((app) => [
  app.get('/movies/:id', async (request) => {
    const id = request.params.id;
    const numericId = id.replace(/\D/g, '');
    const movie = await getMovie(numericId);
    const favoritedBy = await db.User.findWhere((user) =>
      user.favorites.includes(movie.id),
    );
    movie.favoritedBy = favoritedBy.map(({ id }) => id);
    const comments = await db.Comment.findWhere(
      (comment) => comment.movie === movie.id,
    );
    movie.comments = comments.map(({ id }) => id);
    return movie;
  }),
]);

function memoize<T>(fn: (id: string) => T): (id: string) => T {
  const map = new Map<string, T>();
  return (id: string) => {
    const cached = map.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const value = fn(id);
    map.set(id, value);
    return value;
  };
}
