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
- Data grids (spreadsheets, tables): the gridcell's own text content is the
  displayed value. A permanently mounted `<input>` per cell fails every value
  assertion, because an input's value is not its text content -- render the
  committed value as the cell's text and swap in an editor only while the
  cell is being edited (click/typing focuses, Enter commits, the text
  returns). Row headers are rowheaders named exactly by their decimal number
  (`1`, `2`), column headers columnheaders named exactly by their letter
  (`A`, `B`) -- no "Row "/"Column " prefixes inside the accessible name. The
  selected cell(s) carry `aria-selected="true"` (the fresh-workbook default
  selection included), and a control nested inside a tab or grid cell must
  not leak into that tab/cell's own accessible name -- set an explicit
  aria-label on the container instead.
- Dialogs are real ARIA dialogs: an overlay named by the requirement
  ("Import CSV", "Sort range", ...) is `role="dialog"` with that exact
  accessible name, and it mounts/opens from the control the requirement
  names.
- Exactly one element per named control: never render a link AND a button
  with the same accessible name for one action (graders resolve by role plus
  name; an inert twin breaks them), and never ship a second, hidden input
  for a field that already has one (duplicate `Email` inputs make strict
  locators ambiguous). Every interactive element you render must actually
  perform its named action when activated.
{ports}
If a previous acceptance failure is shown to you below, fix exactly what it
reports — do not rewrite working code around it.

Finish by writing the files. Reply with one short sentence when done.
