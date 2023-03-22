import fetch from 'node-fetch';

import { db } from '../db';
import { defineRoutes } from '../server';
import { TMDB_API_KEY } from '../support/constants';
import { memoize } from '../support/memoize';
import type { Genre } from '../types/types';

type ApiGenre = {
  id: number;
  name: string;
};

const getGenres = memoize(async (): Promise<Array<Genre>> => {
  const url = new URL('https://api.themoviedb.org/3/genre/movie/list');
  url.searchParams.set('api_key', TMDB_API_KEY);
  const response = await fetch(url.toString());
  const data = await response.json();
  const genres = data.genres as Array<ApiGenre>;
  const results: Array<Genre> = [];
  for (const { id, name } of genres) {
    const genre: Genre = { id, name };
    const existing = await db.Genre.getById(genre.id);
    if (!existing) {
      await db.Genre.insert(genre);
    }
    results.push(genre);
  }
  return results;
});

export default defineRoutes((app) => [
  app.get('/genres', async () => {
    return await getGenres();
  }),
]);
