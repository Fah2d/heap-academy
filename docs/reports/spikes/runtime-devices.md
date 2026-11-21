# Spike report: Python in the browser on real phones

- Work package: WP-3.4
- Date: started 2026-11-21. The phone rows wait for the owner's check.
- Decides: whether ADR-0020's runtime (Pyodide in a worker, live input, the watchdog) stands on phones, or Day 4 starts with a fix.

## Question

On a real iPhone and a real Android phone, in the browser and inside the TikTok and Instagram in-app browsers: does the runtime page load Python, run a program that asks for input, check it against the example lesson, and stop a runaway loop? Yes or no for each, with the input strategy each one used.

## Method

The page is `/dev/runtime` (`src/app/dev/runtime/page.preview.tsx`). It exists on the development server and on Vercel previews only: production builds have no route for it (`src/infrastructure/env/page-extensions.ts`). It runs through the workspace statechart (`src/runtime/workspace-chart.ts`) and its driver.

The owner opens the protected preview of `wp/3.4-statechart` through its Vercel shareable link. Whether a Hobby project offers one is still to be tried (`docs/runbooks/infrastructure-setup.md` section 5, item 10). If it does not, the owner decides how to reach the page.

On each phone and browser:

1. Open the link. Wait until the status reads Ready. Note the time it took.
2. Note the input strategy. It is interactive (ADR-0005, stack switching) when the page shows "Leave it empty to answer while the program runs." under the input box, and batch when it does not. Interactive only: press **Asks for a name**, leave the input empty, press **Run**, answer when the program waits. Expect `Hello, <name>`.
3. Type a name in the input box first, press **Run** again. Expect the same, with no question.
4. Press **Check**. Expect both test cases of the example lesson to pass.
5. Press **Runs forever**, then **Run**. Expect the time limit to stop it, and Python to be ready again.
6. Press **Run** while Python is still starting (reload first). Expect "Run waits for Python", then the run.
7. Record the browser and engine version (Settings, About, or the user agent).

## Results

The browser engines in CI run `e2e/statechart-runtime.spec.ts` and `e2e/live-input-runtime.spec.ts`. They were not run in the session that wrote this report (no browser there).

| Check | Chromium | Firefox | WebKit | Real iPhone, Safari | Real iPhone, TikTok | Real iPhone, Instagram | Real Android, Chrome | Real Android, TikTok | Real Android, Instagram |
|---|---|---|---|---|---|---|---|---|---|
| Engine and version | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Python ready, seconds | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Input strategy | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Live input (step 2) | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Input given first (step 3) | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Check (step 4) | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Runaway loop stopped (step 5) | not run | not run | not run | not run | not run | not run | not run | not run | not run |
| Run waits for Python (step 6) | not run | not run | not run | not run | not run | not run | not run | not run | not run |

## Surprises

None recorded yet.

## Decision

Not made yet. It follows the phone rows. A failure there is the first work of Day 4 (`docs/spec/08-delivery-plan.md`, WP-3.4).

## What happens to the code

The page stays as a preview-only development page until the workspace of WP-5.2 replaces it. The statechart and its driver are promoted already, with tests, in `src/runtime/`.
