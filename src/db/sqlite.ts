import { resolve } from 'path';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import { memoize } from '../support/memoize';

type BatchOperation =
  | { type: 'del'; key: string }
  | { type: 'put'; key: string; value: string };

const path = 'data/db.sqlite';
const fullPath = resolve(__dirname, '../..', path);

async function openDb() {
  const db = await open({
    filename: fullPath,
    driver: sqlite3.Database,
  });
  await db.run(
    `CREATE TABLE IF NOT EXISTS kvstore (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;`,
  );
  return db;
}

function createDb() {
  const dbPromise = openDb();

  const self = {
    get: async (key: string) => {
      const db = await dbPromise;
      const result = await db.get('SELECT value FROM kvstore WHERE key=$key', {
        $key: key,
      });
      const value = result?.value;
      return typeof value === 'string' ? value : null;
    },
    has: async (key: string) => {
      const db = await dbPromise;
      const result = await db.get(
        'SELECT 1 FROM kvstore WHERE key=$key LIMIT 1',
        { $key: key },
      );
      return result != null;
    },
    put: async (key: string, value: string) => {
      const db = await dbPromise;
      await db.run(
        `INSERT INTO kvstore (key, value) VALUES ($key, $value) ON CONFLICT (key) DO UPDATE SET value=$value;`,
        { $key: key, $value: value },
      );
    },
    del: async (key: string) => {
      const db = await dbPromise;
      await db.run('DELETE FROM kvstore WHERE key=$key', { $key: key });
    },
    batch: async (operations: Array<BatchOperation>) => {
      // TODO: Can we do this in one operation?
      for (const operation of operations) {
        if (operation.type === 'put') {
          const { key, value } = operation;
          await self.put(key, value);
        } else {
          await self.del(operation.key);
        }
      }
    },
  };
  return self;
}

export const getDb = memoize(createDb);
