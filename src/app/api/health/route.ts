import { connection } from "next/server";
import { healthResponse } from "@/features/system";

export async function GET(): Promise<Response> {
  // Answered per request, never from a build-time copy: the check is that a
  // function runs.
  await connection();
  return healthResponse();
}
