// A stand-in for the session client in the structure tests: every query
// records its chain of calls and answers with the next scripted response, in
// order. It knows nothing about SQL; the policy and trigger tests in
// supabase/tests/database cover what the database decides.

export type FakeResponse = { data?: unknown; error?: { code?: string; message?: string } | null };

export type FakeDb = {
  /** Each query as `table.method(args)...`, or `rpc:name`. */
  calls: { target: string; chain: [string, unknown[]][] }[];
  answer: (...responses: FakeResponse[]) => void;
  from: (table: string) => unknown;
  rpc: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>;
};

export function fakeDb(): FakeDb {
  const queue: FakeResponse[] = [];
  const next = (): Promise<{ data: unknown; error: unknown }> => {
    const response = queue.shift();
    if (response === undefined) throw new Error("fake db: no scripted response left");
    return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
  };
  const calls: FakeDb["calls"] = [];

  function builder(target: string): unknown {
    const chain: [string, unknown[]][] = [];
    calls.push({ target, chain });
    const proxy: object = new Proxy(
      {},
      {
        get(_, property) {
          if (property === "then") {
            return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
              next().then(resolve, reject);
          }
          if (property === "single" || property === "maybeSingle") {
            return () => {
              chain.push([property, []]);
              return next();
            };
          }
          return (...args: unknown[]) => {
            chain.push([String(property), args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  return {
    calls,
    answer: (...responses) => queue.push(...responses),
    from: (table) => builder(table),
    rpc: (name, args) => {
      calls.push({ target: `rpc:${name}`, chain: [["args", [args]]] });
      return next();
    },
  };
}
