# AI & Developer Guidelines for this repository

Purpose
-------
This file tells an ai assistant how to make changes in this repository in a consistent, safe, and predictable way. Treat it as the "rules of engagement" for automated edits.

When to follow these rules
-------------------------
- Any time you ask an AI to make changes to the codebase.
- Any automated process that edits files (scripts, bots, CI) should consult this file first.

# Rules of engagement — new content only (condensed)

Keep this short. Follow these rules whenever adding or changing content (HTML/CSS/JS).

1) Use examples in the repo
- Before creating new markup or styles, open similar files in the project and copy their structure and naming. Match conventions (IDs, classes, markup patterns).

2) Scope edits narrowly
- Make the smallest change that achieves the goal. Prefer adding new files or small blocks over sweeping global edits.

3) IDs and anchors
- Re-use existing IDs declared in `index.html` when possible. Do not create new global IDs unless necessary. Avoid changing existing IDs used elsewhere.

4) CSS rules
- Keep formatting consistent with `css/main.css` (follow existing indentation and selector style).
- Do not set site-wide default values (colors, font-sizes, root variables) unless explicitly requested.
- Prefer scoped selectors (e.g., `.sidebar .cat-btn`) over global element selectors.

5) JavaScript
- Place behavior in `js/` as an external file and load it with `defer` from `index.html`.
- Avoid polluting the global scope; wrap code in an IIFE or module.

6) No implicit defaults
- Don’t assume or hardcode default user values (e.g., default skill tags, default quantities). If defaults are required, prompt or document them and make them explicit in code with clear comments.

7) Visual/style changes
- Use existing utility classes and colors. If adding new CSS, keep it minimal and placed in `css/main.css` or a new file under `css/` with a descriptive name.

8) Testing & verification
- After changes, open `index.html` locally and verify: layout intact, sidebar visible, search input present, and console has no errors.

9) Commits and messages
- Commit small, named changes. Use a short tag: `[feat]`, `[fix]`, `[style]`, `[docs]`. Explain any assumptions.

10) If unsure/not 100% confident -> ask
- If a choice could break other pages or change defaults, stop and ask a single concise question.

Quick task template (use when requesting changes)
- Goal (one sentence)
- Files to edit (optional)
- Important constraints (IDs to use, no default values, browser targets)

11) Use items.json for item ID's
- Don't try to automatically convert names to ID's, consult the json file for the exact name

12) NEVER put default values
- If something doesn't work, don't put a default value
- Default values don't indicate that something broke and will only make debugging harder and mess up calculations

13) Keep It Simple Stupid
- Don't put extensively complex debugging and functionality
- Makes it harder for users to read and to debug

Last updated: 2025-10-06