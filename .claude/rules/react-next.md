---
paths:
  - "src/app/**"
  - "src/features/**/components/**"
  - "src/features/**/client/**"
  - "src/ui/**"
  - "proxy.ts"
---

# React and Next.js

Check the current Next.js documentation before using an API. The facts this plan relies on are in `docs/spec/09-evidence.md`, E-09 and E-21.

## Routes

- Files in `src/app` compose features. No business rules, no queries, no schema definitions in a route file.
- Every page is rendered per request (ADR-0028). Do not add `generateStaticParams`, `force-static`, or a route-level `revalidate`, and do not turn on Cache Components. A static page cannot carry the nonce.
- Every route segment that loads data has loading, error, and where it applies not-found handling, with the states in `docs/spec/03-experience.md` section 8.
- Every page sets its title, description, and canonical address. Sign-in, profile, and admin pages are `noindex`.

## Components

- Server components by default. Add `"use client"` only for state, effects, or browser APIs, and keep client components small.
- A client component never imports from `src/infrastructure`, from a `server` folder, or from another feature's internals.
- No `dangerouslySetInnerHTML` anywhere. Lesson Markdown is rendered by the one component in `src/content`.
- No user-facing string literal. Copy comes from `src/messages`.
- Logical CSS properties only (`margin-inline-start`, not `margin-left`).
- Anything that injects a style or script element at run time, such as the code editor, gets the request's nonce. Read it from the request headers on the server and pass it down.

## Data and mutations

- Server components read through feature queries or `src/content`. They never call the app's own HTTP endpoints.
- Mutations are server actions built with the action wrapper (`.claude/rules/server.md`). Forms call them through a form action or `useActionState`, show a pending state, and render the typed error.
- The redirect after sign-in uses the validated return path only.

## proxy.ts

- Creates the nonce and sets the content security policy and the other headers in `docs/spec/06-security-privacy.md` section 5.
- Refreshes the session following the Supabase server-side guide. With no session cookie it makes no network call. If the auth service fails, it serves the page as signed out. It never holds a page on the auth service.
