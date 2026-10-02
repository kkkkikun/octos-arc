Implement requirement {node_id} of this web application, then stop.

{description}

Public acceptance example (implement the FULL requirement, not just this case):
{spec}

Where the prose above and the acceptance example disagree, the prose is the
requirement: the example is a local proxy written from that text and can be
wrong. Satisfy the described behaviour first; when the example asserts
something the text does not, follow the text and treat the example's extra
assertion as the proxy's error, not a hidden demand.

You are editing an existing workspace. Write files with the write_file tool —
nothing you put in chat is saved, only tool calls change the app. When you
write a file, emit it in ONE single write_file call; never split one file
across calls. The
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
  earlier requirements. Never hardcode the values the acceptance example uses
  into BEHAVIOUR: seeds are data, not logic -- shipping the GIVEN values as
  the initial state is required, but every feature must still work for
  arbitrary values the example never shows.
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
  fields, JSON persistence). Use these primitives WHEN CREATING NEW UI: the
  requirements' grids, overlays, tabs and stores map onto the library with
  the exact labels and record names each requirement names. But an existing
  implementation that already passes its checks takes precedence -- never
  port working code to the library mid-run; that rewrites behaviour earlier
  requirements rely on.
- Ship the evaluation seed as the shipped initial state: the scenario GIVEN
  steps name records and values in backticks (the shapes vary per task --
  workbooks and cells, accounts and organizations, repositories and
  branches); those exact records -- taken from THIS document's GIVEN steps,
  never from memory or another task's examples -- must exist as PERSISTED
  data (a store file the app loads, never in-memory-only literals) and be
  visible on first load. Before finishing, re-read every GIVEN step's
  backticked value and confirm the shipped initial data contains it -- a
  greenfield app without its seeded users/records fails every scenario at
  step one.
- Conflicting worlds ship as separate workbooks: the doc's module families
  each describe "a workbook" with their own cell contents (one family's GIVEN
  wants A1 `Region`, another's `Item`, another's `2`), and the acceptance
  example opens the one it means (`Inventory`, `Calculations`). Seed YOUR
  requirement's records into the workbook the example opens -- never
  overwrite the cells of a workbook an earlier requirement seeded with
  different content. A new seeded workbook is cheap; a poisoned world is not.
- Every feature must work in ANY workbook, not only the shipped seeded
  ones: the graded tests provision their own worlds (blank workbooks the
  user creates, CSV-imported ones) and run the SAME flows there. Before
  finishing, exercise your feature once in a world you did NOT seed --
  formulas must recalc, sorting must order, pivots must aggregate, sheet
  operations must switch -- on data the acceptance example never named.
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
  active fails the scenario's very next assertion. When a check failure
  reads `tab ... aria-selected: Expected "true", Received "false"`, the
  defect is in the tab-rendering code path: the variable that decides which
  sheet is active is not updated by the add-sheet handler -- update it there
  and re-render, so the new tab's aria-selected attribute itself becomes
  "true".
- A check failure showing a `GET /... 404` for a script or stylesheet while
  the page still renders means the server's static mounts do not cover that
  route -- fix the server's file mapping, not the page's markup.
- When Playwright times out waiting for a control and the server log shows
  no matching request, the backend was not ready or the route never fired:
  check startup readiness and the handler wiring before touching markup.
- Permission failures about reviewers, authors or roles (a review is
  rejected, a control stays absent for the wrong role) mean the SEEDED
  ACCOUNTS must be independent -- the PR author is not the reviewer, the
  viewer is not an admin. Fix the seed's account structure; never loosen
  the permission check itself to make a test pass.
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
- After any sign-in, the signed-in username stays VISIBLE in the page
  header on every page (not only inside a closed account menu a test must
  open first); after registering a new account, the chosen username becomes
  visible the moment the session starts. A username the grader cannot see
  without clicking fails the scenario.
- The scenario text of THIS document is a literal contract: every backticked
  value in the GIVEN/WHEN/THEN steps is exact -- seed data ships verbatim
  (names, emails, passwords, titles), controls carry exactly the quoted
  accessible names, and success or error messages render exactly the quoted
  string, character for character. (The acceptance example below the
  description is a local transcription of these same steps; where it and the
  text ever disagree, the text wins.) Scenarios may build on state earlier
  scenarios created in the same suite: every change a scenario makes must
  genuinely persist, and flows must also work from a fresh session on the
  shipped seed.
- Navigation completeness: every entry point this requirement names (links,
  tabs, menu items, buttons) must exist on the page the requirement puts it
  on, be visible, and lead to a real route -- no dead entries.
- Seed data: provision every account, organization, team, repository and
  relationship the requirement's scenarios name, with the exact names,
  roles, ownership and visibility the requirement states. Every seeded
  account must be able to sign in with the stated credential.
- Reference shared assets with root-absolute paths ("/app.js",
  "/style.css"): the server rewrites nested routes (/workbook/<id>) to the
  same HTML document, so a relative "app.js" there resolves to
  /workbook/app.js and the browser receives a 404 page where JavaScript was
  expected -- every dynamic feature dies with a SyntaxError while the static
  shell still passes markup-only checks.
{ports}
If an acceptance failure is shown to you below, first check which
requirement it names: when it names YOUR requirement ({node_id} is not
repeated below — your node id is what the header of this prompt says), fix
exactly what it reports; when it names an EARLIER requirement whose repair
already gave up, implement your own requirement first and touch that earlier
code only if your own check fails because of it — do not rewrite working
code around either.

Finish by writing the files. Reply with one short sentence when done.
