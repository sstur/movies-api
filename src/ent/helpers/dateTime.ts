/** Creates an ISO-8601 datetime string representing the current time */
export function now() {
  return new Date().toISOString();
}
