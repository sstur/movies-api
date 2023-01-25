import { HttpError } from '@nbit/express';

import { db } from '../db';
import { defineRoutes } from '../server';

// type ApiMovie = {
//   id: number;
//   title: string;
//   // tagline: string;
//   overview: string;
//   release_date: string;
//   // runtime: number;
//   genres: Array<{ id: number; name: string }>;
//   popularity: number;
//   vote_average: number;
//   poster_path: string;
//   backdrop_path: string;
//   // status: string;
//   // homepage: string;
// };

// function toMovie(input: ApiMovie): Movie {
//   const {
//     id,
//     title,
//     overview,
//     release_date,
//     genres,
//     popularity,
//     vote_average,
//     poster_path,
//     backdrop_path,
//   } = input;
//   return {
//     id: 'm' + String(id),
//     title: title,
//     overview: overview,
//     release_date: release_date,
//     genres: genres.map(({ id }) => 'g' + String(id)),
//     popularity: popularity,
//     vote_average: vote_average,
//     poster_path: poster_path,
//     backdrop_path: backdrop_path,
//     favoritedBy: [],
//     comments: [],
//   };
// }

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
    const isLiked = user.favorites.includes(movie.id);
    if (isLiked) {
      user.favorites = user.favorites.filter((id) => id !== movie.id);
      movie.favoritedBy = movie.favoritedBy.filter((id) => id !== user.id);
    } else {
      user.favorites.push(movie.id);
      movie.favoritedBy.push(user.id);
    }
    await db.User.update(user.id, { favorites: user.favorites });
    await db.Movie.update(movie.id, { favoritedBy: movie.favoritedBy });
    return { isLiked: !isLiked };
  }),
]);
