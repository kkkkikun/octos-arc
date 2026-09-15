import unittest

from main import OctosDriver, describe_node, folder_descendants, inline_sources, inline_spec_text, unchanged_node_ids
import main as m


def node(node_id, description, deps=()):
    return {"id": node_id, "type": "ATOMIC", "name": node_id, "description": description,
            "dependencies": list(deps), "scenarios": [{"name": "s", "steps": [{"keyword": "GIVEN", "content": "x"}]}]}


class EvolutionDiffTests(unittest.TestCase):
    def test_should_keep_nodes_whose_content_matches_previous_requirement_table(self):
        current = [node("REQ-1", "same"), node("REQ-2", "changed"), node("REQ-3", "new", ["REQ-1"])]
        previous = {
            "REQ-1": {"req_id": "REQ-1", "id": "REQ-1", "name": "REQ-1", "description": "same", "dependencies": [],
                      "scenarios": [{"name": "s", "steps": [{"keyword": "GIVEN", "content": "x"}]}]},
            "REQ-2": {"req_id": "REQ-2", "id": "REQ-2", "name": "REQ-2", "description": "old", "dependencies": [],
                      "scenarios": [{"name": "s", "steps": [{"keyword": "GIVEN", "content": "x"}]}]},
        }
        self.assertEqual(unchanged_node_ids(current, previous), {"REQ-1"})

    def test_should_treat_everything_as_changed_without_previous_table(self):
        self.assertEqual(unchanged_node_ids([node("REQ-1", "a")], {}), set())


class DescribeNodeTests(unittest.TestCase):
    def test_should_render_scenarios_and_dependencies(self):
        text = describe_node(node("REQ-2", "desc", ["REQ-1"]))
        self.assertIn("ID: REQ-2", text)
        self.assertIn("GIVEN x", text)
        self.assertIn("Depends on: REQ-1", text)


if __name__ == "__main__":
    unittest.main()


class TransientTests(unittest.TestCase):
    def test_should_not_retry_own_turn_timeouts(self):
        self.assertFalse(OctosDriver._transient("octos turn timed out"))
        self.assertFalse(OctosDriver._transient("octos timed out after 900s"))

    def test_should_not_retry_account_errors_or_numbers_in_request_ids(self):
        for text in (
            'HTTP 402 insufficient_balance request id 503429401',
            'HTTP 401 authentication failed',
            'HTTP 403 forbidden: request timed out',
            'provider quota exhausted rate limit',
            'bad input request id 502',
        ):
            self.assertFalse(OctosDriver._transient(text), text)

    def test_should_abort_flow_before_falling_back_to_another_generation(self):
        import argparse
        from pathlib import Path
        from types import SimpleNamespace
        flow = m.Flow(argparse.Namespace(web_port=3000), Path("."), Path("."))
        flow.driver = SimpleNamespace(run=lambda *args: (False, "HTTP 402 insufficient_balance"))
        with self.assertRaises(m.PermanentProviderError):
            flow.turn("implement", 60, "node implement")

    def test_should_retry_provider_errors(self):
        self.assertTrue(OctosDriver._transient("HTTP 503 Service Temporarily Unavailable"))
        self.assertTrue(OctosDriver._transient("failed to send streaming request"))


class FolderDescendantTests(unittest.TestCase):
    def test_should_map_every_folder_to_its_atomic_leaves(self):
        tree = {"id": "ROOT", "type": "FOLDER", "children": [
            {"id": "F-1", "type": "FOLDER", "children": [node("REQ-1", "a"), node("REQ-2", "b")]},
            node("REQ-3", "c")]}
        self.assertEqual(folder_descendants(tree), {"F-1": ["REQ-1", "REQ-2"], "ROOT": ["REQ-1", "REQ-2", "REQ-3"]})


class SetupPlaywrightTests(unittest.TestCase):
    """Regression for cloud run d116ad5e3aa0: the private-install branch of
    setup_playwright must unpack (root, env_extra) and expose cleanup."""

    def test_should_use_private_install_tuple_and_clean_it_up(self):
        import argparse, tempfile
        from pathlib import Path
        import main as m
        with tempfile.TemporaryDirectory() as tmp:
            tests = Path(tmp) / "tests"; tests.mkdir(); (tests / "REQ-1.spec.ts").write_text("x")
            fake_root = Path(tmp) / "pw"; (fake_root / "node_modules" / "@playwright" / "test").mkdir(parents=True)
            flow = m.Flow(argparse.Namespace(web_port=3000), Path(tmp) / "out", Path(tmp) / "req")
            flow.tests_dir = tests
            calls = {}
            def fake_ensure(install_root, log, timeout=540, version="1.63.0"):
                calls["version"] = version
                return fake_root, {"PLAYWRIGHT_BROWSERS_PATH": str(install_root / "browsers")}
            saved = (m.find_playwright_root, m.find_playwright_by_search, m.ensure_playwright)
            m.find_playwright_root = lambda cands: fake_root if cands == [fake_root] else None
            m.find_playwright_by_search = lambda log: None
            m.ensure_playwright = fake_ensure
            try:
                flow.setup_playwright()
            finally:
                m.find_playwright_root, m.find_playwright_by_search, m.ensure_playwright = saved
            self.assertEqual(calls["version"], "1.63.0")
            self.assertIsNotNone(flow.runner)
            self.assertEqual(flow.runner.root, fake_root)
            self.assertIn("PLAYWRIGHT_BROWSERS_PATH", flow.runner.env_extra)
            private = flow.private_playwright
            self.assertTrue(private.exists())
            flow.cleanup_playwright()
            self.assertFalse(private.exists())


class InlineSpecTests(unittest.TestCase):
    def test_should_quote_files_within_budget_and_bail_when_too_big(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            tests = Path(tmp); (tests / "support").mkdir()
            (tests / "REQ-1.spec.ts").write_text("spec body"); (tests / "support" / "e2e.ts").write_text("helper")
            text = inline_spec_text(tests, ["REQ-1.spec.ts", "support/e2e.ts"], 1000)
            self.assertIn("--- REQ-1.spec.ts ---\nspec body", text)
            self.assertIn("--- support/e2e.ts ---\nhelper", text)
            self.assertEqual(inline_spec_text(tests, ["REQ-1.spec.ts", "support/e2e.ts"], 10), "")


class InlineSourcesTests(unittest.TestCase):
    def test_should_quote_small_files_and_omit_those_over_budget(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "backend").mkdir(); (root / "frontend" / "src").mkdir(parents=True)
            (root / "backend" / "server.js").write_text("x" * 100); (root / "frontend" / "src" / "index.html").write_text("<p>hi</p>")
            (root / "frontend" / "node_modules").mkdir(); (root / "frontend" / "node_modules" / "a.js").write_text("no")
            text = inline_sources(root, max_chars=50)
            self.assertIn("--- frontend/src/index.html ---\n<p>hi</p>", text)
            self.assertIn("backend/server.js --- (omitted, 100 chars", text)
            self.assertNotIn("node_modules", text)


class FailureNormalizationTests(unittest.TestCase):
    def test_should_treat_digests_differing_only_in_numbers_as_identical(self):
        import re
        a = "Observation: TIMED OUT after 4136 ms ... Expected: \"2\" Received: \"\""
        b = "Observation: TIMED OUT after 4144 ms ... Expected: \"2\" Received: \"\""
        self.assertEqual(re.sub(r"\d+", "#", a), re.sub(r"\d+", "#", b))


class CodegenPromptTests(unittest.TestCase):
    def test_should_format_without_placeholder_errors_and_keep_build_command(self):
        import main as m
        text = m.CODEGEN_PROMPT.format(node_id="REQ-1", description="S", spec="T", port=3000, ports=" P", size_rule="R")
        self.assertIn("update manifests when required", text)
        self.assertIn("REQ-1", text)


class AlreadyPassingProbeTests(unittest.TestCase):
    def test_should_mark_only_fully_passing_nodes_as_unchanged(self):
        import argparse
        from pathlib import Path
        from types import SimpleNamespace
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        flow.spec_map = {"REQ-1": ["a.spec.ts"], "REQ-2": ["b.spec.ts"], "REQ-3": [], None: []}
        results = {"a.spec.ts": SimpleNamespace(error=None, total=2, passed=2, all_passed=True),
                   "b.spec.ts": SimpleNamespace(error=None, total=2, passed=1, all_passed=False)}
        flow.run_specs = lambda specs, **kw: results[specs[0]]
        self.assertEqual(flow.already_passing_nodes(["REQ-1", "REQ-2", "REQ-3"]), {"REQ-1"})


class CodegenManifestTests(unittest.TestCase):
    def test_should_write_missing_manifests_once(self):
        import json, tempfile
        from pathlib import Path
        root = Path(tempfile.mkdtemp())
        self.assertEqual(m.write_codegen_manifests(root), ["frontend/package.json", "backend/package.json"])
        self.assertEqual(m.write_codegen_manifests(root), [])
        fe = json.loads((root / "frontend/package.json").read_text())
        # the build preserves HTML filenames without creating route aliases
        import shutil, subprocess
        node = shutil.which("node") or "/opt/homebrew/opt/node@24/bin/node"
        (root / "frontend/src").mkdir(parents=True)
        (root / "frontend/src/index.html").write_text("i"); (root / "frontend/src/register.html").write_text("r")
        cmd = fe["scripts"]["build"][len("node -e "):].strip('"').replace('\\"', '"')
        subprocess.run([node, "-e", cmd], cwd=root / "frontend", check=True)
        self.assertFalse((root / "frontend/dist/register").exists())
        self.assertTrue((root / "frontend/dist/register.html").is_file())
        self.assertFalse((root / "frontend/dist/index").exists())
        be = json.loads((root / "backend/package.json").read_text())
        self.assertEqual(be["scripts"]["start"], "node server.js")
        self.assertEqual(be["type"], "commonjs")


class ExtraPortsBoundTests(unittest.TestCase):
    def test_should_report_unbound_spec_ports_in_grader_like_mode(self):
        import tempfile
        from pathlib import Path
        from acceptance import AppServer
        srv = AppServer(Path(tempfile.mkdtemp()), 3100, lambda s: None, grader_like=True, extra_ports=[3301])
        srv.port = 3100
        err = srv.extra_ports_bound(wait_seconds=0.3)
        self.assertIn("3301", err)
        self.assertIn("ERR_CONNECTION_REFUSED", err)
        srv.extra_ports = []
        self.assertIsNone(srv.extra_ports_bound(wait_seconds=0.1))


class SnapshotSourcesTests(unittest.TestCase):
    def test_should_copy_sources_but_not_node_modules(self):
        import argparse, tempfile
        from pathlib import Path
        root = Path(tempfile.mkdtemp())
        (root / "frontend/src").mkdir(parents=True); (root / "backend/node_modules/x").mkdir(parents=True)
        (root / "frontend/src/index.html").write_text("<p>")
        (root / "backend/server.js").write_text("x")
        (root / "backend/node_modules/x/i.js").write_text("y")
        flow = m.Flow(argparse.Namespace(web_port=1), root, root)
        dest = flow.snapshot_sources("REQ-1", 0)
        self.assertTrue((dest / "frontend/src/index.html").is_file())
        self.assertTrue((dest / "backend/server.js").is_file())
        self.assertFalse((dest / "backend/node_modules").exists())


class DiscardTemplateTests(unittest.TestCase):
    def test_should_move_app_dirs_aside_and_clear_has_app(self):
        import argparse, tempfile
        from pathlib import Path
        root = Path(tempfile.mkdtemp())
        (root / "frontend").mkdir(); (root / "backend").mkdir()
        (root / "frontend/package.json").write_text("{}"); (root / "backend/package.json").write_text("{}")
        flow = m.Flow(argparse.Namespace(web_port=1), root, root)
        self.assertTrue(flow.has_app())
        dest = flow.discard_template()
        self.assertFalse(flow.has_app())
        self.assertTrue((dest / "frontend/package.json").is_file())
        self.assertTrue((dest / "backend/package.json").is_file())


class CodegenReasoningTests(unittest.TestCase):
    def test_should_drop_reasoning_for_small_specs_only(self):
        import argparse, os
        from pathlib import Path
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        self.assertEqual(flow.codegen_reasoning(1200), "none")
        self.assertIsNone(flow.codegen_reasoning(14000))
        self.assertIsNone(flow.codegen_reasoning(0))
        os.environ["OCTOS_ARC_REASONING"] = "low"
        try:
            self.assertIsNone(flow.codegen_reasoning(1200))
        finally:
            del os.environ["OCTOS_ARC_REASONING"]


class DryRunDriverTests(unittest.TestCase):
    def test_should_return_parseable_file_blocks_for_codegen_prompts(self):
        from codegen import parse_file_blocks
        d = m.DryRunDriver()
        ok, text = d.run("Requirement ...\n<<<FILE relative/path>>>\ncontents\n<<<END FILE>>>", 10)
        self.assertTrue(ok)
        files = parse_file_blocks(text)
        self.assertEqual(sorted(files), ["backend/server.js", "frontend/src/index.html"])
        ok, text = d.run("Implement the node with tools.", 10)
        self.assertTrue(ok); self.assertIn("dry run", text)
        self.assertEqual(d.turns, 2)


class TinyTierTests(unittest.TestCase):
    def test_should_compact_spec_to_its_statements(self):
        spec = """import { test, expect } from '@playwright/test';

test('REQ-1: roll a dice', async ({ page }) => {
  await page.goto('/');
  const roll = page.getByRole('button', { name: 'Roll' });
  await expect(roll).toBeVisible();
});
"""
        out = m.compact_spec_lines(spec)
        self.assertEqual(out.splitlines()[0], "test: REQ-1: roll a dice")
        self.assertIn("page.goto('/');", out)
        self.assertNotIn("await", out); self.assertNotIn("import", out); self.assertNotIn("});", out.splitlines())

    def test_should_gate_tiny_mode_by_spec_size(self):
        import argparse, os
        from pathlib import Path
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        self.assertTrue(flow.tiny_mode(600)); self.assertFalse(flow.tiny_mode(1500)); self.assertFalse(flow.tiny_mode(0))
        os.environ["OCTOS_ARC_TINY"] = "0"
        try:
            self.assertFalse(flow.tiny_mode(600))
        finally:
            del os.environ["OCTOS_ARC_TINY"]

    def test_should_pass_unabridged_requirements_and_spec_to_tiny_generation(self):
        import argparse
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            flow = m.Flow(argparse.Namespace(web_port=3000), root, root)
            flow.tests_dir = root
            flow.runner = object()
            spec = "test('example', async () => {\n  await check();\n});"
            flow.spec_bodies = lambda _: spec
            captured = []
            flow.codegen_turn = lambda prompt, *args, **kwargs: (captured.append(prompt) or False, "")
            flow.tiny_turn("item", ["example.spec.ts"], 20, {"description": "Allow arbitrary search terms and style the result list"})
            self.assertIn("Allow arbitrary search terms", captured[0])
            self.assertIn(spec, captured[0])

    def test_tiny_server_should_format_and_parse(self):
        import shutil, subprocess, tempfile
        from pathlib import Path
        js = m.TINY_SERVER_JS.format(port=3000, extra_ports="[3301]")
        self.assertIn("listen(process.env.PORT || 3000)", js); self.assertIn("[3301]", js)
        node = shutil.which("node")
        if node:
            p = Path(tempfile.mkdtemp()) / "server.js"; p.write_text(js)
            self.assertEqual(subprocess.run([node, "--check", str(p)], capture_output=True).returncode, 0)

    def test_should_strip_code_fences(self):
        self.assertEqual(m.strip_code_fences("```html\n<html></html>\n```"), "<html></html>")
        self.assertEqual(m.strip_code_fences("<html></html>"), "<html></html>")


class ProbeTests(unittest.TestCase):
    def test_minimal_probe_body_disables_thinking_and_caps_output(self):
        import json
        body = json.loads(m.minimal_probe_body("deepseek-v4-flash"))
        self.assertEqual(body["max_tokens"], 1)
        self.assertEqual(body["thinking"], {"type": "disabled"})
        self.assertNotIn("reasoning_effort", body)

    def test_any_non_5xx_means_endpoint_up(self):
        for code in (200, 204, 401, 403, 404, 405, 429):
            self.assertTrue(m.endpoint_is_up(code))
        for code in (500, 502, 503, 504):
            self.assertFalse(m.endpoint_is_up(code))
class CostGuardTests(unittest.TestCase):
    def test_should_wind_down_on_token_or_turn_limit(self):
        import argparse, os
        from pathlib import Path
        from types import SimpleNamespace
        os.environ["OCTOS_ARC_MAX_TOTAL_TOKENS"] = "1000"; os.environ["OCTOS_ARC_MAX_TURNS"] = "3"
        try:
            flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        finally:
            del os.environ["OCTOS_ARC_MAX_TOTAL_TOKENS"]; del os.environ["OCTOS_ARC_MAX_TURNS"]
        flow.llm_proxy = SimpleNamespace(total_tokens=999)
        self.assertFalse(flow.wound_down())
        flow.llm_proxy.total_tokens = 1000
        self.assertTrue(flow.wound_down())
        flow.llm_proxy.total_tokens = 0; flow.turn_count = 3
        self.assertTrue(flow.wound_down())

    def test_should_stay_unset_until_the_tree_is_known_and_never_trip_a_normal_run(self):
        import argparse
        from pathlib import Path
        from types import SimpleNamespace
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        self.assertEqual((flow.max_total_tokens, flow.max_turns), (-1, -1))
        flow.llm_proxy = SimpleNamespace(total_tokens=10**9); flow.turn_count = 10**6
        self.assertFalse(flow.wound_down())  # -1 = not derived yet -> inactive
        # keep-sized tree: calibrated run (26M tokens, 35 turns) is far below the derived limits
        flow.max_total_tokens = max(6_000_000, 2_500_000 * 32); flow.max_turns = max(24, 4 * 32)
        flow.llm_proxy.total_tokens = 26_000_000; flow.turn_count = 35
        self.assertFalse(flow.wound_down())
        flow.llm_proxy.total_tokens = 80_000_000
        self.assertTrue(flow.wound_down())

    def test_should_honor_absolute_ceiling(self):
        import argparse
        from pathlib import Path
        from types import SimpleNamespace
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        flow.max_total_tokens, flow.max_turns, flow.max_total_tokens_abs = 0, 0, 75_000_000
        flow.llm_proxy = SimpleNamespace(total_tokens=74_999_999); flow.turn_count = 999
        self.assertFalse(flow.wound_down())
        flow.llm_proxy.total_tokens = 75_000_000
        self.assertTrue(flow.wound_down())


class ProbePolicyTests(unittest.TestCase):
    def test_all_specs_tiny_requires_every_spec_node_small(self):
        import argparse, tempfile
        from pathlib import Path
        root = Path(tempfile.mkdtemp())
        (root / "a.spec.ts").write_text("x" * 400); (root / "b.spec.ts").write_text("y" * 4000)
        flow = m.Flow(argparse.Namespace(web_port=1), root, root)
        flow.tests_dir = root
        flow.spec_map = {"REQ-1": ["a.spec.ts"], "REQ-2": ["b.spec.ts"], "REQ-3": [], None: []}
        self.assertFalse(flow.all_specs_tiny(["REQ-1", "REQ-2", "REQ-3"]))
        self.assertTrue(flow.all_specs_tiny(["REQ-1", "REQ-3"]))
        self.assertFalse(flow.all_specs_tiny(["REQ-3"]))

    def test_looks_like_markup_accepts_fragments(self):
        self.assertTrue(m.looks_like_markup('<div data-testid="count">0</div><button>Increment</button><script>1</script>'))
        self.assertTrue(m.looks_like_markup("<!DOCTYPE html><html></html>"))
        self.assertFalse(m.looks_like_markup("dry run: no model call; nothing written."))


class RelevantSourcesTests(unittest.TestCase):
    def test_should_quote_backend_first_then_pages_by_spec_overlap_within_budget(self):
        import tempfile
        from pathlib import Path
        root = Path(tempfile.mkdtemp())
        (root / "frontend/src").mkdir(parents=True); (root / "backend").mkdir()
        (root / "backend/server.js").write_text("const http = require('http'); // router")
        (root / "frontend/src/index.html").write_text("<a href='/notes'>Notes</a>" + "x" * 300)
        (root / "frontend/src/notes.html").write_text("<h1>Notes</h1><button>New note</button><ul data-testid='note-list'></ul>" + "y" * 300)
        (root / "frontend/src/settings.html").write_text("<h1>Settings</h1>" + "z" * 300)
        spec = "await page.goto('/notes'); await page.getByRole('button', { name: 'New note' }).click(); await expect(page.getByTestId('note-list')).toBeVisible();"
        out = m.relevant_sources(root, spec, max_chars=800)
        self.assertLess(out.index("backend/server.js"), out.index("frontend/src/notes.html"))
        self.assertIn("--- frontend/src/notes.html ---", out)
        self.assertIn("settings.html", out)  # listed as omitted
        self.assertNotIn("--- frontend/src/settings.html ---", out)

    def test_codegen_applies_to_big_trees_unless_capped(self):
        import argparse, os
        from pathlib import Path
        from types import SimpleNamespace
        flow = m.Flow(argparse.Namespace(web_port=1), Path("."), Path("."))
        flow.llm_proxy = SimpleNamespace(); flow.n_nodes = 32
        self.assertTrue(flow.codegen_mode())
        os.environ["OCTOS_ARC_CODEGEN_MAX_NODES"] = "2"
        try:
            self.assertFalse(flow.codegen_mode())
        finally:
            del os.environ["OCTOS_ARC_CODEGEN_MAX_NODES"]
        self.assertTrue(flow.codegen_context_fits("x" * 20000)); self.assertFalse(flow.codegen_context_fits("x" * 60000))


class FinalSuiteBestRoundTests(unittest.TestCase):
    """L17 port: the final suite delivers the best round. Simulated with stubbed test runs."""
    def _flow(self, rounds_results):
        import argparse, tempfile
        from pathlib import Path
        from types import SimpleNamespace
        from acceptance import RunSummary, TestOutcome
        root = Path(tempfile.mkdtemp()); (root / "t").mkdir()
        for n in ("REQ-1", "REQ-2"):
            (root / "t" / f"{n}.spec.ts").write_text("x")
        flow = m.Flow(argparse.Namespace(web_port=1), root, root)
        flow.tests_dir = root / "t"; flow.spec_map = {"REQ-1": ["REQ-1.spec.ts"], "REQ-2": ["REQ-2.spec.ts"], None: []}
        flow.runner = SimpleNamespace(root=root, work_dir=root / "prepared"); flow.test_verdict = {"REQ-1": False}
        flow.heads = iter(["sha0", "sha1", "sha2"]); flow.restored = []; flow.commits = []
        it = iter(rounds_results)
        def run_specs(specs, workers=None, grader_like=False):
            passed = next(it)
            results = [TestOutcome(title=f"{n} t", ok=i < passed, status="passed" if i < passed else "failed", duration_ms=1,
                                   file=f"{n}.spec.ts") for i, n in enumerate(["REQ-1", "REQ-2"])]
            return RunSummary(passed=passed, total=2, results=results)
        flow.run_specs = run_specs
        flow.head = lambda: getattr(flow, "_head", "sha0")
        flow.commit = lambda msg: (flow.commits.append(msg), setattr(flow, "_head", f"sha{len(flow.commits)}"))[1] or True
        flow.restore_app = lambda sha: flow.restored.append(sha)
        flow.turn = lambda *a, **k: (True, "repaired")
        flow.record_tests = lambda *a, **k: None
        flow.remaining = lambda: 10_000
        flow.wound_down = lambda: False
        flow.sources_text = lambda: ""; flow.corrections_text = lambda: ""
        return flow

    def test_should_restore_best_state_after_regressing_repairs(self):
        import os
        os.environ["OCTOS_FINAL_REPAIR_ROUNDS"] = "2"
        try:
            flow = self._flow([1, 0, 0])
            flow.final_acceptance()
        finally:
            del os.environ["OCTOS_FINAL_REPAIR_ROUNDS"]
        # round 0 (1/2) is best at sha0; repairs regress to 0/2 twice (identical failures stop) -> restore sha0
        self.assertEqual(flow.restored, ["sha0"])
        self.assertTrue(flow.test_verdict["REQ-1"]); self.assertFalse(flow.test_verdict["REQ-2"])

    def test_should_continue_when_same_test_reaches_a_new_failed_operation(self):
        from unittest.mock import patch
        flow = self._flow([1, 1, 2])
        original = flow.run_specs
        observations = iter(["waiting for button", "waiting for dialog", ""])
        calls = []
        def run_specs(*args, **kwargs):
            summary = original(*args, **kwargs)
            message = next(observations)
            for result in summary.results:
                if not result.ok:
                    result.message = message
            calls.append(message)
            return summary
        flow.run_specs = run_specs
        with patch.dict("os.environ", {"OCTOS_FINAL_REPAIR_ROUNDS": "2"}):
            flow.final_acceptance()
        self.assertEqual(len(calls), 3)
        self.assertTrue(all(flow.test_verdict.values()))

    def test_should_not_restore_when_last_round_is_best(self):
        import os
        os.environ["OCTOS_FINAL_REPAIR_ROUNDS"] = "1"
        try:
            flow = self._flow([0, 1])
            flow.final_acceptance()
        finally:
            del os.environ["OCTOS_FINAL_REPAIR_ROUNDS"]
        self.assertEqual(flow.restored, [])
        self.assertTrue(flow.test_verdict["REQ-1"])

class ProbeInvalidationTests(unittest.TestCase):
    def test_failed_model_turn_discards_pre_generation_verdicts(self):
        from unittest.mock import Mock
        from acceptance import RunSummary
        from pathlib import Path
        flow = object.__new__(m.Flow)
        flow.probe_summaries = {'unchanged': RunSummary(passed=1, total=1)}
        flow.protected_prefixes = lambda: []
        flow.output_dir = Path('/tmp/unused-application')
        flow.turn_count = 0
        flow.guard_enabled = False
        flow.restore_protected = lambda: []
        flow.driver = Mock()
        flow.driver.run.return_value = (False, 'partial implementation failed')
        flow.turn('modify shared component', 60, 'changed implement', expect_verification=False)
        self.assertEqual(flow.probe_summaries, {})


class SmokeShellContractTests(unittest.TestCase):
    @unittest.skipUnless(__import__("os").name == "posix", "POSIX shell contract")
    def test_should_return_with_live_server_without_inheriting_capture_pipes(self):
        import os
        import re
        import signal
        import subprocess
        import tempfile
        from pathlib import Path

        text = m.PORT_RULES.format(smoke=43219, port=3000)
        command = re.search(r"```sh\n(.*?)\n```", text, re.S)
        self.assertIsNotNone(command, "Supply an executable background-server example")
        self.assertEqual(m.PORT_RULES, (Path(m.__file__).parent / "prompts/port-rules.md").read_text())
        with tempfile.TemporaryDirectory(prefix="smoke shell '") as directory:
            root = Path(directory)
            (root / "backend").mkdir()
            bin_dir = root / "bin"
            bin_dir.mkdir()
            npm = bin_dir / "npm"
            # A genuinely long-running child, without a timed sleep or network dependency.
            npm.write_text("#!/bin/sh\nexec python3 -c 'import signal; signal.pause()'\n")
            npm.chmod(0o755)
            process = subprocess.Popen(["/bin/sh", "-c", command.group(1)], cwd=root,
                                       env={**os.environ, "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"]},
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
            try:
                stdout, stderr = process.communicate(timeout=3)
                self.assertEqual(process.returncode, 0, stderr.decode())
                server_pid = int(stdout.strip())
                os.kill(server_pid, 0)
            finally:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.communicate()


class PostflightOwnershipTests(unittest.TestCase):
    def test_should_only_signal_descendants_or_processes_inside_this_workspace(self):
        from pathlib import Path
        from types import SimpleNamespace
        from unittest.mock import patch
        root = Path('/private/tmp/sweep-app')
        ps = """PID PPID RSS ELAPSED ARGS
90 1 100 00:01 node platform-runner.js
100 90 100 00:01 python main.py
110 100 100 00:01 sh wrapper
120 110 100 00:01 node server.js
130 120 100 00:01 chromium --headless
200 1 100 00:01 node foreign.js /private/tmp/sweep-app/input.txt
300 1 100 00:01 node server.js
400 1 100 00:01 node server.js
"""
        cwds = {200: '/elsewhere', 300: str(root/'backend'), 400: str(root)+'-other'}
        with patch.object(m.os, 'getpid', return_value=100), \
             patch.object(m.os, 'getppid', return_value=90), \
             patch.object(m.subprocess, 'run', return_value=SimpleNamespace(stdout=ps)), \
             patch.object(m, 'process_cwd', side_effect=lambda pid: cwds.get(pid), create=True), \
             patch.object(m.os, 'kill') as kill, \
             patch.object(m.time, 'sleep'), patch.object(m, 'log'):
            m._reap_stray_processes('test', root)
        self.assertEqual({call.args[0] for call in kill.call_args_list}, {120, 130, 300})

    def test_should_leave_foreign_listener_during_generation(self):
        from pathlib import Path
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        stop = Mock()
        stop.is_set.side_effect = [False, True]
        with patch.object(m.subprocess, 'run', return_value=SimpleNamespace(stdout='123\n')), \
             patch.object(m.os, 'readlink', return_value='/private/tmp/app-other/backend'), \
             patch.object(m.os, 'kill') as kill, patch.object(m, 'log'):
            m._port_watchdog(3000, Path('/private/tmp/app'), stop)
        kill.assert_not_called()


class RuntimeCacheProvenanceTests(unittest.TestCase):
    def test_should_reuse_only_a_cache_from_the_requested_url(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from unittest.mock import patch
        with TemporaryDirectory() as folder:
            cache = Path(folder)
            (cache/'octos').write_text('old executable')
            url = 'https://example.invalid/runtime/new.tar.gz'
            for marker, expected in [(None, 'downloaded'), ('old-url', 'downloaded'), (url, str(cache/'octos'))]:
                provenance = cache/'source-url.txt'
                if marker is not None:
                    provenance.write_text(marker)
                elif provenance.exists():
                    provenance.unlink()
                with patch.dict(m.os.environ, {'OCTOS_CACHE_DIR': folder, 'OCTOS_RELEASE_URL': url}, clear=True), \
                     patch.object(m, 'BUNDLE_DIR', cache/'bundle'), \
                     patch.object(m.shutil, 'which', return_value=None), \
                     patch.object(m, '_download_octos', return_value='downloaded') as download:
                    self.assertEqual(m.find_octos(), expected)
                    self.assertEqual(download.call_count, int(expected=='downloaded'))

    def test_should_replace_a_stale_archive_before_recording_its_new_source(self):
        import io, tarfile
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from unittest.mock import patch
        with TemporaryDirectory() as folder:
            cache = Path(folder)
            def archive(content):
                with tarfile.open(cache/'octos-bundle.tar.gz', 'w:gz') as tar:
                    member=tarfile.TarInfo('octos');member.size=len(content)
                    tar.addfile(member, io.BytesIO(content))
            archive(b'old version')
            (cache/'source-url.txt').write_text('old-url')
            url='https://example.invalid/runtime/new.tar.gz'
            with patch.dict(m.os.environ, {'OCTOS_RELEASE_URL': url}), \
                 patch.object(m.shutil, 'which', return_value='/usr/bin/curl'), \
                 patch.object(m.subprocess, 'run', side_effect=lambda *a, **kw: archive(b'new version')) as download, \
                 patch.object(m, 'log'):
                binary=m._download_octos(cache)
            self.assertEqual(Path(binary).read_bytes(), b'new version')
            self.assertEqual(download.call_count, 1)
            self.assertEqual((cache/'source-url.txt').read_text(), url)

class FailedGenerationAcceptanceTests(unittest.TestCase):
    def test_should_verify_existing_app_after_generation_returns_no_files(self):
        self.check_existing_app(True, True)

    def test_should_keep_failure_when_no_app_can_be_verified(self):
        self.check_existing_app(False, False)

    def test_should_retain_failed_acceptance_instead_of_trusting_the_model(self):
        self.check_existing_app(True, True, verdict=False)

    def test_should_keep_failure_without_a_test_runner(self):
        self.check_existing_app(True, False, runner=False)

    def test_should_keep_failure_without_specs(self):
        self.check_existing_app(True, False, specs=False)

    def test_should_forward_corrections_to_codegen_and_skip_tiny(self):
        self.check_existing_app(True, True, correction='Restore the previously verified navigation behavior')

    def check_existing_app(self, has_app, should_verify, verdict=True, runner=True, specs=True, correction=None):
        import tempfile
        from pathlib import Path
        from unittest.mock import Mock
        with tempfile.TemporaryDirectory() as directory:
            flow = Mock(spec=m.Flow)
            flow.output_dir = Path(directory)
            flow.req_dir = Path(directory)
            flow.spec_map = {'feature': ['feature.spec.ts'] if specs else []}
            flow.node_budget_cap = 300
            flow.remaining.return_value = 600
            flow.design_enabled = False
            flow.evolution = False
            flow.has_app.return_value = has_app
            flow.codegen_mode.return_value = False
            flow.turn.return_value = (False, 'reply contained no file blocks')
            flow.node_timeout = 300
            flow.implement_fraction = .7
            flow.smoke_port = 3001
            flow.web_port = 3000
            flow.runner = Mock() if runner else None
            flow.impl_failed = []
            flow.pending_corrections = []
            flow.test_verdict = {}
            flow.acceptance_loop.return_value = verdict
            for method in ['ancestors_text', 'tests_prompt_for', 'perf_text', 'ui_contract', 'verify_text', 'corrections_text']:
                getattr(flow, method).return_value = ''
            if correction:
                flow.pending_corrections = [correction]
                flow.corrections_text.side_effect = lambda: m.Flow.corrections_text(flow)
                flow.codegen_mode.return_value = True
                flow.tiny_mode.return_value = True
                flow.tiny_turn.return_value = False
                flow.spec_bodies.return_value = 'a generic acceptance spec'
                flow.codegen_context_fits.return_value = True
                flow.codegen_reasoning.return_value = 'none'
                flow.codegen_context_chars.return_value = 20000
                flow.codegen_ports_clause.return_value = ''
                flow.codegen_turn.return_value = (True, 'generated')
            flow.runtime = Mock()
            flow.runtime.traceability.list_interfaces.return_value = []
            m.Flow.node_cycle(flow, node('feature', 'Existing capability'), [], 1, 1)
            if correction:
                sent = flow.codegen_turn.call_args.args[0]
                self.assertEqual(sent.count(correction), 1)
                self.assertEqual(flow.pending_corrections, [])
                flow.tiny_turn.assert_not_called()
            self.assertEqual(flow.acceptance_loop.called, should_verify)
            if should_verify:
                self.assertEqual(flow.test_verdict['feature'], verdict)
                self.assertEqual(flow.impl_failed, [])
            else:
                self.assertEqual(flow.impl_failed, ['feature'])
