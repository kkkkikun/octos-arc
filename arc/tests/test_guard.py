import unittest

from guard import TurnMonitor


def started(name, args, call_id="c1"):
    return "tool/started", {"tool_call_id": call_id, "tool_name": name, "arguments": args}


def completed(call_id, success, preview=""):
    return "tool/completed", {"tool_call_id": call_id, "success": success, "output_preview": preview}


class TurnMonitorTests(unittest.TestCase):
    def test_should_flag_completion_claim_without_verification_commands(self):
        m = TurnMonitor(protected_prefixes=[".arc/", "requirements/"])
        m.observe(*started("write_file", {"path": "backend/server.js"}))
        m.observe(*completed("c1", True))
        m.finish("Done. The feature is fully implemented and verified. ✅")
        self.assertIn("claimed completion without running", " ".join(m.corrections()))

    def test_should_not_flag_when_build_and_curl_ran(self):
        m = TurnMonitor(protected_prefixes=[])
        m.observe(*started("bash", {"cmd": "cd frontend && npm run build"}, "c1"))
        m.observe(*completed("c1", True))
        m.observe(*started("bash", {"cmd": "curl -s http://127.0.0.1:43101/api/count"}, "c2"))
        m.observe(*completed("c2", True))
        m.finish("Implemented and verified.")
        self.assertEqual(m.corrections(), [])

    def test_should_flag_three_identical_consecutive_errors(self):
        m = TurnMonitor(protected_prefixes=[])
        for i in range(3):
            m.observe(*started("bash", {"cmd": "node backend/server.js"}, f"c{i}"))
            m.observe(*completed(f"c{i}", False, "Error: listen EADDRINUSE :::43101"))
        m.finish("")
        self.assertTrue(any("same error 3 times" in c for c in m.corrections()))

    def test_should_flag_writes_into_protected_paths(self):
        m = TurnMonitor(protected_prefixes=[".arc/", "requirements/", "/abs/tests/"])
        m.observe(*started("edit_file", {"path": "/abs/tests/REQ-1.spec.ts"}, "c1"))
        m.observe(*completed("c1", True))
        m.observe(*started("bash", {"cmd": "echo x > requirements/requirements.yaml"}, "c2"))
        m.observe(*completed("c2", True))
        m.finish("ok")
        joined = " ".join(m.corrections())
        self.assertIn("/abs/tests/REQ-1.spec.ts", joined)
        self.assertIn("requirements/", joined)

    def test_should_allow_design_file_inside_protected_arc_dir(self):
        m = TurnMonitor(protected_prefixes=[".arc/"], allowed_prefixes=[".arc/design/"])
        m.observe(*started("write_file", {"path": ".arc/design/REQ-1.json"}, "c1"))
        m.observe(*completed("c1", True))
        m.observe(*started("write_file", {"path": ".arc/traceability/node_states.json"}, "c2"))
        m.observe(*completed("c2", True))
        m.finish("")
        self.assertEqual(m.protected_writes, [".arc/traceability/node_states.json"])

    def test_should_not_require_verification_for_design_turns(self):
        m = TurnMonitor(protected_prefixes=[], expect_verification=False)
        m.observe(*started("write_file", {"path": ".arc/design/REQ-1.json"}))
        m.observe(*completed("c1", True))
        m.finish("Design complete.")
        self.assertEqual(m.corrections(), [])

    def test_should_report_no_files_written_when_only_reading(self):
        m = TurnMonitor(protected_prefixes=[])
        m.observe(*started("read_file", {"path": "backend/server.js"}, "c1"))
        m.observe(*completed("c1", True))
        m.finish("Here is my plan...")
        self.assertFalse(m.wrote_files)


if __name__ == "__main__":
    unittest.main()
