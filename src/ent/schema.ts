import { String } from 'runtypes';

import { defineSchema, defineModel, ref } from './helpers';

const User = defineModel({
  dbKey: 'users',
  fields: {
    name: String,
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

export default defineSchema({
  user: User,
  session: Session,
});
