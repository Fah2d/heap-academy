/** How long a page waits for the auth service before it is served anyway (07-operations.md section 10). */
export const AUTH_TIMEOUT_MS = 1500;

/** A fetch that gives up after `milliseconds`, so a slow service frees the request. */
export function fetchWithin(milliseconds: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(milliseconds);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}
