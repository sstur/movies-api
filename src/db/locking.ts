type Lock = { release: () => void };

type LockRequest = (lock: Lock) => void;

type State = 'IDLE' | 'PROCESSING';

export function createLockingMechanism() {
  let state: State = 'IDLE';
  let queue: Array<LockRequest> = [];

  let enqueue = (request: LockRequest) => {
    queue.push(request);
    // This allows the stack to unwind before we process the next one
    process.nextTick(() => processNext());
  };

  let processNext = () => {
    if (state === 'IDLE') {
      let request = queue.shift();
      if (request) {
        state = 'PROCESSING';
        request(createLock());
      }
    }
  };

  let createLock = (): Lock => ({
    release: makeIdempotent(() => {
      state = 'IDLE';
      // This allows the stack to unwind before we process the next one
      process.nextTick(() => processNext());
    }),
  });

  let acquireLock = (): Promise<Lock> => {
    return new Promise((resolve) => {
      enqueue((lock) => {
        resolve(lock);
      });
    });
  };

  let runWithLock = async (callback: () => Promise<void>) => {
    let lock = await acquireLock();
    try {
      await callback();
    } finally {
      lock.release();
    }
  };

  return {
    acquireLock,
    runWithLock,
    getStateForTesting: () => state,
    getQueueForTesting: () => queue,
  };
}

// This wraps a side effect in a function such that the function can be called
// an arbitrary number of times but the side effect will be performed at most
// once (regardless of the arguments passed).
function makeIdempotent<T extends Array<unknown>>(
  fn: (...args: T) => void,
): (...args: T) => void {
  let hasBeenInvoked = false;
  return (...args) => {
    if (!hasBeenInvoked) {
      hasBeenInvoked = true;
      fn(...args);
    }
  };
}
