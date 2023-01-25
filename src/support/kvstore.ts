import fs from 'fs/promises';
import { resolve, dirname } from 'path';

import { Database } from 'sqlite3';
import { open } from 'sqlite';

import { memoize } from '../support/memoize';

const basePath = resolve(__dirname, '../..');
const dbPath = 'data/db.sqlite';

const openDb = memoize(async () => {
  const dbFullPath = resolve(basePath, dbPath);
  const dbDir = dirname(dbFullPath);
  await fs.mkdir(dbDir, { recursive: true });
  const db = await open({
    filename: dbFullPath,
    driver: Database,
  });
  await db.run(
    `CREATE TABLE IF NOT EXISTS kvstore (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;`,
  );
  return db;
});

export const getStore = memoize(() => {
  const dbPromise = openDb();
  return {
    get: async (key: string) => {
      const db = await dbPromise;
      const result = await db.get('SELECT value FROM kvstore WHERE key=$key', {
        $key: key,
      });
      const value = result?.value;
      return typeof value === 'string' ? parse(value) : null;
    },
    has: async (key: string) => {
      const db = await dbPromise;
      const result = await db.get(
        'SELECT 1 FROM kvstore WHERE key=$key LIMIT 1',
        { $key: key },
      );
      return result != null;
    },
    set: async (key: string, value: unknown) => {
      const db = await dbPromise;
      await db.run(
        `INSERT INTO kvstore (key, value) VALUES ($key, $value) ON CONFLICT (key) DO UPDATE SET value=$value;`,
        { $key: key, $value: stringify(value) },
      );
    },
    del: async (key: string) => {
      const db = await dbPromise;
      const result = await db.run('DELETE FROM kvstore WHERE key=$key', {
        $key: key,
      });
      return result.changes !== 0;
    },
  };
});

function stringify(value: unknown): string {
  let serialized = JSON.stringify(value);
  return serialized || 'null';
}

function parse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (e) {
    return null;
  }
}
