# Contrast check, WP-1.4

Run on 2026-11-16 with `.claude/skills/antislop-human/contrast-check.py` over every token pair in use, resolved from `src/ui/tokens/`. Text pairs need 4.5 to 1; non-text pairs (borders, focus ring, progress fill, editor outlines) need 3 to 1.

```
text --color-text (#f2f0ec) on --color-bg (#0e0e10): ratio: 16.94:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text (#f2f0ec) on --color-surface-editor (#121215): ratio: 16.43:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text (#f2f0ec) on --color-surface (#16161a): ratio: 15.85:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text (#f2f0ec) on --color-surface-raised (#1e1e23): ratio: 14.58:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text (#f2f0ec) on --color-surface-hover (#2e2e36): ratio: 11.83:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text (#f2f0ec) on --color-selection (#26262c): ratio: 13.22:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-bg (#0e0e10): ratio: 7.86:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-surface-editor (#121215): ratio: 7.62:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-surface (#16161a): ratio: 7.35:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-surface-raised (#1e1e23): ratio: 6.76:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-surface-hover (#2e2e36): ratio: 5.48:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-muted (#a9a59d) on --color-selection (#26262c): ratio: 6.13:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-bg (#0e0e10): ratio: 8.12:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-surface-editor (#121215): ratio: 7.87:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-surface (#16161a): ratio: 7.60:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-surface-raised (#1e1e23): ratio: 6.99:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-surface-hover (#2e2e36): ratio: 5.67:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-action (#d4a017) on --color-selection (#26262c): ratio: 6.33:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-bg (#0e0e10): ratio: 10.17:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-surface-editor (#121215): ratio: 9.86:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-surface (#16161a): ratio: 9.52:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-surface-raised (#1e1e23): ratio: 8.76:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-surface-hover (#2e2e36): ratio: 7.10:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-pass (#6fd08c) on --color-selection (#26262c): ratio: 7.93:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-bg (#0e0e10): ratio: 7.64:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-surface-editor (#121215): ratio: 7.41:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-surface (#16161a): ratio: 7.15:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-surface-raised (#1e1e23): ratio: 6.57:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-surface-hover (#2e2e36): ratio: 5.33:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-fail (#ff7a7a) on --color-selection (#26262c): ratio: 5.96:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-subtle (#8a877f) on --color-bg (#0e0e10): ratio: 5.37:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-subtle (#8a877f) on --color-surface-editor (#121215): ratio: 5.21:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-text-subtle (#8a877f) on --color-surface (#16161a): ratio: 5.03:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-on-action (#0e0e10) on --color-action (#d4a017): ratio: 8.12:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-on-action (#0e0e10) on --color-action-hover (#e3b53a): ratio: 10.04:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --color-on-action (#0e0e10) on --color-action-press (#b8890f): ratio: 6.08:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-text (#f2f0ec) on --color-surface-editor (#121215): ratio: 16.43:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-text (#f2f0ec) on --editor-selection (#34343c): ratio: 10.84:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-keyword (#f2f0ec) on --color-surface-editor (#121215): ratio: 16.43:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-keyword (#f2f0ec) on --editor-selection (#34343c): ratio: 10.84:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-string (#c9d6a3) on --color-surface-editor (#121215): ratio: 12.14:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-string (#c9d6a3) on --editor-selection (#34343c): ratio: 8.01:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-number (#e3a8c4) on --color-surface-editor (#121215): ratio: 9.50:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-number (#e3a8c4) on --editor-selection (#34343c): ratio: 6.26:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-function (#9cc5e6) on --color-surface-editor (#121215): ratio: 10.28:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-function (#9cc5e6) on --editor-selection (#34343c): ratio: 6.78:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-builtin (#9fd4c7) on --color-surface-editor (#121215): ratio: 11.32:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-builtin (#9fd4c7) on --editor-selection (#34343c): ratio: 7.47:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-comment (#a09c94) on --color-surface-editor (#121215): ratio: 6.84:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-comment (#a09c94) on --editor-selection (#34343c): ratio: 4.51:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-error (#ff7a7a) on --color-surface-editor (#121215): ratio: 7.41:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
text --syntax-error (#ff7a7a) on --editor-selection (#34343c): ratio: 4.89:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-border-control (#74747f) on --color-bg (#0e0e10): ratio: 4.18:1 normal text (4.5:1): FAIL large text  (3.0:1): PASS 
non-text --color-border-control (#74747f) on --color-surface-editor (#121215): ratio: 4.05:1 normal text (4.5:1): FAIL large text  (3.0:1): PASS 
non-text --color-border-control (#74747f) on --color-surface (#16161a): ratio: 3.91:1 normal text (4.5:1): FAIL large text  (3.0:1): PASS 
non-text --color-border-control (#74747f) on --color-surface-raised (#1e1e23): ratio: 3.59:1 normal text (4.5:1): FAIL large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-bg (#0e0e10): ratio: 8.12:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-surface (#16161a): ratio: 7.60:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-surface-raised (#1e1e23): ratio: 6.99:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-surface-hover (#2e2e36): ratio: 5.67:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-surface-editor (#121215): ratio: 7.87:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-focus (#d4a017) on --color-selection-editor (#34343c): ratio: 5.19:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-action (#d4a017) on --color-surface-hover (#2e2e36): ratio: 5.67:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --editor-bracket-match (#a9a59d) on --color-surface-editor (#121215): ratio: 7.62:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --editor-bracket-match (#a9a59d) on --editor-selection (#34343c): ratio: 5.03:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-text-muted (#a9a59d) on --color-bg (#0e0e10): ratio: 7.86:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
non-text --color-fail (#ff7a7a) on --color-bg (#0e0e10): ratio: 7.64:1 normal text (4.5:1): PASS large text  (3.0:1): PASS 
```

The non-text pairs are judged on the 3 to 1 line (the script's large-text column). All 52 text pairs pass 4.5 to 1, and all 15 non-text pairs pass 3 to 1; the lowest non-text ratio is 3.59 (control border on a raised surface). `src/ui/tokens/contrast.test.ts` measures the same pairs in every unit run.
