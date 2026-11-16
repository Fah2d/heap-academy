import { parseEnvironment } from "@/infrastructure/env/schema";

// Configuration is validated when the server starts
// (docs/spec/02-architecture.md section 13).
export function register(): void {
  parseEnvironment(process.env);
}
