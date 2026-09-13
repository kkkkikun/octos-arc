"""Local pass-through proxy in front of the OpenAI-compatible endpoint.

Why: the octos kernel emits DeepSeek's `reasoning_effort` / `thinking` fields
only for api.deepseek.com URLs, while the ARC proxy (api.arc-bench.com)
honours them too — measured on 2026-09-13: default 455 completion tokens,
`reasoning_effort: low` 279, `thinking: disabled` 132 for the same prompt.
This proxy injects the fields into every chat completion request and logs
the provider's `usage` block per request (exact billed tokens, cache hits).

Pure functions (`inject_reasoning`, `usage_record`) are unit-tested; the
server is stdlib `http.server` on 127.0.0.1 and forwards headers verbatim.
"""

from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOP_HEADERS = {"host", "content-length", "transfer-encoding", "connection", "accept-encoding"}


def inject_reasoning(body: bytes, mode: str) -> bytes:
    """mode: "low"|"medium"|"high" -> reasoning_effort (+ thinking enabled);
    "none"/"off" -> thinking disabled; anything else -> unchanged. Fields the
    client already set are respected."""
    if not mode or mode == "passthrough":
        return body
    try:
        data = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return body
    if not isinstance(data, dict) or "messages" not in data:
        return body
    model = str(data.get("model") or "").lower()
    if "deepseek" not in model:
        return body
    if mode in ("none", "off", "disabled"):
        data.setdefault("thinking", {"type": "disabled"})
        data.pop("reasoning_effort", None)
    else:
        data.setdefault("reasoning_effort", mode)
        data.setdefault("thinking", {"type": "enabled"})
    if data.get("stream"):
        opts = data.get("stream_options") if isinstance(data.get("stream_options"), dict) else {}
        opts.setdefault("include_usage", True)
        data["stream_options"] = opts
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def _usage_from_body(response_body: bytes):
    """JSON body -> its usage dict; SSE body -> usage of the last chunk carrying one."""
    text = response_body.decode("utf-8", errors="replace")
    if text.lstrip().startswith("data:"):
        usage = None
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith("data:") or line == "data: [DONE]":
                continue
            try:
                chunk = json.loads(line[5:].strip())
            except ValueError:
                continue
            if isinstance(chunk, dict) and isinstance(chunk.get("usage"), dict):
                usage = chunk["usage"]
        return usage
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data.get("usage") if isinstance(data, dict) else None


def usage_record(response_body: bytes, elapsed_ms: int, mode: str) -> dict | None:
    usage = _usage_from_body(response_body)
    if not isinstance(usage, dict):
        return None
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()), "elapsed_ms": elapsed_ms, "mode": mode}
    for key in ("prompt_tokens", "completion_tokens", "total_tokens", "prompt_cache_hit_tokens",
                "prompt_cache_miss_tokens"):
        if key in usage:
            rec[key] = usage[key]
    details = usage.get("completion_tokens_details") or {}
    if isinstance(details, dict) and "reasoning_tokens" in details:
        rec["reasoning_tokens"] = details["reasoning_tokens"]
    return rec


class LlmProxy:
    def __init__(self, upstream_base: str, mode: str, log_path: Path | None = None, host: str = "127.0.0.1") -> None:
        self.upstream = upstream_base.rstrip("/")
        self.mode = mode
        self.log_path = log_path
        self._lock = threading.Lock()
        proxy = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):  # silence stderr noise
                pass

            def _forward(self, method: str) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b""
                if method == "POST" and self.path.rstrip("/").endswith("/chat/completions"):
                    body = inject_reasoning(body, proxy.mode)
                headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
                headers["Content-Length"] = str(len(body))
                path = self.path
                if path.startswith("/v1") and proxy.upstream.endswith("/v1"):
                    path = path[3:]
                req = urllib.request.Request(proxy.upstream + path, data=body if body else None,
                                             headers=headers, method=method)
                t0 = time.time()
                try:
                    with urllib.request.urlopen(req, timeout=600) as resp:
                        status, payload, resp_headers = resp.status, resp.read(), resp.headers
                except urllib.error.HTTPError as exc:
                    status, payload, resp_headers = exc.code, exc.read(), exc.headers
                except Exception as exc:  # noqa: BLE001
                    status, payload, resp_headers = 502, json.dumps({"error": {"message": f"proxy: {exc}"}}).encode(), {}
                proxy._log(payload, int((time.time() - t0) * 1000))
                self.send_response(status)
                ctype = resp_headers.get("Content-Type", "application/json") if resp_headers else "application/json"
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self):
                self._forward("POST")

            def do_GET(self):
                self._forward("GET")

        self.server = ThreadingHTTPServer((host, 0), Handler)
        self.server.daemon_threads = True
        self.port = self.server.server_address[1]
        self.base_url = f"http://{host}:{self.port}/v1"
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def _log(self, payload: bytes, elapsed_ms: int) -> None:
        if not self.log_path:
            return
        rec = usage_record(payload, elapsed_ms, self.mode)
        if rec is None:
            return
        with self._lock:
            try:
                with self.log_path.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(rec) + "\n")
            except OSError:
                pass

    def start(self) -> "LlmProxy":
        self._thread.start()
        return self

    def stop(self) -> None:
        try:
            self.server.shutdown()
            self.server.server_close()
        except Exception:  # noqa: BLE001
            pass
