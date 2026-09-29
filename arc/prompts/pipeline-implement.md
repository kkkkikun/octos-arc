Implement requirement {node_id} of this web application, then stop.

{description}

Public acceptance example (implement the FULL requirement, not just this case):
{spec}

You are editing an existing workspace. Write files with the write_file tool —
nothing you put in chat is saved, only tool calls change the app. The
contract is behavioural: every requirement that already passed its check
must keep passing after your change. For a file the inventory lists at more
than 500 lines, a wholesale rewrite has historically destroyed that
behaviour -- read the part you need and make a targeted edit instead, unless
the requirement itself demands restructuring, in which case re-verify the
earlier behaviour yourself before finishing.

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
- Write only the app's own files under frontend/ and backend/. No reports,
  notes, summaries or other .md files: nobody reads them and they cost output.
- Prefer zero runtime dependencies; if you must install, the registry is
  already pointed at npmmirror.
- The workspace ships a generic, task-agnostic component library under
  `frontend/src/lib/` (an accessible data grid with cell-text editing and
  document-level keyboard clipboard/undo, ARIA dialogs, tabsets, labeled
  fields, JSON persistence). Build on these primitives instead of
  hand-rolling them: the requirements' grids, overlays, tabs and stores map
  onto the library with the exact labels and record names each requirement
  names. Extending the library is fine; replacing it with ad-hoc markup
  re-introduces the accessibility failures the checks fail.
- Ship the evaluation seed as the shipped initial state: the scenario GIVEN
  steps name records and values in backticks (workbook `Q3 Sales`, account
  `alice-dev`, org `acme-corp`, ranges `Region/Sales/Status` with rows
  `East/1200/Open`); those exact records must exist as PERSISTED data (a store
  file the app loads, never in-memory-only literals) and be visible on first
  load. Before finishing, re-read every GIVEN step's backticked value and
  confirm the shipped initial data contains it -- a greenfield app without
  its seeded users/records fails every scenario at step one.
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
- Grid commands must work from the KEYBOARD, at the document level, whether
  or not a menu also offers them: Ctrl+C copies the selected range into the
  app's own buffer (a page cannot read the system clipboard), Ctrl+V pastes
  it at the current anchor cell, Ctrl+X moves it, Ctrl+Z/Ctrl+Y undo and
  redo. Handle keydown on the document -- never assume focus sits inside an
  input -- and act on the grid's current selection.
- Adding a worksheet makes it the ACTIVE sheet the moment it is created: its
  tab carries `aria-selected="true"`, the grid switches to its (empty) cells
  with A1 selected -- appending an inert tab while the old sheet stays
  active fails the scenario's very next assertion.
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
- Reference shared assets with root-absolute paths ("/app.js",
  "/style.css"): the server rewrites nested routes (/workbook/<id>) to the
  same HTML document, so a relative "app.js" there resolves to
  /workbook/app.js and the browser receives a 404 page where JavaScript was
  expected -- every dynamic feature dies with a SyntaxError while the static
  shell still passes markup-only checks.
{ports}
If a previous acceptance failure is shown to you below, fix exactly what it
reports — do not rewrite working code around it.

Finish by writing the files. Reply with one short sentence when done.
