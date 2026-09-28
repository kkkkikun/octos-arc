#!/usr/bin/env python3
"""ofm-shim: prompt-tools bridge for relays that strip the tools parameter.

octos <-> this shim (full OpenAI protocol, tools intact) <-> free relay
(tools parameter dropped on the floor there, so the schemas ride in the
system prompt and tool calls come back as JSON text, repacked here into
standard tool_calls). Kernel unchanged; non-streaming only, which is exactly
how the bundle's env pins it (OCTOS_DISABLE_STREAMING=1)."""
import json
import re
import sys
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RELAY = "http://127.0.0.1:18899"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18898
import time
DEBUG = open("/tmp/ofm-shim.log", "a", buffering=1)
def dlog(msg): DEBUG.write(f"{time.strftime('%H:%M:%S')} {msg}\n")

TOOL_SYSTEM = (
    "You can call functions. Ignore any tools from a default environment "
    "(bash, glob, grep and the like) -- they do not exist here. The ONLY "
    "tools available in this session are:\n{tools}\n"
    "To call one or more functions, reply with ONLY this JSON object and "
    "nothing else (no prose, no markdown fence):\n"
    '{{"tool_calls":[{{"id":"call_1","function":{{"name":"<tool name>",'
    '"arguments":<object>}}}}]}}\n'
    "Reply with plain text only when no function call is needed."
)


def translate_messages_in(msgs, tools):
    out = []
    if tools:
        out.append({"role": "system", "content": TOOL_SYSTEM.format(
            tools=json.dumps([t["function"] for t in tools]))})
    for m in msgs:
        role = m.get("role")
        if role == "assistant" and m.get("tool_calls"):
            calls = [{"name": c["function"]["name"],
                      "arguments": json.loads(c["function"].get("arguments") or "{}")}
                     for c in m["tool_calls"]]
            out.append({"role": "assistant",
                        "content": "<tool_calls>" + json.dumps(calls) + "</tool_calls>"})
        elif role == "tool":
            out.append({"role": "user",
                        "content": f"<tool_result>{m.get('content', '')}</tool_result>"})
        else:
            mm = dict(m)
            if mm.get("role") == "assistant" and isinstance(mm.get("content"), list):
                mm["content"] = " ".join(p.get("text", "") for p in mm["content"] if isinstance(p, dict))
            out.append(mm)
    return out


def parse_tool_calls(content):
    """The relay's models answer with prose-wrapped JSON; find the call list."""
    text = (content or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    cands = [text] + re.findall(r"\{[\s\S]*\}", text)
    # A chatty model buries the call object inside prose: scan balanced braces
    # around every "tool_calls" occurrence as extra candidates.
    for i, ch in enumerate(text):
        if ch == "{" and '"tool_calls"' in text[i:i + 40]:
            depth, j = 0, i
            while j < len(text):
                depth += (text[j] == "{") - (text[j] == "}")
                if depth == 0:
                    cands.append(text[i:j + 1])
                    break
                j += 1
    for cand in cands:
        try:
            obj = json.loads(cand)
        except (ValueError, TypeError):
            continue
        calls = obj.get("tool_calls") if isinstance(obj, dict) else None
        if isinstance(calls, list) and calls:
            packed = []
            for c in calls:
                fn = c.get("function", c)
                args = fn.get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args or "{}")
                packed.append({"id": c.get("id") or f"call_{uuid.uuid4().hex[:8]}",
                               "type": "function",
                               "function": {"name": fn.get("name"),
                                            "arguments": json.dumps(args)}})
            if all(p["function"]["name"] for p in packed):
                return packed
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        dlog(f"{self.command} {self.path} {fmt % args}")

    def _relay(self, data=None):
        headers = {"authorization": self.headers.get("authorization", ""),
                   "content-type": "application/json"}
        req = urllib.request.Request(RELAY + self.path, data=data, headers=headers,
                                     method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def _send(self, code, body):
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        code, body = self._relay()
        self._send(code, body)

    def do_POST(self):
        n = int(self.headers.get("content-length", 0))
        req = json.loads(self.rfile.read(n) or b"{}")
        tools = req.pop("tools", None) or []
        req.pop("tool_choice", None)
        req.pop("stream", None)
        req["messages"] = translate_messages_in(req.get("messages", []), tools)
        code, body = self._relay(json.dumps(req).encode())
        if tools and code == 200:
            try:
                resp = json.loads(body)
                for ch in resp.get("choices", []):
                    msg = ch.get("message", {})
                    calls = parse_tool_calls(msg.get("content"))
                    if calls and tools:
                        known = {t["function"]["name"] for t in tools}
                        calls = [c for c in calls if c["function"]["name"] in known] or None
                    if calls:
                        msg["tool_calls"] = calls
                        msg["content"] = None
                        ch["finish_reason"] = "tool_calls"
                        dlog(f"-> tool_calls {[(c['function']['name'], c['function']['arguments'][:80]) for c in calls]}")
                    elif tools and msg.get("content"):
                        dlog(f"-> no-call parse: {(msg['content'] or '')[:200]!r}")
                body = json.dumps(resp).encode()
            except ValueError:
                pass
        self._send(code, body)


if __name__ == "__main__":
    print(f"ofm-shim on :{PORT} -> {RELAY}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
