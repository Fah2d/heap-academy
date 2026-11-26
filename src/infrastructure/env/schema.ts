import { z } from "zod";
// Relative: next.config.ts loads this file, and its loader does not resolve
// the `@/` alias.
import { RELEASE_LOCAL, RELEASE_PATTERN } from "../../domain/release";

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

// The bot challenge's site key is public by design: the widget sends it from
// the browser. Cloudflare's keys start with 0x; its published test keys,
// used on the local stack and in CI, start with 1x, 2x or 3x.
const challengeSiteKey = z
  .string()
  .regex(/^[0-3]x[A-Za-z0-9_-]{10,}$/, "must be a Turnstile site key (0x...)");

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: challengeSiteKey,
});

// The release in log lines and in the health answer: the commit SHA, which
// the deploy workflow sets when it builds. Unset everywhere else, where the
// release is "local". next.config.ts inlines it at build, because a prebuilt
// deployment does not see the build's environment at run time.
export { RELEASE_LOCAL };
const release = z.string().regex(RELEASE_PATTERN, "must be a full commit SHA or local").optional();

export const serverEnvironmentSchema = z.object({
  RESEND_API_KEY: required,
  HEAP_RELEASE: release,
  // Account deletion (FR-PRF-03). All three or none: with none, the profile
  // offers no deletion. The key bypasses row level security.
  SUPABASE_SECRET_KEY: z
    .string()
    .startsWith("sb_secret_", { error: "must be a secret key (sb_secret_...)" })
    .optional(),
  DELETION_NOTICE_FROM: z.email().optional(),
  DELETION_NOTICE_TO: z.email().optional(),
});

const DELETION_NAMES = [
  "SUPABASE_SECRET_KEY",
  "DELETION_NOTICE_FROM",
  "DELETION_NOTICE_TO",
] as const;

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
  const missing = DELETION_NAMES.filter((name) => all[name] === undefined);
  if (missing.length > 0 && missing.length < DELETION_NAMES.length) {
    throw new EnvironmentError(
      `Invalid environment. See .env.example.\n${missing
        .map((name) => `  ${name}: required with the other account deletion variables`)
        .join("\n")}`,
    );
  }
  return {
    public: {
      NEXT_PUBLIC_SUPABASE_URL: all.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: all.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: all.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    server: {
      RESEND_API_KEY: all.RESEND_API_KEY,
      HEAP_RELEASE: all.HEAP_RELEASE ?? RELEASE_LOCAL,
      SUPABASE_SECRET_KEY: all.SUPABASE_SECRET_KEY,
      DELETION_NOTICE_FROM: all.DELETION_NOTICE_FROM,
      DELETION_NOTICE_TO: all.DELETION_NOTICE_TO,
    },
  };
}

export type DeletionEnvironment = {
  supabaseUrl: string;
  secretKey: string;
  resendKey: string;
  noticeFrom: string;
  noticeTo: string;
};

/** What account deletion needs, or null when this deployment has none of it. */
export function deletionEnvironment(source: Source): DeletionEnvironment | null {
  const { public: shared, server } = parseEnvironment(source);
  const { SUPABASE_SECRET_KEY, DELETION_NOTICE_FROM, DELETION_NOTICE_TO } = server;
  if (!SUPABASE_SECRET_KEY || !DELETION_NOTICE_FROM || !DELETION_NOTICE_TO) return null;
  return {
    supabaseUrl: shared.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: SUPABASE_SECRET_KEY,
    resendKey: server.RESEND_API_KEY,
    noticeFrom: DELETION_NOTICE_FROM,
    noticeTo: DELETION_NOTICE_TO,
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
