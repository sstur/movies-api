import { EventEmitter } from '../support/EventEmitter';
import { memoize } from '../support/memoize';

import { createLockingMechanism } from './locking';
import { transaction } from './transactions';
import { getDb } from './sqlite';

export type BatchOperation =
  | { type: 'del'; key: string }
  | { type: 'put'; key: string; value: SerializedValue };

type BatchOptions = {
  beforeCommit?: () => void;
};

type ChangeEvent = { key: string };

type ChangeListener = (event: ChangeEvent) => void;

type Events = {
  change: [ChangeEvent];
};

function createStore() {
  const db = getDb();
  const emitter = new EventEmitter<Events>();
  const { runWithLock } = createLockingMechanism();
  const store = {
    subscribe: (listener: ChangeListener) => {
      const unsubscribe = emitter.addListener('change', listener);
      return { unsubscribe };
    },
    get: async (key: string) => {
      let value = await db.get(key);
      const parsed: JSONValue = value == null ? null : JSON.parse(value);
      return parsed;
    },
    has: async (key: string) => {
      let value = await db.get(key);
      return value != null;
    },
    put: async (key: string, value: unknown) => {
      await runWithLock(async () => {
        let serialized = serialize(value);
        await db.put(key, serialized);
        emitter.emit('change', { key });
      });
    },
    del: async (key: string) => {
      await runWithLock(async () => {
        await db.del(key);
        emitter.emit('change', { key });
      });
    },
    batch: async (
      operations: Array<BatchOperation>,
      options?: BatchOptions,
    ) => {
      let stringifiedOperations = operations.map((op) => {
        if (op.type === 'put') {
          let { type, key, value } = op;
          return { type, key, value: value.toString() };
        } else {
          return op;
        }
      });
      await runWithLock(async () => {
        options?.beforeCommit?.();
        await db.batch(stringifiedOperations);
        for (let { key } of operations) {
          emitter.emit('change', { key });
        }
      });
    },
    // This is a getter since we need a self reference to pass to transaction.
    get transaction() {
      return transaction(store);
    },
  };
  return store;
}

function serialize(value: unknown): string {
  let serialized = JSON.stringify(value);
  return serialized || 'null';
}

// This is used to represent a pre-serialized value for batch operations and for
// cached writes within transactions.
export class SerializedValue {
  private value: string;

  constructor(value: unknown) {
    this.value =
      value instanceof SerializedValue ? value.toString() : serialize(value);
  }

  toString() {
    return this.value;
  }

  revive() {
    return JSON.parse(this.value) as JSONValue;
  }

  static create(value: unknown) {
    return new SerializedValue(value);
  }
}

export type Store = ReturnType<typeof createStore>;

// Note: because of the way the locking system works, it's important we only
// ever create one store instance. We'll use memoize to guarantee this.
export const getStore = memoize(() => {
  if (process.env.NODE_ENV === 'test') {
    throw new Error(
      'Do not call getStore from tests. Mock this function instead.',
    );
  }
  return createStore();
});
