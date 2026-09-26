"""ARIA lint (D3): extract accessible-name contracts from requirements and
generate a lint spec. Contracts come from the new-style requirements where
backtick-quoted names are the hidden tests' assertion targets."""

import unittest
from pathlib import Path

import yaml

from aria_lint import Contract, extract_contracts, lint_spec_source

TASKS = Path(__file__).resolve().parent.parent / "tasks"


def load_tree(task: str) -> dict:
    return yaml.safe_load((TASKS / task / "requirements.yaml").read_text(encoding="utf-8"))


def pairs(contracts: dict, node_id: str) -> set[tuple[str, str | None]]:
    return {(c.role, c.name) for c in contracts.get(node_id, [])}


class KeepExtractionTests(unittest.TestCase):
    """Real fixture: the official strict keep requirements (synced 2026-09-21)."""

    @classmethod
    def setUpClass(cls):
        cls.contracts = extract_contracts(load_tree("arc-bench-web--keep"))

    def test_should_extract_home_page_contracts(self):
        got = pairs(self.contracts, "REQ-1.1")
        self.assertIn(("region", "Notes workspace"), got)
        self.assertIn(("button", "Take a note"), got)
        self.assertIn(("textbox", "Search"), got)

    def test_should_extract_section_headings_and_article_existence(self):
        got = pairs(self.contracts, "REQ-2.1")
        # "a named region or heading `Pinned`" -- the requirement accepts either
        # role; the extractor takes the first listed.
        self.assertTrue(("region", "Pinned") in got or ("heading", "Pinned") in got)
        self.assertTrue(("region", "Others") in got or ("heading", "Others") in got)
        self.assertIn(("article", None), got)

    def test_should_skip_render_on_open_editor_fields(self):
        # "Activating it opens ... dialog named `Note editor` containing uniquely
        # labelled textboxes `Title` and `Note content`" -> dynamic sentence.
        got = pairs(self.contracts, "REQ-2.2")
        self.assertNotIn(("dialog", "Note editor"), got)
        self.assertNotIn(("textbox", "Title"), got)
        self.assertNotIn(("textbox", "Note content"), got)

    def test_should_keep_static_per_item_button_but_skip_dropdown_action(self):
        got = pairs(self.contracts, "REQ-2.3.1")
        self.assertIn(("button", "More options"), got)      # "an article containing a button named `More options`."
        self.assertNotIn(("button", "Delete Note"), got)    # "activating it exposes a button named `Delete Note`"
        self.assertNotIn(("button", "Undo"), got)           # toast button, dynamic
        self.assertIn(("article", None), got)               # "Each note is an article"

    def test_should_extract_sidebar_toggle(self):
        # REQ-6.2 collapse: a `Toggle sidebar` button (official spec clicks it).
        all_names = {(c.role, c.name) for cs in self.contracts.values() for c in cs}
        self.assertIn(("button", "Toggle sidebar"), all_names)


class BookstackExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contracts = extract_contracts(load_tree("arc-bench-web--bookstack"))

    def test_should_extract_login_page_contracts(self):
        got = pairs(self.contracts, "REQ-2.1")
        self.assertIn(("heading", "Login"), got)
        self.assertIn(("form", "Login form"), got)

    def test_should_extract_static_login_form_fields(self):
        # "...enters ... in the uniquely labelled email textbox `Email address`
        # ... password textbox `Password`, checks the checkbox named `Remember Me`"
        # -- interactions on a statically rendered form: keep them.
        got = pairs(self.contracts, "REQ-2.2")
        self.assertIn(("textbox", "Email address"), got)
        self.assertIn(("textbox", "Password"), got)
        self.assertIn(("checkbox", "Remember Me"), got)


class GatingTests(unittest.TestCase):
    def test_should_flag_sentence_as_dynamic_only_with_both_verb_classes(self):
        from aria_lint import sentence_is_dynamic
        self.assertTrue(sentence_is_dynamic("activating it exposes a button named `Delete Note`."))
        self.assertTrue(sentence_is_dynamic("Activating the note article opens a dialog named `Note editor`."))
        self.assertFalse(sentence_is_dynamic("The page exposes a visible region named `Notes workspace`."))
        self.assertFalse(sentence_is_dynamic("The user enters `a@b.c` in the textbox `Email address` and activates `Login`."))
        self.assertFalse(sentence_is_dynamic("Each note is an article containing a button named `More options`."))


class SpecSourceTests(unittest.TestCase):
    def test_should_probe_every_route_with_hidden_included(self):
        src = lint_spec_source([Contract(role="button", name="Take a note", node_id="REQ-1.1")],
                               routes=["/", "/login"])
        self.assertIn("getByRole('button', { name: /^Take a note$/i, includeHidden: true })", src)
        self.assertIn('"/"', src)
        self.assertIn('"/login"', src)

    def test_should_escape_regex_metacharacters_in_names(self):
        src = lint_spec_source([Contract(role="heading", name="Books (2026) + More", node_id="R")], routes=["/"])
        self.assertNotIn("name: /^Books (2026) + More$/i", src)
        self.assertIn(r"Books \(2026\) \+ More", src)

    def test_should_render_article_existence_contract(self):
        src = lint_spec_source([Contract(role="article", name=None, node_id="R")], routes=["/"])
        self.assertIn("getByRole('article'", src)
        # the article probe itself stays nameless (existence-only) -- the
        # creation-flow helper may carry its own name regexes
        self.assertIn("p.getByRole('article').count()", src)

    def test_should_render_dialog_trigger_probe(self):
        src = lint_spec_source(
            [Contract(role="dialog", name="Sort range", node_id="R",
                      triggers=("Data", "Sort range"))], routes=["/"])
        self.assertIn("dialogReachable", src)
        self.assertIn("/^Data$/i", src)
        self.assertIn("/^Sort range$/i", src)
        # dialogs may be mounted hidden until opened -- the probe counts the
        # wiring first and only walks the trigger chain when it must
        self.assertIn("includeHidden: hidden", src)

    def test_should_render_header_name_form_probe(self):
        src = lint_spec_source(
            [Contract(role="rowheader", name=None, node_id="R", name_form="digit")],
            routes=["/"])
        self.assertIn("getByRole('rowheader', { name: /^\\d+$/", src)

    def test_should_render_selection_probe(self):
        src = lint_spec_source(
            [Contract(role="gridcell", name="A1", node_id="R", selected=True)],
            routes=["/"])
        self.assertIn("aria-selected", src)
        self.assertIn("'true'", src)


class RealCompetitionExtractionTests(unittest.TestCase):
    """Real fixtures: the two formal-race tasks (2026-09-25 revision synced
    from public-exercise/real-new). The github requirements quote accessible
    names with typographic double quotes; the sheet revision switched its
    description text to straight double quotes -- extraction must normalize
    both dialects and still find the contracts."""

    @classmethod
    def setUpClass(cls):
        cls.sheet = extract_contracts(load_tree("hackathon--sheet"))
        cls.github = extract_contracts(load_tree("hackathon--github"))

    def test_should_extract_sheet_name_role_contracts(self):
        found = {(c.role, c.name) for cs in self.sheet.values() for c in cs}
        # straight-quote dialect descriptions ("New blank workbook")
        self.assertIn(("button", "New blank workbook"), found)
        self.assertIn(("button", "Import CSV"), found)
        self.assertIn(("textbox", "Allowed values"), found)

    def test_should_inherit_folder_contracts_to_atomic_descendants(self):
        # REQ-1's FOLDER text defines the grid contract ("uses the ARIA grid
        # role, has the accessible name `Worksheet grid`"); every REQ-1
        # atomic check must assert it. The 2026-09-26 sheet run shipped a
        # grid with no accessible name because this sentence never reached a
        # check node -- 27/28 behavioral proxy tests died at their first
        # locator.
        for nid in ("REQ-1-1-1", "REQ-1-2-1", "REQ-1-2-2", "REQ-1-3-1", "REQ-1-3-2"):
            pairs = {(c.role, c.name) for c in self.sheet.get(nid, [])}
            self.assertIn(("grid", "Worksheet grid"), pairs, nid)

    def test_should_skip_placeholder_templated_names(self):
        found = {(c.role, c.name) for cs in self.sheet.values() for c in cs}
        # "Worksheet options for <worksheet name>" names a per-instance
        # control; a literal lint on it can never pass and burns the repair
        # window on an unfixable assertion.
        self.assertNotIn(("button", "Worksheet options for <worksheet name>"), found)

    def test_should_not_regress_exercise_folder_harvest(self):
        # keep/bookstack folders carry no harvestable contracts; their
        # extraction totals must stay exactly where they were.
        keep = extract_contracts(load_tree("arc-bench-web--keep"))
        bookstack = extract_contracts(load_tree("arc-bench-web--bookstack"))
        self.assertEqual((len(keep), sum(len(v) for v in keep.values())), (16, 23))
        self.assertEqual((len(bookstack), sum(len(v) for v in bookstack.values())), (21, 33))

    def test_should_render_creation_flow_probe(self):
        # Bare-route probes cannot reach editor pages behind creation flows
        # ("/workbook" without an id shows "Workbook not found" on the real
        # generated app); the spec must fall back to walking the flow.
        src = lint_spec_source([Contract(role="grid", name="Worksheet grid", node_id="R")], routes=["/"])
        self.assertIn("countViaCreationFlow", src)
        self.assertIn("return await countViaCreationFlow(page, probe);", src)

    def test_should_extract_example_pinned_dynamic_names(self):
        # P6: "(for example, A1)" pins the literal for per-item dynamic
        # naming -- the single most-located cell in the behavioral nets.
        for nid in ("REQ-1-1-1", "REQ-1-2-1", "REQ-1-3-2"):
            pairs = {(c.role, c.name) for c in self.sheet.get(nid, [])}
            self.assertIn(("gridcell", "A1"), pairs, nid)

    def test_should_bind_declared_noun_names(self):
        # P7: the folder declares "Worksheet tabs ... use the ARIA tab role";
        # REQ-1-2-1 binds "a blank worksheet named Sheet1" (unquoted seed
        # identifier). The 2026-09-26 arch-1 app shipped tabs whose accessible
        # name was polluted by a nested menu button -- exact-name locators
        # failed on every worksheet test.
        pairs = {(c.role, c.name) for c in self.sheet.get("REQ-1-2-1", [])}
        self.assertIn(("tab", "Sheet1"), pairs)

    def test_should_revive_dialog_contracts(self):
        # P9: the app must render real ARIA dialogs. Static definitional
        # sentences ("A dialog named `Import CSV` provides ...") and named-
        # trigger sentences ("The `Rename` menu item opens a dialog named
        # `Rename worksheet`") both harvest; the 2026-09-26 arch-1 artifact
        # shipped zero role=dialog markup and every dialog-driven behavioral
        # test timed out.
        self.assertIn(("dialog", "Import CSV"), pairs(self.sheet, "REQ-1-3-1"))
        self.assertIn(("dialog", "Rename worksheet"), pairs(self.sheet, "REQ-2-1-3"))
        self.assertIn(("dialog", "Delete worksheet"), pairs(self.sheet, "REQ-2-1-4"))
        found = {(c.role, c.name) for cs in self.sheet.values() for c in cs}
        self.assertIn(("dialog", "Sort range"), found)
        self.assertIn(("dialog", "Data validation"), found)
        self.assertIn(("dialog", "Create pivot table"), found)

    def test_should_keep_pronoun_triggered_dialogs_skipped(self):
        # keep's editor dialog opens from "Activating it" -- no named trigger,
        # and the sentence is dynamic: a bare-route lint could never reach it.
        # The dialog revival must not regress that skip (keep 16/23 pin).
        got = pairs(self.contracts_of("arc-bench-web--keep"), "REQ-2.2")
        self.assertNotIn(("dialog", "Note editor"), got)

    def test_should_extract_header_name_forms(self):
        # P8: "Row numbers use the ARIA rowheader role with the decimal row
        # number as the accessible name; column headers ... column letter".
        # The arch-1 app labelled its row th "Row 1" -- exact '1' locators die.
        found = {(c.role, c.name_form) for cs in self.sheet.values() for c in cs}
        self.assertIn(("rowheader", "digit"), found)
        self.assertIn(("columnheader", "letter"), found)

    def test_should_extract_selection_state_contract(self):
        # "with Sheet1 active and A1 selected" (REQ-1-2-1) + the REQ-1 FOLDER
        # "active tab indicated by aria-selected=\"true\"": the fresh workbook
        # must expose the selection, not just the geometry.
        sel = {(c.role, c.name) for cs in self.sheet.values() for c in cs if c.selected}
        self.assertIn(("gridcell", "A1"), sel)
        self.assertIn(("tab", "Sheet1"), sel)

    def contracts_of(self, task: str) -> dict:
        return extract_contracts(load_tree(task))

    def test_should_extract_github_named_controls(self):
        found = {(c.role, c.name) for cs in self.github.values() for c in cs}
        self.assertIn(("button", "Create account"), found)      # P1
        self.assertIn(("link", "Create an account"), found)     # P1
        self.assertIn(("checkbox", "Agree to the terms"), found)  # P1
        self.assertIn(("link", "Sign in"), found)               # P4

    def test_should_cover_a_meaningful_share_of_atomic_nodes(self):
        # 24 (sheet) / 47 (github) ATOMIC nodes; a near-empty map means the
        # delimiter style drifted again and lint went silently dark.
        self.assertGreaterEqual(len(self.sheet), 8)
        self.assertGreaterEqual(len(self.github), 19)

    def test_should_normalize_only_unambiguous_quote_pieces(self):
        # curly wins; straight quotes carry names only in pieces with no
        # backticks; pieces that already use backticks stay authoritative.
        from aria_lint import _normalize_quotes
        self.assertEqual(_normalize_quotes('a “X” b'), 'a `X` b')
        self.assertEqual(_normalize_quotes('a "X" b'), 'a `X` b')
        self.assertEqual(_normalize_quotes('a `X` and "Y" b'), 'a `X` and "Y" b')


if __name__ == "__main__":
    unittest.main()
