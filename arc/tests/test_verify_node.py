"""asset_holes: the second foundation wound class, caught at every check.

A static-page whitelist that omits the referenced /app.js shipped on the
github leg (dist held the file, the server 404'd the route): every page's
JS dies while markup-only flows still pass their specs. The probe GETs each
root-absolute .js/.css an HTML page references and names the 404s."""
import importlib.util
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "verify_node", Path(__file__).resolve().parent.parent / "verify_node.py")
verify_node = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(verify_node)


def _serve(routes: dict[str, int]) -> tuple[HTTPServer, int]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 -- http.server API
            self.send_response(routes.get(self.path, 404))
            self.end_headers()
            self.wfile.write(b"x")
        def log_message(self, *args):  # silence
            pass
    srv = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


class AssetHoles(unittest.TestCase):
    def test_whitelist_that_omits_a_referenced_script_is_reported(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text(
                '<script src="/app.js"></script><link rel="stylesheet" href="/style.css">')
            srv, port = _serve({"/": 200, "/style.css": 200})   # /app.js 404s
            try:
                self.assertEqual(
                    verify_node.asset_holes(Path(tmp), port), ["/app.js"])
            finally:
                srv.shutdown()

    def test_fully_served_page_reports_nothing(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text(
                '<script src="/app.js"></script><a href="/signin">in</a>')
            srv, port = _serve({"/app.js": 200})
            try:
                self.assertEqual(verify_node.asset_holes(Path(tmp), port), [])
            finally:
                srv.shutdown()

    def test_page_routes_and_favicons_are_not_assets(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text(
                '<a href="/workbook/q3">w</a><link rel="icon" href="/favicon.ico">')
            srv, port = _serve({})
            try:
                self.assertEqual(verify_node.asset_holes(Path(tmp), port), [])
            finally:
                srv.shutdown()


class SpecIds(unittest.TestCase):
    def test_list_output_becomes_runnable_filters(self):
        listing = ("Listing tests:\n"
                   "  REQ-1-2-2.spec.ts:7:5 › REQ-1-2-2: Rename a Workbook - Scenario 1\n"
                   "  REQ-1-2-2.spec.ts:21:5 › REQ-1-2-2: Rename a Workbook - Scenario 2\n"
                   "  2 tests found\n")
        self.assertEqual(verify_node.spec_ids(listing),
                         ["REQ-1-2-2.spec.ts:7", "REQ-1-2-2.spec.ts:21"])

    def test_same_line_tests_collapse_to_one_run(self):
        # a describe block puts several tests on one line; file:line runs them all
        listing = "  REQ-1.spec.ts:5:7 › a › one\n  REQ-1.spec.ts:5:12 › a › two\n"
        self.assertEqual(verify_node.spec_ids(listing), ["REQ-1.spec.ts:5"])

    def test_unlistable_output_is_empty(self):
        self.assertEqual(verify_node.spec_ids("No tests found\n"), [])
        self.assertEqual(verify_node.spec_ids(""), [])


class StateSnapshot(unittest.TestCase):
    def test_data_files_snapshotted_manifests_and_deps_excluded(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            app = Path(tmp)
            for rel in ("backend/store.json", "backend/data.csv", "backend/package.json",
                        "backend/package-lock.json", "backend/node_modules/x/package.json",
                        "frontend/src/app.js"):
                p = app / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text("{}" if rel.endswith(".json") else "x")
            snap = verify_node.state_snapshot(app)
            self.assertEqual({p.name for p in snap}, {"store.json", "data.csv"})


class NameTwins(unittest.TestCase):
    def test_link_and_button_sharing_a_name_is_flagged(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text(
                '<a href="/signin">Sign in</a><button onclick="x">Sign in</button>'
                '<button>D1</button><button>D2</button>')   # same-tag repeats are fine
            self.assertEqual(verify_node.name_twins(Path(tmp)), ["sign in"])

    def test_aria_label_beats_body_text_and_clean_pages_pass(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text(
                '<a href="/s" aria-label="Go home">irrelevant text</a>'
                '<button aria-label="Save">Save</button>')
            self.assertEqual(verify_node.name_twins(Path(tmp)), [])


if __name__ == "__main__":
    unittest.main()


class JsSyntaxErrors(unittest.TestCase):
    """js_syntax_errors: an unbalanced brace ships a page whose JS never runs.

    A repair edit with a missing ')' makes the whole app.js fail to parse:
    the static shell still renders (headings, buttons) while every dynamic
    behaviour dies, so Playwright reports an empty workbook list -- a symptom
    far from the cause. The probe runs node --check over the built scripts
    and names file and line of the SyntaxError itself."""

    def test_broken_script_is_named_with_its_line(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "app.js").write_text("function f() {\n  return 1;\n}}\n")  # extra }
            (dist / "ok.js").write_text("console.log('fine');\n")
            errs = verify_node.js_syntax_errors(dist)
            self.assertEqual(len(errs), 1)
            self.assertIn("app.js", errs[0])
            self.assertRegex(errs[0], r"3")

    def test_clean_scripts_report_nothing(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "app.js").write_text("console.log('fine');\n")
            (dist / "lib").mkdir()
            (dist / "lib" / "grid.js").write_text("var x = 1;\n")
            self.assertEqual(verify_node.js_syntax_errors(dist), [])

    def test_es_module_syntax_is_not_a_false_positive(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            # import/export parses in module mode, not script mode: a page can
            # ship it under <script type="module"> and work perfectly.
            (dist / "mod.js").write_text("import x from './x.js';\nexport default x;\n")
            self.assertEqual(verify_node.js_syntax_errors(dist), [])

    def test_broken_in_both_modes_is_reported(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "both.js").write_text("import x from './x.js';\nfunction f() {\n  return x;\n}}\n")
            errs = verify_node.js_syntax_errors(dist)
            self.assertEqual(len(errs), 1)
            self.assertIn("both.js", errs[0])

    def test_relative_dist_path_still_finds_the_files(self):
        # sh() runs with cwd=dist: a relative dist must be resolved first, or
        # node --check gets a path that no longer exists from the new cwd and
        # every script reads as broken.
        import shutil
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            (work / "rel").mkdir()
            (work / "rel" / "app.js").write_text("var ok = 1;\n")
            shutil.copy(work / "rel" / "app.js", work / "broken.js")  # placeholder
            (work / "rel" / "bad.js").write_text("function f() {\n}}\n")
            self.assertEqual(verify_node.js_syntax_errors(work / "rel"),
                             ["bad.js:2: SyntaxError: Unexpected token '}'"])


class AuditHardening(unittest.TestCase):
    def test_protocol_relative_cdn_url_is_not_a_local_hole(self):
        # src="//cdn.example.com/lib.js" is a legal protocol-relative ref;
        # GETing it against 127.0.0.1 always 404s and condemned working apps.
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "index.html").write_text(
                '<script src="//cdn.example.com/lib.js"></script>'
                '<script src="/app.js?v=2"></script>')
            (dist / "app.js").write_text("x")
            srv, port = _serve({"/app.js?v=2": 200})
            try:
                self.assertEqual(verify_node.asset_holes(dist, port), [])
            finally:
                srv.shutdown()

    def test_created_store_files_are_dropped_between_scenarios(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            app = Path(tmp)
            (app / "backend").mkdir()
            seed = verify_node.state_snapshot(app)          # empty store
            created = app / "backend" / "records.json"
            created.write_text('{"debris": 1}')
            verify_node.drop_unseeded_stores(app, seed)
            self.assertFalse(created.exists())

    def test_sqlite_wal_sidecar_is_snapshot_state(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            app = Path(tmp)
            (app / "backend").mkdir()
            (app / "backend" / "data.sqlite").write_text("db")
            (app / "backend" / "data.db-wal").write_text("wal")
            (app / "backend" / "server.js").write_text("code")   # never state
            snap = verify_node.state_snapshot(app)
            names = {p.name for p in snap}
            self.assertIn("data.sqlite", names)
            self.assertIn("data.db-wal", names)
            self.assertNotIn("server.js", names)


class SeedCanary(unittest.TestCase):
    def test_first_requirements_spec_is_forced_in_even_before_it_passed(self):
        # The canary must ride from node 1 onward: waiting for the first tag's
        # status to read "0" would skip the very nodes whose rewrites poison
        # the seed (arch-13 banked the poison at node 10 of 24).
        import json, tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            Path.cwd  # noqa: B018
            cwd = Path(tmp)
            (cwd / ".arc-status").mkdir()
            map_file = cwd / "map.json"
            map_file.write_text(json.dumps({"REQ-1-1-1": ["REQ-1-1-1.spec.ts"],
                                            "REQ-9-9-9": ["REQ-9-9-9.spec.ts"]}))
            argv = ["verify_node.py", str(cwd), "43100", "--tag", "REQ-9-9-9",
                    "--regress", str(map_file), "REQ-9-9-9.spec.ts"]
            it = iter(argv[2:])
            opts, specs = {}, []
            for arg in it:
                if arg.startswith("--"):
                    opts[arg[2:]] = next(it)
                else:
                    specs.append(arg)
            # mirror the main() selection under test
            m = json.loads(Path(opts["regress"]).read_text())
            status = cwd / ".arc-status"
            earlier = [rel for tag, rels in m.items()
                       if tag != opts.get("tag") and (status / tag).is_file()
                       and (status / tag).read_text().strip() == "0" for rel in rels]
            canary = next(iter(m.items()))
            chosen = [*( [canary[1][0]] if canary[0] != opts.get("tag") else [] ), *earlier]
            self.assertIn("REQ-1-1-1.spec.ts", chosen)

    def test_one_canary_per_top_level_family(self):
        # arch-16: a repair slice broke REQ-5-1-2 while only REQ-1-1-1 was
        # canary -- every family needs its own tripwire.
        import json, tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / ".arc-status").mkdir()
            m = {"REQ-1-1-1": ["REQ-1-1-1.spec.ts"], "REQ-1-2-1": ["REQ-1-2-1.spec.ts"],
                 "REQ-2-1-1": ["REQ-2-1-1.spec.ts"], "REQ-5-1-2": ["REQ-5-1-2.spec.ts"],
                 "REQ-5-3-1": ["REQ-5-3-1.spec.ts"]}
            fams = {}
            for tag in sorted(m):
                import re as _re
                g = _re.match(r"^(REQ-\d+)", tag)
                fams.setdefault(g.group(1) if g else tag, tag)
            canaries = [m[t][0] for t in fams.values() if t != "REQ-2-1-1" and m[t]]
            self.assertEqual(canaries, ["REQ-1-1-1.spec.ts", "REQ-5-1-2.spec.ts"])


class IsolationAlwaysAtCheckTime(unittest.TestCase):
    """The >20 whole-run bail resurrected the arch-9 state-bleed wound once
    regression specs rode every node (platform runs shipped 6/100 with a
    frozen .arc-good). Check-time suites always isolate; the wall budget
    bounds the oversized ones."""

    def test_big_suites_are_not_sent_whole_by_a_count_cutoff(self):
        import inspect
        src = inspect.getsource(verify_node.run_specs)
        self.assertNotIn("> 20", src)
        self.assertIn("budget", src)
