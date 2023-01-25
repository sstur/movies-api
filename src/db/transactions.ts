import { defineErrors } from '../support/CustomErrors';

import { SerializedValue, type BatchOperation, type Store } from './store';

type State = 'QUEUEING' | 'COMMITTING' | 'COMMITTED' | 'ABORTED';

type CachedRecord =
  | { type: 'DELETED' }
  | { type: 'VALUE'; value: SerializedValue };

const Errors = defineErrors({
  ConflictError: 'Transaction aborted due to a conflict',
  InvalidStateError:
    'Unable to execute "{operation}" from transaction state {state}',
  MaxRetriesExceededError:
    'Transaction aborted due to a conflict; maximum number of retries exceeded',
});

export function transaction(store: Store) {
  const create = () => {
    // The list of keys that this transaction touches (reads or writes)
    let keys = new Set<string>();
    // The list of keys that were changed by other operations
    let dirty = new Set<string>();
    let subscription = store.subscribe(({ key }) => {
      dirty.add(key);
    });
    let isDirty = () => someInList(keys, dirty);
    let state: State = 'QUEUEING';
    let queue: Array<BatchOperation> = [];
    let cache = new Map<string, CachedRecord>();
    return {
      get: async (key: string) => {
        keys.add(key);
        let cached = cache.get(key);
        if (cached) {
          return cached.type === 'VALUE' ? cached.value.revive() : null;
        } else {
          return await store.get(key);
        }
      },
      has: async (key: string) => {
        keys.add(key);
        let cached = cache.get(key);
        if (cached) {
          return cached.type !== 'DELETED';
        } else {
          return await store.has(key);
        }
      },
      put: (key: string, value: unknown) => {
        if (state !== 'QUEUEING') {
          throw new Errors.InvalidStateError({ operation: 'put', state });
        }
        keys.add(key);
        let serializedValue = SerializedValue.create(value);
        cache.set(key, {
          type: 'VALUE',
          value: serializedValue,
        });
        queue.push({ type: 'put', key, value: serializedValue });
      },
      del: (key: string) => {
        if (state !== 'QUEUEING') {
          throw new Errors.InvalidStateError({ operation: 'del', state });
        }
        keys.add(key);
        cache.set(key, { type: 'DELETED' });
        queue.push({ type: 'del', key });
      },
      commit: async () => {
        if (state !== 'QUEUEING') {
          throw new Errors.InvalidStateError({ operation: 'commit', state });
        }
        if (isDirty()) {
          subscription.unsubscribe();
          state = 'ABORTED';
          throw new Errors.ConflictError();
        }
        if (queue.length) {
          state = 'COMMITTING';
          await store.batch(queue, {
            // After write lock has been acquired, check again if we're dirty and
            // abort the commit if necessary.
            beforeCommit: () => {
              subscription.unsubscribe();
              if (isDirty()) {
                state = 'ABORTED';
                throw new Errors.ConflictError();
              }
            },
          });
        } else {
          subscription.unsubscribe();
        }
        state = 'COMMITTED';
      },
      abort: () => {
        if (state !== 'QUEUEING') {
          throw new Errors.InvalidStateError({ operation: 'abort', state });
        }
        subscription.unsubscribe();
        state = 'ABORTED';
      },
      getState() {
        return state;
      },
      cleanup: () => {
        subscription.unsubscribe();
      },
    };
  };

  // Ensure that commit() cannot be called within exec()
  type Transaction = Expand<
    Omit<ReturnType<typeof create>, 'commit' | 'cleanup'>
  >;
  type Procedure<T> = (transaction: Transaction) => Promise<T>;

  const exec = async <T>(procedure: Procedure<T>): Promise<T> => {
    let count = 0;
    let maxRetries = 10;
    while (true) {
      let { commit, cleanup, ...txn } = create();
      try {
        let result = await procedure(txn);
        if (txn.getState() !== 'ABORTED') {
          await commit();
        }
        return result;
      } catch (e: unknown) {
        count += 1;
        if (e instanceof Errors.ConflictError) {
          if (count < maxRetries) {
            // Try again
            continue;
          } else {
            throw new Errors.MaxRetriesExceededError();
          }
        }
        throw e;
      } finally {
        // Ensure that we remove all event listeners
        cleanup();
      }
    }
  };

  return { create, exec };
}

export type Transaction = Parameters<
  Parameters<ReturnType<typeof transaction>['exec']>[0]
>[0];

function someInList(keys: Set<string>, dirty: Set<string>) {
  for (let key of keys) {
    if (dirty.has(key)) {
      return true;
    }
  }
  return false;
}
