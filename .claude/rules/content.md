---
paths:
  - "src/content/**"
---

# Public content and the Markdown renderer

`src/content` is the only path from the database to a public page (`docs/spec/02-architecture.md` section 7.3).

- Queries here use the anonymous client with no session. They return only what an anonymous visitor may read. A query that seems to need more belongs in `features/admin/server`, not here.
- Never select from `lesson_solutions`. Never select a draft or archived row. Lint forbids importing admin queries here, and forbids importing these queries into the admin feature's write paths.
- Queries are cached with the content tag, so a page view with a warm cache makes no database query. The tag name lives in one constant.
- The Markdown renderer follows `docs/spec/04-content-system.md` section 5: an allowlist of elements, no raw HTML, no images, `https` links only with `rel="noopener noreferrer"`, highlighting on the server, a copy control on code blocks.
- The workspace and the dashboard preview use the same renderer and the same component. Never add a second rendering path.
- Malicious fixtures are part of the tests and must come out inert: script tags, event handler attributes, `javascript:` and `data:` links, HTML nested in Markdown.
