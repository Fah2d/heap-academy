---
paths:
  - "src/app/**"
  - "src/features/**/components/**"
  - "src/ui/**"
  - "src/**/*.css"
---

# Interface work

Before any change here:

1. Read `DESIGN.md`. No interface work happens before it is signed (`CLAUDE.md` rule 5).
2. Load the antislop skills in `.claude/skills/` and state the Design Read from `DESIGN.md` at the top of your plan.
3. Read the screen's section of `docs/spec/03-experience.md`, its states in section 8, and the rules for words in section 9.

While building:

- Semantic tokens only. No raw color, spacing, radius, font size, or shadow value in a component. Lint enforces it.
- Behavior comes from React Aria Components. Do not hand-write focus management, menus, dialogs, or tabs.
- Every state in section 8 exists and is reachable in a test. No placeholder, no "coming soon", no fake data.
- Focus is always visible. Touch targets are at least 44 by 44 px. Text and syntax colors meet AA contrast. Motion stops under reduced motion.
- The only illustration is the mascot from `/brand`. Never generate, draw, or trace a brand asset.
- Nothing from the "Never" list in section 10.9 of the experience spec.
- Copy goes in `src/messages`, written with the antislop copywriting skill loaded.
- The dashboard uses the same tokens and primitives, denser, built for 1024 px and wider.

Before calling it done (`docs/spec/05-engineering-handbook.md` section 7):

- Run the app and drive every control.
- Take screenshots of every state at 375, 768, and 1280 px (the dashboard at 1280 px) into `docs/reports/screens/<WP-id>/`. Look at each one.
- Run axe. No serious or critical finding.
- Write the antislop Delivery Gate report, line by line, in the pull request.
- Ask `design-reviewer` to review, with the screenshot paths.
