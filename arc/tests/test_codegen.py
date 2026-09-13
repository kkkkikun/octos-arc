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
