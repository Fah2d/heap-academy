import { z } from "zod";

// One schema for every environment variable (docs/spec/02-architecture.md
// section 13). Public variables are inlined into browser bundles by Next.js,
// so only values that are safe to publish may carry the NEXT_PUBLIC_ prefix
// (NFR-SEC-04, T-12). `.env.example` lists exactly these names.

const required = z.string().min(1, "required");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const supabaseUrl = z.url({ protocol: /^https?$/, error: "must be an http or https URL" }).refine(
  (value) => {
    // Zod runs this refinement even when the URL check above has failed; that
    // failure is already reported.
    if (!URL.canParse(value)) return true;
    const url = new URL(value);
    return url.protocol === "https:" || LOCAL_HOSTS.has(url.hostname);
  },
  { error: "must use https unless it points at the local stack" },
);

// The publishable key goes to every browser. A secret key pasted here by
// mistake would be published, so only the publishable form is accepted.
const publishableKey = required.startsWith("sb_publishable_", {
  error: "must be a publishable key (sb_publishable_...), never a secret key",
});

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
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
 * Parses the variables the browser bundle needs. The build checks these; it
 * does not need server secrets (docs/spec/02-architecture.md section 13).
 * A missing or malformed value throws with the name and reason, never the value.
 */
export function parsePublicEnvironment(source: Source): PublicEnvironment {
  return parseWith(publicEnvironmentSchema, source);
}

/** Parses every variable. The server checks these when it starts. */
export function parseEnvironment(source: Source): {
  public: PublicEnvironment;
  server: ServerEnvironment;
} {
  const schema = z.object({
    ...publicEnvironmentSchema.shape,
    ...serverEnvironmentSchema.shape,
  });
  const all = parseWith(schema, source);
  return {
    public: {
      NEXT_PUBLIC_SUPABASE_URL: all.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: all.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
    server: { RESEND_API_KEY: all.RESEND_API_KEY },
  };
}

function parseWith<Schema extends z.ZodObject>(schema: Schema, source: Source): z.infer<Schema> {
  const picked: Record<string, string | undefined> = {};
  for (const name of Object.keys(schema.shape)) {
    const value = source[name];
    picked[name] = value === "" ? undefined : value;
  }
  const result = schema.safeParse(picked);
  if (result.success) return result.data;
  const problems = result.error.issues.map(
    (issue) =>
      `  ${issue.path.join(".")}: ${issue.code === "invalid_type" ? "required" : issue.message}`,
  );
  throw new EnvironmentError(`Invalid environment. See .env.example.\n${problems.join("\n")}`);
}
