import { fromSchema, Model } from './support/orm';
import type { Comment, Genre, Movie, Session, User } from './types/types';

export const db = fromSchema({
  Comment: Model<Comment>(),
  Genre: Model<Genre>(),
  Movie: Model<Movie>(),
  Session: Model<Session>(),
  User: Model<User>(),
});
