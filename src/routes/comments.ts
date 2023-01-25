import { HttpError } from '@nbit/express';
import { Record, String } from 'runtypes';

import { db } from '../db';
import { defineRoutes } from '../server';
import type { Comment } from '../types/types';

const NewCommentBody = Record({
  content: String,
});

export default defineRoutes((app) => [
  app.get('/movies/:id/comments', async (request) => {
    const id = request.params.id;
    const movie = await db.Movie.getById(id);
    if (!movie) {
      return;
    }
    const comments: Array<Comment> = [];
    for (const commentId of movie.comments) {
      const comment = await db.Comment.getById(commentId);
      if (comment) {
        comments.push(comment);
      }
    }
    return comments;
  }),

  app.post('/movies/:id/comment', async (request) => {
    const user = await request.authenticate();
    if (!user) {
      throw new HttpError({ status: 401 });
    }
    const id = request.params.id;
    const movie = await db.Movie.getById(id);
    if (!movie) {
      throw new HttpError({ status: 404 });
    }
    const body = await request.json();
    if (!NewCommentBody.guard(body)) {
      throw new HttpError({ status: 400 });
    }
    const { content } = body;
    const now = new Date().toISOString();
    const comment = await db.Comment.insert({
      content,
      movie: movie.id,
      author: user.id,
      createdAt: now,
    });
    movie.comments.push(comment.id);
    await db.Movie.update(movie.id, movie);
    return comment;
  }),
]);
