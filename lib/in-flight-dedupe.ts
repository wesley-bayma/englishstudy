const inFlight = new Map<string, Promise<unknown>>();

/**
 * Shares only work that is currently running. Completed responses are not
 * retained, so a later request can still receive fresh content.
 */
export function withInFlightDeduplication<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = factory();
  inFlight.set(key, promise);
  void promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }).catch(() => undefined);
  return promise;
}

export function getInFlightCount(): number {
  return inFlight.size;
}
