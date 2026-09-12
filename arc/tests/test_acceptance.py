import unittest

from acceptance import (
    failure_summaries,
    map_specs_to_nodes,
    spec_node_id,
    summarize_report,
)


class SpecIdTests(unittest.TestCase):
    def test_should_extract_leading_requirement_id(self):
        self.assertEqual(spec_node_id("REQ-1.spec.ts"), "REQ-1")
        self.assertEqual(spec_node_id("REQ-1.1-user-registration.spec.ts"), "REQ-1.1")
        self.assertEqual(spec_node_id("sub/REQ-12.3.4-x.spec.ts"), "REQ-12.3.4")
        self.assertIsNone(spec_node_id("support/e2e.ts"))
        self.assertIsNone(spec_node_id("smoke.spec.ts"))


class MappingTests(unittest.TestCase):
    def test_should_match_exact_ids(self):
        mapping, aliases = map_specs_to_nodes(["REQ-1.spec.ts", "REQ-2.spec.ts"], ["REQ-1", "REQ-2"])
        self.assertEqual(mapping, {"REQ-1": ["REQ-1.spec.ts"], "REQ-2": ["REQ-2.spec.ts"], None: []})
        self.assertEqual(aliases, {})

    def test_should_map_in_order_when_spec_ids_differ_but_counts_match(self):
        specs = ["REQ-1.1-user-registration.spec.ts", "REQ-1.2-user-login.spec.ts", "support/e2e.ts"]
        mapping, aliases = map_specs_to_nodes(specs, ["REQ-1", "REQ-2"])
        self.assertEqual(mapping["REQ-1"], ["REQ-1.1-user-registration.spec.ts"])
        self.assertEqual(mapping["REQ-2"], ["REQ-1.2-user-login.spec.ts"])
        self.assertEqual(aliases, {"REQ-1.1": "REQ-1", "REQ-1.2": "REQ-2"})

    def test_should_fall_back_to_parent_prefix_and_leave_rest_unassigned(self):
        specs = ["REQ-1.1-a.spec.ts", "REQ-1.2-b.spec.ts", "REQ-9.spec.ts"]
        mapping, aliases = map_specs_to_nodes(specs, ["REQ-1", "REQ-2"])
        self.assertEqual(mapping["REQ-1"], ["REQ-1.1-a.spec.ts", "REQ-1.2-b.spec.ts"])
        self.assertEqual(mapping["REQ-2"], [])
        self.assertEqual(mapping[None], ["REQ-9.spec.ts"])
        self.assertEqual(aliases, {"REQ-1.1": "REQ-1", "REQ-1.2": "REQ-1"})

    def test_should_sort_spec_ids_numerically_when_mapping_in_order(self):
        specs = ["REQ-1.10-x.spec.ts", "REQ-1.2-y.spec.ts"]
        mapping, _ = map_specs_to_nodes(specs, ["A", "B"])
        self.assertEqual(mapping["A"], ["REQ-1.2-y.spec.ts"])
        self.assertEqual(mapping["B"], ["REQ-1.10-x.spec.ts"])


def report(*tests):
    specs = []
    for title, status, error, steps, duration in tests:
        result = {"status": status, "duration": duration, "steps": [{"title": s, "category": "pw:api"} for s in steps]}
        if error:
            result["error"] = {"message": error, "location": {"file": "/w/tests/REQ-1.spec.ts", "line": 12}}
            result["errors"] = [result["error"]]
        specs.append({"title": title, "file": "REQ-1.spec.ts", "tests": [{"status": "expected" if status == "passed" else "unexpected", "results": [result]}]})
    return {"suites": [{"title": "REQ-1.spec.ts", "specs": specs}]}


class ReportTests(unittest.TestCase):
    def test_should_count_passed_and_collect_durations(self):
        summary = summarize_report(report(("a", "passed", None, [], 800), ("b", "failed", "boom", [], 10500)))
        self.assertEqual((summary.passed, summary.total), (1, 2))
        self.assertEqual([r.title for r in summary.results if not r.ok], ["b"])
        self.assertEqual(summary.slow(3000), ["b"])

    def test_should_treat_missing_report_as_zero_of_zero(self):
        summary = summarize_report({})
        self.assertEqual((summary.passed, summary.total), (0, 0))

    def test_should_build_four_field_summary_without_ansi_and_with_last_steps(self):
        msg = "\x1b[31mError: expect(locator).toHaveText(expected)\x1b[39m\n\nLocator: getByTestId('count')\nExpected string: \"2\"\nReceived string: \"1\""
        steps = ["page.goto(/)", "locator.click", "locator.click", "expect.toHaveText"]
        summary = summarize_report(report(("REQ-1: increments", "failed", msg, steps, 5000)))
        text = failure_summaries(summary, max_steps=3)
        self.assertIn("Feature: REQ-1: increments", text)
        self.assertIn("Failed at: REQ-1.spec.ts:12", text)
        self.assertIn("Observation: Error: expect(locator).toHaveText(expected)", text)
        self.assertNotIn("\x1b", text)
        self.assertIn("Steps: locator.click -> locator.click -> expect.toHaveText", text)

    def test_should_use_call_log_lines_when_no_step_trace(self):
        msg = "Error: page.goto: net::ERR_CONNECTION_REFUSED\nCall log:\n  - navigating to \"http://x/\", waiting until \"load\"\n\nmore"
        summary = summarize_report(report(("t", "failed", msg, [], 100)))
        self.assertIn('Steps: navigating to "http://x/", waiting until "load"', failure_summaries(summary))

    def test_should_mark_timeouts_as_performance_observations(self):
        summary = summarize_report(report(("slow one", "timedOut", "Test timeout of 10000ms exceeded.", ["page.reload"], 10000)))
        text = failure_summaries(summary)
        self.assertIn("timed out", text.lower())


if __name__ == "__main__":
    unittest.main()
