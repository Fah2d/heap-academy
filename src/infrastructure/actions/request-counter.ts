import "server-only";
import { createCounterClient } from "@/infrastructure/db/counter-client";
import { parseActionCounterKey } from "@/infrastructure/env/schema";
import { clientAddress } from "@/infrastructure/http/client-address";
import { type CountResult, createActionCounter } from "./action-counter";

/**
 * The per-action counter for one request (T-14): its platform address, the
 * server's key, and a client with no session. Server actions and the report
 * endpoints count through it.
 */
export function requestCounter(
  headers: Pick<Headers, "get">,
): (action: string, perMinute: number) => Promise<CountResult> {
  const client = createCounterClient();
  return createActionCounter(
    (name, args) => client.rpc(name, args),
    parseActionCounterKey(process.env),
    clientAddress(headers),
  );
}
