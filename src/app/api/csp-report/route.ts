import { handleCspReport } from "@/features/system";

// POST only. Any other method gets the framework's 405.
export function POST(request: Request): Promise<Response> {
  return handleCspReport(request);
}
