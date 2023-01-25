export function memoize<T>(fn: () => T): () => T {
  let cached: T | null = null;
  return () => cached ?? (cached = fn());
}
