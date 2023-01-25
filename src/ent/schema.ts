import { String } from 'runtypes';

import { defineSchema, defineModel, ref } from './helpers';

const Account = defineModel({
  dbKey: 'accounts',
  fields: {
    name: String,
  },
  hasMany: {
    users: ref('user'),
  },
});

const User = defineModel({
  dbKey: 'users',
  fields: {
    username: String,
  },
  indexes: { username: true },
  belongsTo: { account: ref('account') },
});

export default defineSchema({
  account: Account,
  user: User,
});
