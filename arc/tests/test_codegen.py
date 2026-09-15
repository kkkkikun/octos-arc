import tempfile
import unittest
from pathlib import Path

from codegen import parse_file_blocks, write_files


class ParseTests(unittest.TestCase):
    def test_should_extract_blocks_and_confine_paths(self):
        text = ("Here you go.\n<<<FILE backend/server.js>>>\nconst x = 1;\n<<<END FILE>>>\n"
                "<<<FILE frontend/src/index.html >>>\n<p>hi</p>\n<<<END FILE>>>\n"
                "<<<FILE ../etc/passwd>>>\nno\n<<<END FILE>>>\n<<<FILE /abs/x>>>\nno\n<<<END FILE>>>\nDone.")
        files = parse_file_blocks(text)
        self.assertEqual(sorted(files), ["backend/server.js", "frontend/src/index.html"])
        self.assertEqual(files["backend/server.js"], "const x = 1;\n")

    def test_should_strip_a_stray_fence_and_keep_marker_like_code(self):
        text = "<<<FILE a.js>>>\n```js\nif (a <<< b) {}\n```\n<<<END FILE>>>"
        self.assertEqual(parse_file_blocks(text)["a.js"], "if (a <<< b) {}\n")

    def test_should_return_empty_when_no_blocks(self):
        self.assertEqual(parse_file_blocks("just prose"), {})

    def test_should_write_files_under_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            written = write_files(Path(tmp), {"backend/server.js": "x\n"})
            self.assertEqual(written, ["backend/server.js"])
            self.assertEqual((Path(tmp) / "backend" / "server.js").read_text(), "x\n")


class EnsureCharsetTests(unittest.TestCase):
    def test_should_inject_meta_charset_when_missing(self):
        from codegen import ensure_charset
        self.assertEqual(ensure_charset("<html><head><title>x</title></head><body>账户</body></html>"),
                         '<html><head><meta charset="utf-8"><title>x</title></head><body>账户</body></html>')
        self.assertEqual(ensure_charset("<html><body>x</body></html>"),
                         '<html><head><meta charset="utf-8"></head><body>x</body></html>')
        self.assertEqual(ensure_charset("<p>x</p>"), '<meta charset="utf-8">\n<p>x</p>')

    def test_should_keep_existing_charset(self):
        from codegen import ensure_charset
        page = '<html><head><meta charset="UTF-8"></head></html>'
        self.assertEqual(ensure_charset(page), page)

    def test_should_apply_to_written_html_files(self):
        import tempfile
        from pathlib import Path
        from codegen import write_files
        root = Path(tempfile.mkdtemp())
        write_files(root, {"frontend/src/index.html": "<html><head></head><body></body></html>", "backend/server.js": "x"})
        self.assertIn('<meta charset="utf-8">', (root / "frontend/src/index.html").read_text())
        self.assertEqual((root / "backend/server.js").read_text(), "x")


class UnescapeFlattenedTests(unittest.TestCase):
    def test_should_restore_newlines_in_a_flattened_block(self):
        from codegen import unescape_flattened
        flat = "const a = 1;\\n" * 12 + "x"
        out = unescape_flattened(flat)
        self.assertEqual(out.count("\n"), 12)
        self.assertNotIn("\\n", out)

    def test_should_leave_normal_files_with_string_escapes_alone(self):
        from codegen import unescape_flattened
        normal = "res.end('a\\nb');\n" * 20
        self.assertEqual(unescape_flattened(normal), normal)


class RepairFlattenedJsTests(unittest.TestCase):
    def test_should_unescape_only_when_it_makes_the_file_parse(self):
        import shutil, tempfile
        from pathlib import Path
        from codegen import repair_flattened_js
        if not shutil.which("node"):
            self.skipTest("node not on PATH")
        p = Path(tempfile.mkdtemp()) / "server.js"
        p.write_text("const a = 1;\nfunction f() {\n  if (a) x = 1;\\n  if (!a) x = 2;\\n  return x;\n}\n")
        self.assertTrue(repair_flattened_js(p))
        self.assertNotIn("\\n", p.read_text())
        good = "const s = 'a\\nb';\nconsole.log(s);\n"
        p.write_text(good)
        self.assertFalse(repair_flattened_js(p))
        self.assertEqual(p.read_text(), good)


class DedupeNavLinksTests(unittest.TestCase):
    def test_should_preserve_legitimate_links_with_shared_destinations(self):
        import tempfile
        from pathlib import Path
        from codegen import dedupe_nav_links
        root = Path(tempfile.mkdtemp())
        (root / "frontend/src").mkdir(parents=True); (root / "backend").mkdir()
        page = '<body><!--NAV-->\n<a href="/register">Register</a>\n<a href="/about">About</a>\n<a href="/help">Help</a></body>'
        (root / "frontend/src/index.html").write_text(page)
        (root / "backend/server.js").write_text("x")
        self.assertEqual(dedupe_nav_links(root), [])
        (root / "backend/server.js").write_text("""const nav = '<a href="/register">R</a> <a href="/about">A</a>'; html.replace('<!--NAV-->', nav)""")
        self.assertEqual(dedupe_nav_links(root), [])
        out = (root / "frontend/src/index.html").read_text()
        self.assertIn('href="/register"', out)
        self.assertIn('href="/about"', out)
        self.assertIn('href="/help"', out)  # not rendered by the server: kept
        self.assertIn("<!--NAV-->", out)
        self.assertIn("<!--NAV-->", out)


class PreserveFileSemanticsTests(unittest.TestCase):
    def test_should_preserve_escape_heavy_valid_javascript_and_json(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            value = "line\n" * 20
            js = "const text = " + json.dumps(value) + ";\n"
            data = json.dumps({"text": value})
            write_files(root, {"backend/server.js": js, "backend/sample.json": data})
            self.assertEqual((root / "backend/server.js").read_text(), js)
            self.assertEqual((root / "backend/sample.json").read_text(), data)


class TinyFailureEvidenceTests(unittest.TestCase):
    def test_failed_selector_is_logged_before_compact_fallback(self):
        import main
        from acceptance import RunSummary, TestOutcome
        from unittest.mock import patch
        flow = object.__new__(main.Flow)
        with tempfile.TemporaryDirectory() as tmp:
            flow.output_dir = Path(tmp)
            flow.tests_dir = Path(tmp)
            flow.web_port = 43219
            flow.runner = object()
            flow.spec_bodies = lambda _: 'public contract'
            def generated(*args, **kwargs):
                page = flow.output_dir / 'frontend/src/index.html'
                page.parent.mkdir(parents=True, exist_ok=True)
                page.write_text('<p>ready</p>')
                return True, 'generated'
            flow.codegen_turn = generated
            flow.run_specs = lambda _: RunSummary(total=1, results=[TestOutcome(
                title='status display', ok=False, status='failed', duration_ms=5000,
                message="getByTestId('status-output'): element not found")])
            with patch('main.log') as log:
                self.assertFalse(flow.tiny_turn('node', ['public.spec.ts'], 60, {'description': 'show status'}))
                self.assertIn("getByTestId('status-output')", '\n'.join(str(c.args[0]) for c in log.call_args_list))


class RepairLocationTests(unittest.TestCase):
    def test_repair_prompt_identifies_external_readonly_tests(self):
        import main
        location = '/external/acceptance specs'
        prompt = main.REPAIR_PROMPT.format(node_id='node', passed=0, total=1,
            failures='example.spec.ts: missing element', corrections='', slow='', sources='',
            smoke=1234, port=3000, test_location=location)
        self.assertIn(location, prompt)


class BestRepairStateTests(unittest.TestCase):
    def test_restores_uncommitted_regression_even_when_commit_id_is_unchanged(self):
        import main
        import time
        from unittest.mock import Mock
        from acceptance import RunSummary, TestOutcome
        flow = object.__new__(main.Flow)
        flow.runner = object()
        flow.repair_rounds = 2
        flow.min_repair_seconds = 0
        flow.node_timeout = 60
        flow.smoke_port = 43219
        flow.web_port = 3000
        flow.tests_dir = None
        flow.pending_corrections = []
        flow.head = lambda: 'same-commit'
        flow.codegen_mode = lambda: False
        flow.wound_down = lambda: False
        flow.time_up = lambda: False
        flow.record_tests = Mock()
        flow.snapshot_sources = Mock()
        flow.sources_text = lambda: ''
        flow.corrections_text = lambda: ''
        flow.turn = Mock()  # failed repair leaves uncommitted edits; HEAD remains unchanged
        flow.commit = Mock()
        flow.restore_app = Mock()
        failure = TestOutcome('behavior', False, 'failed', 1, message='missing control')
        flow.run_specs = Mock(side_effect=[RunSummary(passed=1, total=2, results=[failure]),
                                          RunSummary(passed=0, total=2, results=[failure]),
                                          RunSummary(passed=1, total=2, results=[failure])])
        rebuild = Mock(return_value='Rewrite everything')
        self.assertFalse(flow.acceptance_loop('node', ['example.spec.ts'], time.time()+1000, rebuild))
        rebuild.assert_not_called()
        self.assertEqual(flow.turn.call_count, 2)
        flow.restore_app.assert_called_once_with('same-commit')


class VerifiedBehaviorRewriteTests(unittest.TestCase):
    def test_should_repair_failed_extension_without_calling_rebuild(self):
        import main, time
        from unittest.mock import Mock, patch
        from acceptance import RunSummary, TestOutcome
        flow = object.__new__(main.Flow)
        flow.runner = object()
        flow.repair_rounds = 1
        flow.min_repair_seconds = 0
        flow.node_timeout = 60
        flow.tests_dir = None
        flow.pending_corrections = []
        flow.test_verdict = {'working-feature': True}
        flow.head = lambda: 'original'
        flow.codegen_mode = lambda: False
        flow.wound_down = flow.time_up = lambda: False
        flow.sources_text = flow.corrections_text = flow.repair_test_location = lambda *args: ''
        flow.record_tests = flow.snapshot_sources = flow.commit = Mock()
        flow.turn = Mock()
        flow.smoke_port, flow.web_port = 43219, 3000
        fail = TestOutcome('new behavior', False, 'failed', 1, message='missing control')
        flow.run_specs = Mock(side_effect=[RunSummary(passed=0, total=1, results=[fail]),
                                          RunSummary(passed=1, total=1)])
        rebuild = Mock(return_value='Replace the application')
        with patch.dict('os.environ', {'OCTOS_ARC_REWRITE_ON_ZERO': '1'}):
            self.assertTrue(flow.acceptance_loop('new-feature', ['new.spec.ts'],
                                                time.time()+1000, rebuild))
        rebuild.assert_not_called()
        flow.turn.assert_called_once()
        self.assertIn('Fix frontend/', flow.turn.call_args.args[0])

    def test_should_avoid_full_rewrite_when_any_behavior_already_passed(self):
        import main
        from acceptance import RunSummary
        flow = object.__new__(main.Flow)
        flow.test_verdict = {'new-feature': False}
        flow.probe_summaries = {}
        self.assertTrue(flow.can_rewrite_from_scratch())
        flow.test_verdict['existing-feature'] = True
        self.assertFalse(flow.can_rewrite_from_scratch())
        flow.test_verdict.clear()
        flow.probe_summaries['template-feature'] = RunSummary(passed=1, total=2)
        self.assertFalse(flow.can_rewrite_from_scratch())


class RepairModeTransitionTests(unittest.TestCase):
    def test_should_try_tool_repair_before_stopping_at_codegen_plateau(self):
        import main
        import time
        from unittest.mock import Mock, patch
        from acceptance import RunSummary, TestOutcome
        for tools_succeed, rounds in ((True, 5), (False, 5), (False, 2)):
            with self.subTest(tools_succeed=tools_succeed, rounds=rounds):
                flow = object.__new__(main.Flow)
                flow.runner = object()
                flow.repair_rounds = rounds
                flow.min_repair_seconds = 0
                flow.node_timeout = 60
                flow.smoke_port = 43219
                flow.web_port = 3000
                flow.tests_dir = None
                flow.pending_corrections = []
                flow.head = lambda: 'same-commit'
                flow.codegen_mode = lambda: not flow.codegen_blocked
                flow.wound_down = lambda: False
                flow.time_up = lambda: False
                flow.record_tests = Mock()
                flow.snapshot_sources = Mock()
                flow.sources_text = lambda: ''
                flow.corrections_text = lambda: ''
                flow.codegen_turn = Mock()
                flow.turn = Mock()
                flow.commit = Mock()
                flow.restore_app = Mock()
                summaries = [RunSummary(passed=0, total=1, results=[
                    TestOutcome('behavior', False, 'failed', 1, message=f'missing control {i}')])
                    for i in range(3)]
                summaries.append(RunSummary(passed=int(tools_succeed), total=1, results=[
                    TestOutcome('behavior', tools_succeed, 'passed' if tools_succeed else 'failed',
                                1, message='' if tools_succeed else 'still missing control')]))
                flow.run_specs = Mock(side_effect=summaries)
                with patch.dict('os.environ', {'OCTOS_ARC_CODEGEN_REPAIRS': '2'}):
                    self.assertEqual(flow.acceptance_loop('node', ['generic.spec.ts'], time.time()+1000),
                                     tools_succeed)
                self.assertEqual(flow.codegen_turn.call_count, 2)
                self.assertEqual(flow.turn.call_count, int(rounds > 2))
                self.assertEqual(flow.run_specs.call_count, 4 if rounds > 2 else 3)


class RepairEntryTests(unittest.TestCase):
    def test_should_supply_executable_test_entry_with_quoted_paths(self):
        import main
        import json
        import subprocess
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory(prefix="runner space ' ") as tmp:
            root = Path(tmp).resolve()
            work = root / 'prepared'
            work.mkdir()
            config = work / 'playwright.config.ts'
            config.write_text('// prepared')
            binary = root / 'node_modules/.bin/playwright'
            binary.parent.mkdir(parents=True)
            binary.write_text('#!/usr/bin/env python3\nimport os,sys,json\nprint(json.dumps([os.getcwd(), os.environ["E2E_BASE_URL"], sys.argv[1:]]))\n')
            binary.chmod(0o755)
            flow = object.__new__(main.Flow)
            flow.tests_dir = root / 'original tests'
            flow.output_dir = root / 'application'
            flow.smoke_port = 43219
            flow.runner = SimpleNamespace(root=root, work_dir=work, workers=2)
            flow.mem_limit = None
            from unittest.mock import patch
            helper = root / 'verify_app.py'
            helper.write_text('import sys,json; print(json.dumps(sys.argv[1:]))')
            with patch.object(main, 'BUNDLE_DIR', root):
                context = flow.repair_test_location(["generic one's.spec.ts"])
                self.assertIn(str(flow.output_dir), context)
                command = context.split('```sh\n')[1].split('\n```')[0]
                out = subprocess.check_output(['sh', '-c', command], text=True)
                self.assertEqual(json.loads(out), ['--app', str(flow.output_dir), '--tests', str(flow.tests_dir),
                                                   '--playwright', str(root), '--workers', '2', '--spec', "generic one's.spec.ts"])
                with patch.dict('os.environ', {'OCTOS_ARC_FINAL_WORKERS': '4'}):
                    full = flow.repair_test_location()
                    self.assertNotIn('--spec', full)
                    command = full.split('```sh\n')[1].split('\n```')[0]
                    args = json.loads(subprocess.check_output(['sh', '-c', command], text=True))
                    self.assertEqual(args[args.index('--workers') + 1], '4')
                    flow.mem_limit = 512 * 1024 * 1024
                    command = flow.repair_test_location().split('```sh\n')[1].split('\n```')[0]
                    args = json.loads(subprocess.check_output(['sh', '-c', command], text=True))
                    self.assertEqual(args[args.index('--workers') + 1], '1')
                helper.unlink()
                self.assertNotIn('```sh', flow.repair_test_location())
