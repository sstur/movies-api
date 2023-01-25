import { String } from 'runtypes';

import { defineSchema, defineModel, ref } from './helpers';

const Movie = defineModel({
  dbKey: 'movies',
  fields: {
    id: String,
    title: String,
  },
  hasMany: {
    sessions: ref('session'),
  },
});

const Session = defineModel({
  dbKey: 'sessions',
  fields: {
    id: String,
  },
  belongsTo: { user: ref('user') },
});

const User = defineModel({
  dbKey: 'users',
  fields: {
    id: String,
    name: String,
  },
  hasMany: {
    sessions: ref('session'),
  },
});

export default defineSchema({
  movie: Movie,
  session: Session,
  user: User,
});
