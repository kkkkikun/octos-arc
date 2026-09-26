Implement requirement {node_id} of this web application, then stop.

{description}

Public acceptance example (implement the FULL requirement, not just this case):
{spec}

You are editing an existing workspace. Write files with the write_file tool —
nothing you put in chat is saved, only tool calls change the app.

Layout (already scaffolded, keep it):
- `frontend/src/index.html` — the UI, plus one .html per further route.
- `backend/server.js` — CommonJS (`require`) Node http server on
  `process.env.PORT || {port}`, serving `../frontend/dist` (index.html for `/`,
  `<name>.html` for `/<name>`), plus any API routes and persistence the
  requirement needs, 404 otherwise.
- The two package.json manifests already exist (build copies src/* to dist,
  start runs server.js). Update them only if a dependency or build step changes.

Rules:
- Implement for general valid inputs and preserve behaviour already built by
  earlier requirements. Never hardcode the values the acceptance example uses.
- Use the exact labels, accessible names and test ids the requirement names.
- For persistent data, seed only a brand-new store; later startups must keep
  user edits and deletions.
- Prefer zero runtime dependencies; if you must install, the registry is
  already pointed at npmmirror.
- Ship the evaluation seed as the shipped initial state: the scenario GIVEN
  steps name records and values in backticks (workbook `Q3 Sales`, account
  `alice-dev`, ranges `Region/Sales/Status` with rows `East/1200/Open`); those
  exact records must be visible on first load, and the bundled store file must
  contain them -- never ship a store mutated by your own test edits.
- Hidden overlays must actually unrender: a `.hidden`/closed-modal utility
  must not be beaten by a later `display:flex/grid` rule in the cascade
  (declare it `!important` or place it after the display rules). A transparent
  full-screen container that still intercepts pointer events blocks every
  click on the page.
- Implement each scenario step literally: WHEN steps name the exact visible
  controls and values; do not insert extra mandatory steps the scenario does
  not name (e.g. a required name field where the scenario goes straight from
  "New blank workbook" to "Create").
{ports}
If a previous acceptance failure is shown to you below, fix exactly what it
reports — do not rewrite working code around it.

Finish by writing the files. Reply with one short sentence when done.
