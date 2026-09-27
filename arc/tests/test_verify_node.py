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
            self.send_error(routes.get(self.path, 404))
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


if __name__ == "__main__":
    unittest.main()
