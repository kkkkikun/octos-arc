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
        self.assertNotIn("name: /", src)


if __name__ == "__main__":
    unittest.main()
