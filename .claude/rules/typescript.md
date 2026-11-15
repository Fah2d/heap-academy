---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "scripts/**"
  - "e2e/**/*.ts"
  - "proxy.ts"
---

# TypeScript

- Strict mode with the extra flags in `docs/spec/05-engineering-handbook.md` section 5. Do not relax a flag.
- No `any`. Use `unknown` and parse. No non-null assertion (`!`) outside tests. No `@ts-ignore`. `@ts-expect-error` only with a reason on the same line and the owner's approval in the pull request.
- Everything that crosses a boundary is parsed by a schema before use: server action input, worker messages, JSON columns read from the database, environment variables, browser storage, imported files, responses from other services.
- IDs are branded types (`LessonId`, `CourseId`, `UserId`, `TestCaseId`). Never pass a plain string where an ID is expected.
- States, messages, and results are discriminated unions. Switches over them are exhaustive and end in a `never` check.
- Expected failures at a boundary return a typed result (`{ ok: true, value }` or `{ ok: false, error }`). Unexpected ones throw. No empty `catch`, and no `catch` that only logs.
- `src/domain` and `src/grader` import nothing that performs I/O and nothing from React, Next.js, or Supabase. Time and randomness are parameters.
- Import another feature only through its `index.ts`. Never import from `src/app`.
- Modules meant for the server start with `import "server-only"`.
- Names come from the glossary in `docs/spec/00-charter.md` section 10. A comment says why, not what.
- No default exports, except where Next.js requires them: pages, layouts, route handlers, configuration files.
