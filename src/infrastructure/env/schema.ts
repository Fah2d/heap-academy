import { z } from "zod";

// One schema for every environment variable (docs/spec/02-architecture.md
// section 13). Public variables are inlined into browser bundles by Next.js,
// so only values that are safe to publish may carry the NEXT_PUBLIC_ prefix
// (NFR-SEC-04, T-12). `.env.example` lists exactly these names.

const required = z.string().min(1, "required");

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: "must be an http or https URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required,
});

export const serverEnvironmentSchema = z.object({
  RESEND_API_KEY: required,
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export class EnvironmentError extends Error {
  override readonly name = "EnvironmentError";
}

type Source = Readonly<Record<string, string | undefined>>;

/**
 * Parses the whole environment. A missing or malformed value throws with the
 * variable's name and the reason, never with the value.
 */
export function parseEnvironment(source: Source): {
  public: PublicEnvironment;
  server: ServerEnvironment;
} {
  const publicResult = publicEnvironmentSchema.safeParse(pick(source, publicEnvironmentSchema));
  const serverResult = serverEnvironmentSchema.safeParse(pick(source, serverEnvironmentSchema));
  const problems = [
    ...(publicResult.success ? [] : publicResult.error.issues),
    ...(serverResult.success ? [] : serverResult.error.issues),
  ].map(
    (issue) =>
      `${issue.path.join(".")}: ${issue.code === "invalid_type" ? "required" : issue.message}`,
  );

  if (!publicResult.success || !serverResult.success) {
    throw new EnvironmentError(
      `Invalid environment. See .env.example.\n${problems.map((problem) => `  ${problem}`).join("\n")}`,
    );
  }
  return { public: publicResult.data, server: serverResult.data };
}

function pick(source: Source, schema: z.ZodObject): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const name of Object.keys(schema.shape)) {
    const value = source[name];
    picked[name] = value === "" ? undefined : value;
  }
  return picked;
}
