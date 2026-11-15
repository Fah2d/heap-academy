---
paths:
  - "src/features/**/server/**"
  - "src/app/api/**"
  - "src/app/auth/**"
  - "src/infrastructure/**"
  - "proxy.ts"
---

# Server code

The boundary is specified in `docs/spec/02-architecture.md` section 9.

## Server actions

- Every server action is built with the one wrapper. It supplies, in order: a request ID, identity from `getClaims()`, schema parsing with size limits, the use case call, a typed result, and one structured log line. Do not hand-roll any of these.
- A server action is a public endpoint. Never accept a user ID, role, admin flag, XP value, status, or validation result without checking it. Identity comes only from verified claims.
- Reads and writes use the session client, so row level security decides. Do not reach for the privileged client to make something work.
- Admin actions declare that they are admin actions. The wrapper refuses them unless the session is an admin at `aal2`, and the database refuses them again.
- After any change that affects what learners see, invalidate the content cache tag (E-21). Check the current name and signature of the invalidation function first.
- Expected failures come back as typed results: invalid input, not found, denied, conflict, rate limited. Never pass a database error message to the client.

## Route handlers

- Only the four in section 9.2. Each validates its input and caps its body size. The report endpoints accept nothing that could hold personal data.

## Sign-in

- Return paths are relative, start with a single `/`, and fall back to `/courses`.
- The response to an email code request is identical whether or not the email exists.
- The bot challenge token goes to the auth provider. Never skip the challenge in production.

## Logging

- Structured JSON with an allowlist of fields: request ID, action or route, outcome code, duration, release. Never an email, a name, learner code, lesson content, or a token.
