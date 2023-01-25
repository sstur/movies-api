import fetch from 'node-fetch';

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
  const results = data.genres as Array<ApiGenre>;
  return results.map(({ id, name }) => ({
    id: 'g' + String(id),
    name,
  }));
});

export default defineRoutes((app) => [
  app.get('/genres', async () => {
    return await getGenres();
  }),
]);
