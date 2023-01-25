// Determines if the input is a "plain" object
export function isObject(input: unknown): input is ObjectOf<unknown> {
  return typeof input === 'object' && input != null && !Array.isArray(input);
}
