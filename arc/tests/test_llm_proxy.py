import json
import unittest

from llm_proxy import inject_reasoning, usage_record


class InjectTests(unittest.TestCase):
    def test_should_add_low_effort_and_thinking_for_deepseek(self):
        out = json.loads(inject_reasoning(json.dumps({"model": "deepseek-v4-flash", "messages": []}).encode(), "low"))
        self.assertEqual(out["reasoning_effort"], "low")
        self.assertEqual(out["thinking"], {"type": "enabled"})

    def test_should_disable_thinking_for_none(self):
        out = json.loads(inject_reasoning(json.dumps({"model": "deepseek-v4-flash", "messages": [], "reasoning_effort": "high"}).encode(), "none"))
        self.assertEqual(out["thinking"], {"type": "disabled"})
        self.assertNotIn("reasoning_effort", out)

    def test_should_leave_other_models_and_non_chat_bodies_alone(self):
        body = json.dumps({"model": "gpt-5", "messages": []}).encode()
        self.assertEqual(inject_reasoning(body, "low"), body)
        self.assertEqual(inject_reasoning(b"not json", "low"), b"not json")
        self.assertEqual(inject_reasoning(json.dumps({"model": "deepseek-v4-flash", "input": "x"}).encode(), "low"),
                         json.dumps({"model": "deepseek-v4-flash", "input": "x"}).encode())

    def test_should_respect_client_set_fields(self):
        out = json.loads(inject_reasoning(json.dumps({"model": "deepseek-v4-flash", "messages": [], "reasoning_effort": "high"}).encode(), "low"))
        self.assertEqual(out["reasoning_effort"], "high")


class UsageTests(unittest.TestCase):
    def test_should_extract_billing_fields(self):
        payload = json.dumps({"usage": {"prompt_tokens": 100, "completion_tokens": 20, "prompt_cache_hit_tokens": 64,
                                        "completion_tokens_details": {"reasoning_tokens": 5}}}).encode()
        rec = usage_record(payload, 123, "low")
        self.assertEqual((rec["prompt_tokens"], rec["completion_tokens"], rec["prompt_cache_hit_tokens"], rec["reasoning_tokens"]), (100, 20, 64, 5))

    def test_should_return_none_without_usage(self):
        self.assertIsNone(usage_record(b'{"choices": []}', 1, "low"))
        self.assertIsNone(usage_record(b"garbage", 1, "low"))
