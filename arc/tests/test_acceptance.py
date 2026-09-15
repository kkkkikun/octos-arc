import subprocess
import tempfile
import unittest
from pathlib import Path

from acceptance import (
    failure_summaries,
    isolated_install_env,
    map_specs_to_nodes,
    playwright_version_hint,
    nodes_for_failures,
    restore_tree,
    restore_worktree,
    robustness_probe,
    workers_for_memory,
    snapshot_worktree,
    tree_digest,
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


class WorktreeSnapshotTests(unittest.TestCase):
    def test_should_undo_test_run_mutations_but_keep_uncommitted_edits(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run = lambda args: subprocess.run(["git", *args], cwd=root, check=False, capture_output=True,  # noqa: E731
                                              env={"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@x", "GIT_COMMITTER_NAME": "t",
                                                   "GIT_COMMITTER_EMAIL": "t@x", "PATH": "/usr/bin:/bin:/opt/homebrew/bin"})
            run(["init", "-q"])
            (root / "backend").mkdir()
            (root / "backend" / "db.json").write_text('{"count": 0}')
            (root / "backend" / "server.js").write_text("v1")
            run(["add", "-A"]); run(["commit", "-qm", "init"])
            (root / "backend" / "server.js").write_text("v2 (repair edit, uncommitted)")
            snapshot_worktree(run)
            # the test run mutates the store and creates a new file
            (root / "backend" / "db.json").write_text('{"count": -1}')
            (root / "backend" / "uploads.json").write_text("[]")
            restore_worktree(run)
            self.assertEqual((root / "backend" / "db.json").read_text(), '{"count": 0}')
            self.assertEqual((root / "backend" / "server.js").read_text(), "v2 (repair edit, uncommitted)")
            self.assertFalse((root / "backend" / "uploads.json").exists())


class FailureGroupingTests(unittest.TestCase):
    def test_should_group_failed_tests_by_owning_node_via_spec_basename(self):
        summary = summarize_report({"suites": [
            {"title": "a", "file": "REQ-1.spec.ts", "specs": [
                {"title": "one", "file": "REQ-1.spec.ts", "tests": [{"status": "unexpected", "results": [{"status": "failed", "duration": 1,
                    "error": {"message": "x", "location": {"file": "/w/tests/REQ-1.spec.ts", "line": 3}}}]}]}]},
            {"title": "b", "file": "sub/REQ-2.spec.ts", "specs": [
                {"title": "two", "file": "sub/REQ-2.spec.ts", "tests": [{"status": "expected", "results": [{"status": "passed", "duration": 1}]}]},
                {"title": "three", "file": "sub/REQ-2.spec.ts", "tests": [{"status": "unexpected", "results": [{"status": "timedOut", "duration": 1}]}]}]},
        ]})
        grouped = nodes_for_failures(summary.results, {"REQ-1": ["REQ-1.spec.ts"], "REQ-2": ["sub/REQ-2.spec.ts"], None: []})
        self.assertEqual({k: [r.title for r in v] for k, v in grouped.items()}, {"REQ-1": ["one"], "REQ-2": ["three"]})


class PrivateInstallTests(unittest.TestCase):
    def test_should_pin_version_from_tests_package_lock_or_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            tests = Path(tmp) / "tests"; tests.mkdir()
            self.assertEqual(playwright_version_hint(tests, fallback="1.63.0"), "1.63.0")
            (Path(tmp) / "package-lock.json").write_text(
                '{"packages": {"node_modules/@playwright/test": {"version": "1.55.1"}}}')
            self.assertEqual(playwright_version_hint(tests), "1.55.1")
            (tests / "package.json").write_text('{"devDependencies": {"@playwright/test": "^1.52.0"}}')
            self.assertEqual(playwright_version_hint(tests), "1.52.0")

    def test_should_keep_every_write_inside_the_private_root(self):
        env = isolated_install_env(Path("/private/x"))
        for key in ("npm_config_cache", "NPM_CONFIG_CACHE", "PLAYWRIGHT_BROWSERS_PATH"):
            self.assertTrue(env[key].startswith("/private/x"), key)
        self.assertIn("npmmirror", env["PLAYWRIGHT_DOWNLOAD_HOST"])


class ProtectedTreeTests(unittest.TestCase):
    def test_should_restore_changed_deleted_and_added_files(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            live = Path(tmp) / "tests"; (live / "support").mkdir(parents=True)
            (live / "REQ-1.spec.ts").write_text("original"); (live / "support" / "e2e.ts").write_text("helper")
            snap = Path(tmp) / "snap"; shutil.copytree(live, snap)
            digest = tree_digest(live)
            (live / "REQ-1.spec.ts").write_text("tampered"); (live / "support" / "e2e.ts").unlink()
            (live / "playwright.config.ts").write_text("injected")
            fixed = restore_tree(live, snap, digest)
            self.assertEqual(sorted(fixed), ["REQ-1.spec.ts", "playwright.config.ts", "support/e2e.ts"])
            self.assertEqual((live / "REQ-1.spec.ts").read_text(), "original")
            self.assertEqual((live / "support" / "e2e.ts").read_text(), "helper")
            self.assertFalse((live / "playwright.config.ts").exists())
            self.assertEqual(tree_digest(live), digest)

    def test_should_report_zero_tests_as_load_error(self):
        summary = summarize_report({"suites": [], "errors": [{"message": "SyntaxError: Unexpected token"}]})
        self.assertEqual(summary.total, 0)
        self.assertEqual(summary.load_errors, ["SyntaxError: Unexpected token"])


class HelperLocationTests(unittest.TestCase):
    def test_should_attribute_failure_raised_in_helper_to_the_spec_file(self):
        rep = {"suites": [{"title": "REQ-2.3.1-x.spec.ts", "file": "REQ-2.3.1-x.spec.ts", "specs": [
            {"title": "REQ-2.3.1: trash view", "file": "REQ-2.3.1-x.spec.ts", "tests": [{"status": "unexpected", "results": [
                {"status": "failed", "duration": 900, "error": {"message": "boom", "location": {"file": "/w/tests/support/e2e.ts", "line": 48}}}]}]}]}]}
        summary = summarize_report(rep)
        grouped = nodes_for_failures(summary.results, {"REQ-2.3.1": ["REQ-2.3.1-x.spec.ts"], None: []})
        self.assertEqual(list(grouped), ["REQ-2.3.1"])
        self.assertIn("Failed at: e2e.ts:48 (called from REQ-2.3.1-x.spec.ts)", failure_summaries(summary))


class MemoryWorkersTests(unittest.TestCase):
    def test_should_scale_workers_to_container_memory(self):
        self.assertEqual(workers_for_memory(None, 4), 4)
        self.assertEqual(workers_for_memory(512 * 1024 * 1024, 4), 1)
        self.assertEqual(workers_for_memory(2 * 1024 * 1024 * 1024, 4), 2)
        self.assertEqual(workers_for_memory(8 * 1024 * 1024 * 1024, 4), 4)


class RobustnessProbeTests(unittest.TestCase):
    def test_should_retry_only_initial_transport_failure_with_live_process(self):
        from unittest.mock import Mock, patch
        import http.client
        for errors, alive, expected_calls, passes in [
            ([ConnectionResetError(), None, None, None], True, 4, True),
            ([ConnectionResetError(), ConnectionResetError()], True, 2, False),
            ([ConnectionResetError()], False, 1, False),
            ([None, ConnectionResetError()], True, 2, False),
            ([ValueError('invalid')], True, 1, False),
        ]:
            proc = Mock(); proc.poll.return_value = None if alive else 1
            connections = []
            for error in errors:
                conn = Mock()
                if error: conn.getresponse.side_effect = error
                connections.append(conn)
            with patch.object(http.client, 'HTTPConnection', side_effect=connections) as factory, patch('acceptance.time.sleep'):
                result = robustness_probe(12345, proc, timeout=1)
            self.assertEqual(result is None, passes)
            self.assertEqual(factory.call_count, expected_calls)
            self.assertTrue(all(c.close.called for c in connections))

    def test_should_not_retry_after_initial_probe_budget_is_exhausted(self):
        from unittest.mock import Mock, patch
        import http.client
        conn = Mock(); conn.getresponse.side_effect = ConnectionResetError()
        with patch.object(http.client, 'HTTPConnection', return_value=conn) as factory, \
             patch('acceptance.time.monotonic', side_effect=[0, 0, 2]), \
             patch('acceptance.time.sleep') as pause:
            self.assertIsNotNone(robustness_probe(12345, timeout=1))
        self.assertEqual(factory.call_count, 1)
        pause.assert_not_called()

    def test_should_pass_for_a_server_that_answers_404_and_fail_for_a_dead_port(self):
        import http.server, socket, threading
        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(404); self.end_headers()
            def log_message(self, *a): pass
        srv = http.server.HTTPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
        th = threading.Thread(target=srv.serve_forever, daemon=True); th.start()
        try:
            self.assertIsNone(robustness_probe(port, None, timeout=3))
        finally:
            srv.shutdown()
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0)); free = s.getsockname()[1]
        err = robustness_probe(free, None, timeout=2)
        self.assertIn("no HTTP response", err)


class FinalWorkersAndReapTests(unittest.TestCase):
    def test_should_pick_final_workers_by_450mib_per_worker(self):
        from acceptance import workers_for_final
        self.assertEqual(workers_for_final(2 * 1024**3, 4), 4)
        self.assertEqual(workers_for_final(512 * 1024**2, 4), 1)
        self.assertEqual(workers_for_final(None, 4), 4)

    def test_should_reap_only_node_processes_inside_app_dirs(self):
        import tempfile
        from pathlib import Path
        from acceptance import should_reap
        root = Path(tempfile.mkdtemp())
        (root / "backend").mkdir(); (root / ".octos").mkdir()
        self.assertTrue(should_reap("node", str(root / "backend"), root))
        self.assertTrue(should_reap("/usr/bin/node", str(root / "frontend" / "x"), root))
        self.assertFalse(should_reap("node", str(root / ".octos"), root))
        self.assertFalse(should_reap("node", str(root), root))
        self.assertFalse(should_reap("octos", str(root / "backend"), root))
        self.assertFalse(should_reap("node", None, root))

class ActionableFailureTests(unittest.TestCase):
    def test_should_keep_locator_error_after_generic_test_timeout(self):
        data = report(('open detail', 'timedOut', 'Test timeout of 10000ms exceeded.', [], 10000))
        result = data['suites'][0]['specs'][0]['tests'][0]['results'][0]
        result['errors'].append({'message': "locator.click: Timeout 4000ms exceeded.\nCall log:\n  - waiting for getByRole('button', {name: 'Open'})", 'location': {'file': '/w/tests/helpers.ts', 'line': 42}})
        summary = summarize_report(data)
        self.assertIn("waiting for getByRole", failure_summaries(summary))
        self.assertEqual(summary.results[0].location, 'helpers.ts:42')

    def test_should_not_infer_slow_server_from_missing_element(self):
        summary = summarize_report(report(('open', 'timedOut', "locator.click: Timeout 4000ms exceeded.\nCall log:\n  - waiting for getByRole('button')", [], 4100)))
        self.assertNotIn('page or a request never settled', failure_summaries(summary))

    def test_should_distinguish_changed_locator_but_ignore_elapsed_time(self):
        from acceptance import failure_signature, RunSummary, TestOutcome
        def sample(locator, duration):
            return RunSummary(results=[TestOutcome(title='open', ok=False, status='timedOut', duration_ms=duration, file='x.spec.ts', message=f"Timeout {duration}ms exceeded.\nCall log:\n  - waiting for {locator}")])
        self.assertEqual(failure_signature(sample('button', 4000)), failure_signature(sample('button', 4100)))
        self.assertNotEqual(failure_signature(sample('button', 4000)), failure_signature(sample('link', 4000)))

    def test_stalled_repair_preserves_numeric_behavior(self):
        from acceptance import failure_signature, RunSummary, TestOutcome
        def sample(message, location='spec.ts:10'):
            return RunSummary(results=[TestOutcome(title='same test', ok=False, status='failed', duration_ms=1, location=location, message=message)])
        self.assertNotEqual(failure_signature(sample('Expected 200, received 404')), failure_signature(sample('Expected 200, received 500')))
        self.assertNotEqual(failure_signature(sample('missing', 'spec.ts:10')), failure_signature(sample('missing', 'spec.ts:20')))


class ServerCleanupTests(unittest.TestCase):
    @unittest.skipUnless(__import__('os').name == 'posix', 'process-group cleanup uses POSIX')
    def test_should_reap_owned_server_before_returning_from_stop(self):
        import os
        import sys
        from unittest.mock import patch
        from acceptance import AppServer
        child = subprocess.Popen([sys.executable, '-c',
            "import os; print('ready', flush=True); os.read(0, 1)"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, start_new_session=True)
        try:
            self.assertEqual(child.stdout.readline(), b'ready\n')
            server = object.__new__(AppServer)
            server.proc = child
            server.port = 0
            server.grader_like = False
            server.log_file = None
            with patch('acceptance.free_port'):
                server.stop()
                server.stop()  # cleanup remains safe when called again
            self.assertIsNotNone(child.returncode, 'stop must collect the child exit status')
            with self.assertRaises(ChildProcessError):
                os.waitpid(child.pid, os.WNOHANG)
        finally:
            child.kill()
            child.wait(timeout=5)
            child.stdin.close()
            child.stdout.close()

class CaughtActionDiagnosticsTests(unittest.TestCase):
    def test_should_preserve_verdict_and_include_caught_errors_only_for_failed_tests(self):
        report = {'action_errors': {'case': ['Click: overlay intercepts pointer events']},
                  'suites': [{'specs': [{'id': 'case', 'title': 'flow', 'tests': [
                      {'status': 'unexpected', 'results': [{'status': 'failed', 'error': {'message': 'missing item'}}]}
                  ]}]}]}
        summary = summarize_report(report)
        self.assertEqual((summary.passed, summary.total), (0, 1))
        self.assertIn('overlay intercepts pointer events', failure_summaries(summary))
        self.assertIn('may have recovered', failure_summaries(summary))
        report['suites'][0]['specs'][0]['tests'][0]['status'] = 'expected'
        summary = summarize_report(report)
        self.assertEqual((summary.passed, summary.total), (1, 1))
        self.assertEqual(failure_summaries(summary), '')

class ActionReporterBoundsTests(unittest.TestCase):
    def test_should_include_bounded_preceding_actions_for_failed_tests(self):
        reporter = Path(__file__).resolve().parents[1] / 'action_errors.cjs'
        script = r"""
const assert = require('assert'); const Reporter = require(process.argv[1]);
const steps = Array.from({length:12},(_,i)=>({category:'pw:api',title:'click control '+i,duration:1,steps:[]}));
steps.push(...Array.from({length:20},()=>({category:'pw:api',title:'Query count',steps:[]})));
steps.push({category:'expect',title:'expect visible',duration:4000,error:{message:'still hidden'},steps:[]});
const result={status:'failed',steps}; const before=JSON.stringify(result);
const reporter=new Reporter();reporter.onTestEnd({id:'failed'},result);
const text=reporter.rows.failed.join('\n');
assert(text.includes('Actions preceding the final failed step'));
assert(text.includes('click control 10') && text.includes('click control 11'));
assert(!text.includes('click control 0'));
assert(text.indexOf('click control 10') < text.indexOf('click control 11'));
assert.equal(JSON.stringify(result),before);
reporter.onTestEnd({id:'passed'},{status:'passed',steps});
assert(!reporter.rows.passed.join('\n').includes('Actions preceding'));
assert(reporter.rows.failed.length<=8 && reporter.rows.failed.every(x=>x.length<=2000));
"""
        result = subprocess.run(['node', '-e', script, str(reporter)], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_should_bound_diagnostics_without_mutating_results(self):
        reporter = Path(__file__).resolve().parents[1] / 'action_errors.cjs'
        script = r'''
const assert = require('assert'); const fs = require('fs');
const Reporter = require(process.argv[1]);
const result = {status:'passed',steps:Array.from({length:12},(_,i)=>({category:'pw:api',title:'x'.repeat(6000),duration:i,error:{message:String(i)+'y'.repeat(5000)},steps:[]}))};
const before = JSON.stringify(result);
const reporter = new Reporter({output:process.argv[2]});
reporter.onTestEnd({id:'case'}, result); reporter.onEnd();
assert.equal(JSON.stringify(result),before);
const errors=JSON.parse(fs.readFileSync(process.argv[2])).case;
assert.equal(errors.length,8); assert(errors.every(x=>x.length<=2000));
'''
        with tempfile.TemporaryDirectory() as root:
            result = subprocess.run(['node', '-e', script, str(reporter), str(Path(root) / 'actions.json')],
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)


class PortOwnershipBoundaryTests(unittest.TestCase):
    def test_should_not_signal_a_listener_in_a_similarly_named_workspace(self):
        import acceptance as module
        from types import SimpleNamespace
        from unittest.mock import patch
        with patch.object(module.subprocess, 'run', return_value=SimpleNamespace(stdout='123\n')), \
             patch.object(module.os, 'readlink', return_value='/private/tmp/app-other/backend'), \
             patch.object(module.os, 'kill') as kill:
            module.free_owned_ports([3000], Path('/private/tmp/app'))
        kill.assert_not_called()


class TerminalAcceptanceReportTests(unittest.TestCase):
    def test_should_show_verdict_in_terminal_and_preserve_json_report(self):
        import os
        from acceptance import AcceptanceRunner
        install = os.environ.get('OCTOS_TEST_PLAYWRIGHT_ROOT')
        if not install:
            self.skipTest('set OCTOS_TEST_PLAYWRIGHT_ROOT to an installed Playwright root')
        root = Path(install)
        with tempfile.TemporaryDirectory(prefix='terminal-report-', dir=root) as folder:
            base=Path(folder); specs=base/'source'; specs.mkdir()
            (specs/'example.spec.ts').write_text("import {test,expect} from '@playwright/test';\ntest('success case',()=>expect(1).toBe(1));\ntest('intentional mismatch',()=>expect(1).toBe(2));\n")
            runner=AcceptanceRunner(root,specs,base/'prepared',lambda _:None,workers=1)
            config=runner._prepare()
            run=subprocess.run([str(root/'node_modules/.bin/playwright'),'test','-c',str(config)],cwd=runner.work_dir,env=dict(os.environ,CI='1',NODE_PATH=str(root/'node_modules')),capture_output=True,text=True,timeout=30)
            import json
            report=json.loads((runner.work_dir/'report.json').read_text())
            self.assertEqual((summarize_report(report).passed,summarize_report(report).total),(1,2))
            self.assertEqual(run.returncode,1)
            self.assertIn('1 failed',run.stdout)
            self.assertIn('1 passed',run.stdout)


class BrowserRuntimeDiagnosticsTests(unittest.TestCase):
    def test_should_not_require_browser_for_api_only_acceptance(self):
        from acceptance import AcceptanceRunner
        import os
        install = os.environ.get('OCTOS_TEST_PLAYWRIGHT_ROOT')
        if not install:
            self.skipTest('requires installed Playwright')
        root = Path(install)
        with tempfile.TemporaryDirectory(prefix='api-only-', dir=root) as folder:
            base=Path(folder); specs=base/'source'; specs.mkdir()
            (specs/'api.spec.ts').write_text("import {test,expect} from '@playwright/test';\ntest('request fixture only',async({request})=>expect(typeof request.get).toBe('function'));\n")
            runner=AcceptanceRunner(root,specs,base/'prepared',lambda _:None,workers=1,
                                    env_extra={'PLAYWRIGHT_BROWSERS_PATH':str(base/'no-browsers')})
            result=runner.run(['api.spec.ts'],'http://127.0.0.1:1')
            self.assertEqual((result.passed,result.total),(1,1),failure_summaries(result))

    def test_should_report_page_error_without_changing_passed_verdict_or_sources(self):
        from acceptance import AcceptanceRunner
        import os, json
        install = os.environ.get('OCTOS_TEST_PLAYWRIGHT_ROOT')
        if not install:
            self.skipTest('requires installed Playwright')
        root = Path(install)
        with tempfile.TemporaryDirectory(prefix='page-error-', dir=root) as folder:
            base=Path(folder); specs=base/'source'; specs.mkdir()
            source = """import {test,expect} from '@playwright/test';
for (const fail of [false,true]) test('page exception '+fail,async({page})=>{
 await page.setContent('<button onclick="missingGenericHandler()">Open</button>');
 await page.getByRole('button',{name:'Open'}).click();
 expect(fail).toBe(false);
});
"""
            source += '\nconst __octosObservePageErrors = 1;\n'
            (specs/'nested').mkdir()
            spec=specs/'nested/generic.spec.ts'; spec.write_text(source)
            runner=AcceptanceRunner(root,specs,base/'prepared',lambda _:None,workers=1)
            result=runner.run(['nested/generic.spec.ts'],'http://127.0.0.1:1')
            self.assertEqual((result.passed,result.total),(1,2),result.error)
            self.assertEqual(spec.read_text(),source)
            self.assertIn('missingGenericHandler is not defined',failure_summaries(result))
            failed=[r for r in result.results if not r.ok]
            self.assertEqual(len(failed),1)

    def test_should_report_failed_navigation_without_changing_verdict(self):
        from acceptance import AcceptanceRunner
        import os
        install = os.environ.get('OCTOS_TEST_PLAYWRIGHT_ROOT')
        if not install:
            self.skipTest('requires installed Playwright')
        root = Path(install)
        with tempfile.TemporaryDirectory(prefix='navigation-error-', dir=root) as folder:
            base = Path(folder); specs = base/'source'; specs.mkdir()
            source = """import {test,expect} from '@playwright/test';
for (const fail of [false,true]) test('navigation status '+fail,async({page})=>{
 await page.route('http://example.test/**', route=>route.fulfill({status:404,contentType:'text/html',body:'missing page'}));
 await page.goto('http://example.test/missing-route?secret=private-value');
 expect(fail).toBe(false);
});
"""
            spec = specs/'navigation.spec.ts'; spec.write_text(source)
            runner = AcceptanceRunner(root,specs,base/'prepared',lambda _:None,workers=1)
            result = runner.run(['navigation.spec.ts'],'http://127.0.0.1:1')
            self.assertEqual((result.passed,result.total),(1,2),result.error)
            self.assertEqual(spec.read_text(),source)
            summary = failure_summaries(result)
            self.assertIn('HTTP 404',summary)
            self.assertIn('http://example.test/missing-route',summary)
            # Check only the observer message: original assertions may themselves
            # contain URLs and must remain unchanged.
            diagnostics = summary.split('Browser diagnostics',1)[-1]
            self.assertNotIn('private-value',diagnostics)


class FailurePageSnapshotTests(unittest.TestCase):
    """Playwright records what the page actually rendered when a test fails;
    without it a repair only sees the locator it was waiting for."""

    def test_should_extract_the_accessibility_snapshot_from_an_error_context(self):
        from acceptance import page_snapshot
        context = ('# Test info\n\n- Name: x\n\n# Error details\n\n```\nTimeoutError\n```\n\n'
                   '# Page snapshot\n\n```yaml\n- heading "Notes" [level=1]\n- text: Work\n```\n\n'
                   '# Test source\n\n```ts\n  1 | secret-source-line\n```\n')
        snapshot = page_snapshot(context)
        self.assertIn('heading "Notes"', snapshot)
        self.assertIn('text: Work', snapshot)
        # Only the rendered page; the surrounding report is already summarised.
        self.assertNotIn('secret-source-line', snapshot)
        self.assertNotIn('TimeoutError', snapshot)
        self.assertEqual(page_snapshot('no snapshot section here'), '')

    def test_should_extract_the_snapshot_a_failed_expect_leaves_inline(self):
        from acceptance import page_snapshot
        # A failed expect() has no `# Page snapshot` heading; the tree is fenced
        # inside the error details instead.
        context = ('# Error details\n\n```\nexpect(locator).toBeVisible() failed\n```\n\n'
                   '```yaml\n- heading "Settings" [level=1]\n```\n\n'
                   '# Test source\n\n```ts\n  1 | secret-source-line\n```\n')
        self.assertEqual(page_snapshot(context), '- heading "Settings" [level=1]')

    def test_should_bound_a_large_snapshot_on_whole_lines(self):
        from acceptance import page_snapshot
        body = "\n".join(f'- generic [ref=e{n}]: row {n}' for n in range(400))
        snapshot = page_snapshot(f'# Page snapshot\n\n```yaml\n{body}\n```\n', max_chars=200)
        self.assertLessEqual(len(snapshot), 300)
        self.assertTrue(snapshot.startswith('- generic [ref=e0]: row 0'))
        self.assertNotIn('row 399', snapshot)
        for line in snapshot.splitlines():
            self.assertTrue(line.startswith('- generic') or line.startswith('…'), line)

    def test_should_share_the_snapshot_budget_across_a_failing_suite(self):
        from acceptance import RunSummary, TestOutcome
        tree = "\n".join(f'- generic [ref=e{n}]: row {n}' for n in range(400))
        results = [TestOutcome(title=f'REQ-{n}', ok=False, status='timedOut', duration_ms=1,
                               file=f'REQ-{n}.spec.ts', message='TimeoutError', rendered_page=tree)
                   for n in range(8)]
        summary = failure_summaries(RunSummary(passed=0, total=8, results=results),
                                    max_snapshots=8000)
        # Every failure keeps a usable share; none of them takes the whole prompt.
        for n in range(8):
            self.assertIn(f'- Feature: REQ-{n}\n', summary)
        self.assertEqual(summary.count('Page at failure'), 8)
        quoted = sum(len(line) for line in summary.splitlines() if line.startswith('    - generic'))
        self.assertLessEqual(quoted, 8000 + 8 * 200)  # + the four-space quote indent per line

    def test_should_report_the_rendered_page_for_a_real_failure(self):
        from acceptance import AcceptanceRunner
        import os
        install = os.environ.get('OCTOS_TEST_PLAYWRIGHT_ROOT')
        if not install:
            self.skipTest('set OCTOS_TEST_PLAYWRIGHT_ROOT to an installed Playwright root')
        root = Path(install)
        with tempfile.TemporaryDirectory(prefix='page-snapshot-', dir=root) as folder:
            base = Path(folder); specs = base/'source'; specs.mkdir()
            (specs/'labels.spec.ts').write_text("""import {test} from '@playwright/test';
test('remove label from a note',async({page})=>{
 await page.route('http://example.test/**', route=>route.fulfill({status:200,contentType:'text/html',
   body:'<h1>Notes</h1><div>Groceries</div><span>Work</span>'}));
 await page.goto('http://example.test/');
 await page.getByRole('checkbox',{name:/Work/i}).first().click();
});
""")
            runner = AcceptanceRunner(root, specs, base/'prepared', lambda _: None, workers=1)
            result = runner.run(['labels.spec.ts'], 'http://127.0.0.1:1')
            self.assertEqual((result.passed, result.total), (0, 1), result.error)
            summary = failure_summaries(result)
            # The repair has to see that "Work" is plain text, not a checkbox.
            self.assertIn('heading "Notes"', summary)
            self.assertIn('Work', summary.split('Page at failure', 1)[-1])
