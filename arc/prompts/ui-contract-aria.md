Accessibility-name contracts (mandatory; graders locate controls by role plus exact accessible name):
- A backtick-quoted name in the requirements ("a button named `Take a note`") is the exact accessible name that control must expose. Render it literally -- <button>Take a note</button> or aria-label="Take a note" -- never a synonym, paraphrase or extra words.
- Every input needs an accessible name: <label for> or aria-label (a textbox named `Search` is <input type="search" aria-label="Search">, a form named `Login form` is <form aria-label="Login form">). Icon-only buttons need aria-label; named regions are role="region" aria-label (e.g. `Notes workspace`).
- Repeated items (notes, books, shelves...) are <article> elements, one per item, with per-item action buttons INSIDE the article. Keep the requirement's exact control name without appending the item title: "scoped to that note" means DOM containment inside the article, not a renamed button.
- Dialogs named in requirements open with role="dialog" (or <dialog>) and aria-label exactly as named; their textboxes/buttons reuse the quoted names.
- Toggle buttons (view switches) carry aria-pressed reflecting state; expand/collapse buttons carry aria-expanded.
- Status messages render the exact quoted text ("Note trashed") with role="status", alongside any named action button (`Undo`) while shown.
- "Exactly one" / "unique" means one such element in its scope.
- Seed data quoted in requirements (pinned note "Sprint goals") must exist as real records on first load.
