import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOK = Path(__file__).resolve().parents[1] / "hooks" / "deny_protected.py"


def run_hook(payload, protected):
    return subprocess.run([sys.executable, str(HOOK), *protected], input=json.dumps(payload),
                          capture_output=True, text=True)


class DenyProtectedHookTests(unittest.TestCase):
    def test_should_deny_writes_inside_protected_dir_and_allow_others(self):
        with tempfile.TemporaryDirectory() as tmp:
            tests = Path(tmp) / "tests"; tests.mkdir()
            denied = run_hook({"event": "before_tool_call", "tool_name": "write_file", "cwd": tmp,
                               "arguments": {"path": "tests/REQ-1.spec.ts", "content": "x"}}, [str(tests)])
            self.assertEqual(denied.returncode, 1)
            self.assertIn("protected", denied.stdout)
            absolute = run_hook({"tool_name": "edit_file", "arguments": {"path": str(tests / "support" / "e2e.ts")}}, [str(tests)])
            self.assertEqual(absolute.returncode, 1)
            allowed = run_hook({"tool_name": "write_file", "cwd": tmp, "arguments": {"path": "backend/server.js"}}, [str(tests)])
            self.assertEqual(allowed.returncode, 0)
            redacted = run_hook({"tool_name": "shell", "arguments": {"redacted": True}}, [str(tests)])
            self.assertEqual(redacted.returncode, 0)


if __name__ == "__main__":
    unittest.main()
