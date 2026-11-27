# WP-7.5 security review 1

Reviewer: `security-reviewer`, fresh context. Range 5dcc577..bfc09bd. Verdict: APPROVE. No BLOCKER, MAJOR or MINOR.

Checked: the home editor runs code only through the shared worker (T-01) and reads nothing from the address or storage; the nonce read carries no identity; the boundary test allows the home page exactly the lesson page's two imports (rule 9, T-21). `lesson_completion_counts()` is security definer, admin only inside, with four-caller policy tests; the read uses the admin's session and parses the answer (T-19, T-20). The symbol row inserts fixed text only; error and near-miss words come from `src/messages`, never from Python's output (T-07).

Outside its remit: the function returns one row per lesson for the whole database, and the Data API's row limit (1000 by default) would cut it off silently past that many lessons. For the owner; far beyond the first release's size.

The reviewer's `pnpm test:db` failed on leftover rows from another journey in the shared local database; after a reset the same suite passes (see the description).
