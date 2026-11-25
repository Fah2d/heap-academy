import type { NextRequest } from "next/server";
import { handleGoogleCallback } from "@/features/auth";

export function GET(request: NextRequest) {
  return handleGoogleCallback(request);
}
