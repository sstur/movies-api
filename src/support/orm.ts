/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStore } from './kvstore';

type Model<T extends { id: number }> = {
  insert: (item: Expand<Omit<T, 'id'>>) => Promise<T>;
  update: (id: number, updates: Partial<T>) => Promise<T | null>;
  delete: (id: number) => Promise<boolean>;
  getById: (id: number) => Promise<T | null>;
  getAll: () => Promise<Array<T>>;
  findWhere: (fn: (item: T) => boolean) => Promise<Array<T>>;
};

export function Model<T extends { id: number }>() {
  return (name: string) => createModel<T>(name);
}

export function fromSchema<T extends Record<string, { id: number }>>(schema: {
  [K in keyof T]: (name: string) => Model<T[K]>;
}) {
  const db: Record<string, any> = {};
  for (const [name, fn] of Object.entries(schema)) {
    db[name] = fn(name);
  }
  return db as { [K in keyof T]: Model<T[K]> };
}

function createModel<T extends { id: number }>(name: string): Model<T> {
  const store = getStore();
  const self = {
    insert: async (item: Expand<Omit<T, 'id'>>): Promise<T> => {
      const existingId = toNumber(Object(item).id);
      const id = existingId ?? createId();
      const record: T = { id, ...item } as any;
      const idList = toArray(await store.get(name));
      idList.push(id);
      await store.set(name, idList);
      await store.set(toKey(name, id), record);
      return record;
    },
    update: async (id: number, updates: Partial<T>): Promise<T | null> => {
      const key = toKey(name, id);
      const record: T | null = (await store.get(key)) as any;
      if (record) {
        const newRecord = { ...record };
        for (const [key, value] of Object.entries(updates)) {
          if (key !== 'id' && value !== undefined) {
            newRecord[key as keyof T] = value;
          }
        }
        await store.set(key, newRecord);
        return newRecord;
      }
      return null;
    },
    delete: async (id: number): Promise<boolean> => {
      const idList = toArray(await store.get(name));
      await store.set(
        name,
        idList.filter((n) => n !== id),
      );
      return await store.del(toKey(name, id));
    },
    getById: async (id: number): Promise<T | null> => {
      const record = await store.get(toKey(name, id));
      return record as any;
    },
    getAll: async (): Promise<Array<T>> => {
      const idList = toArray(await store.get(name));
      const results: Array<T> = [];
      for (const id of idList) {
        const record = await store.get(toKey(name, id));
        results.push(record as any);
      }
      return results;
    },
    findWhere: async (fn: (item: T) => boolean): Promise<Array<T>> => {
      const items = await self.getAll();
      return items.filter(fn);
    },
  };
  return self;
}

function toArray(input: unknown): Array<number> {
  return Array.isArray(input) ? input : [];
}

function toKey(name: string, id: number) {
  return `${name}/${id}`;
}

function toNumber(input: unknown): number | undefined {
  return typeof input === 'number' ? input : undefined;
}

function createId() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
