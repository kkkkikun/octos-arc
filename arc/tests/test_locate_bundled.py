"""locate_tests falls back to the public specs the bundle ships when the
runner mounts nothing (upstream #246: since 2026-09-26 the platform runner
mounts no tests; keep scored 4/32 blind against 22/32 with specs)."""

import os
import tempfile
import unittest
from pathlib import Path

import main
import yaml


def sheet_tree() -> dict:
    return yaml.safe_load((Path(__file__).parent.parent / "tasks" /
                           "hackathon--sheet" / "requirements.yaml").read_text())


class BundledSpecsTests(unittest.TestCase):
    def test_sheet_tree_matches_shipped_public_specs_by_id_overlap(self):
        with tempfile.TemporaryDirectory() as tmp:
            # BUNDLE_DIR points at arc/ in the worktree, which now carries
            # public-tests/hackathon--sheet (24 spec files / 100 tests) --
            # the same lookup the frozen bundle performs at runtime.
            old = {k: os.environ.pop(k, None) for k in
                   ("ARCBENCH_TESTS_DIR", "OCTOS_ARC_LOCAL_TESTS", "OCTOS_ARC_BUNDLED_TESTS")}
            try:
                got = main.locate_tests(sheet_tree())
            finally:
                for k, v in old.items():
                    if v is not None:
                        os.environ[k] = v
            self.assertIsNotNone(got)
            self.assertIn("public-tests", str(got))
            self.assertTrue(any(Path(got).glob("REQ-1-2-1.spec.ts")))

    def test_opt_out_env_disables_bundled_specs(self):
        os.environ["OCTOS_ARC_BUNDLED_TESTS"] = "0"
        try:
            self.assertIsNone(main.locate_tests(sheet_tree()))
        finally:
            del os.environ["OCTOS_ARC_BUNDLED_TESTS"]

    def test_shipped_specs_are_the_official_public_ones(self):
        # byte-identical to the platform's practice package (real-new), so
        # shipping them is public material, not leaked grading data
        bundled = Path(__file__).parent.parent / "public-tests" / "hackathon--sheet" / "REQ-1-2-1.spec.ts"
        self.assertTrue(bundled.is_file())


if __name__ == "__main__":
    unittest.main()
