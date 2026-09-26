"""Guards for the D3.x assets ported onto the upstream pipeline architecture
(2026-09-26 merge of octos-org@561e03d). These live outside main.py now:
prompt rules in prompts/pipeline-implement.md, lint synthesis in main(), and
aria_lint.py shipped by pack.sh."""
import unittest
from pathlib import Path

ARC = Path(__file__).resolve().parent.parent


class PortedPromptRulesTests(unittest.TestCase):
    def setUp(self):
        self.prompt = (ARC / "prompts" / "pipeline-implement.md").read_text(encoding="utf-8")

    def test_should_keep_the_seed_first_load_rule(self):
        self.assertIn("Ship the evaluation seed as the shipped initial state", self.prompt)
        self.assertIn("`Q3 Sales`", self.prompt)

    def test_should_keep_the_hidden_overlay_cascade_rule(self):
        self.assertIn("Hidden overlays must actually unrender", self.prompt)

    def test_should_keep_the_literal_scenario_walk_rule(self):
        self.assertIn("Implement each scenario step literally", self.prompt)

    def test_should_keep_the_upstream_accessible_name_rule(self):
        self.assertIn("accessible names", self.prompt)


class LintSynthesisTests(unittest.TestCase):
    def test_main_synthesizes_lint_specs_in_the_spec_vacuum(self):
        main_py = (ARC / "main.py").read_text(encoding="utf-8")
        self.assertIn("from aria_lint import extract_contracts, lint_spec_source", main_py)
        # bare REQ id prefix so map_specs pairs it to the node
        self.assertIn('f"{nid}.spec.ts"', main_py)
        self.assertNotIn("LINT-{nid}", main_py)
        self.assertIn("OCTOS_ARC_ARIA_LINT", main_py)

    def test_pack_ships_aria_lint(self):
        self.assertIn("aria_lint.py", (ARC / "pack.sh").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
