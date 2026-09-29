#!/usr/bin/env python3
"""freeshare-bridge: plain-HTTP front for an SNI-blocked OpenAI-compatible API.

The direct TLS handshake to freeshare.cc.cd is reset by SNI inspection, but
the same server answers happily when addressed by IP with a Host header
(verified: curl -k https://93.177.76.157 -H 'Host: freeshare.cc.cd' -> 200).
Local agents talk plain HTTP to this bridge; the bridge makes the
IP-direct, SNI-free TLS call. Stdlib only.
"""
import http.client
import http.server
import json
import socket
import ssl
import sys
import threading
import time

UPSTREAM_HOST = "freeshare.cc.cd"
UPSTREAM_IP = "93.177.76.157"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18888
RESOLVE_EVERY = 300.0

_ctx = ssl._create_unverified_context()
_lock = threading.Lock()
_ip, _resolved_at = UPSTREAM_IP, 0.0


def upstream_ip() -> str:
    global _ip, _resolved_at
    with _lock:
        if time.time() - _resolved_at < RESOLVE_EVERY:
            return _ip
        try:
            got = socket.gethostbyname(UPSTREAM_HOST)
            if got:
                _ip = got
        except OSError:
            pass
        _resolved_at = time.time()
        return _ip


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _relay(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ("host", "connection", "content-length")}
        headers["Host"] = UPSTREAM_HOST
        try:
            conn = http.client.HTTPSConnection(upstream_ip(), 443, context=_ctx, timeout=600)
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except (OSError, http.client.HTTPException) as exc:
            payload = json.dumps({"error": f"bridge upstream failure: {exc}"}).encode()
            self.send_response(502)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() in ("transfer-encoding", "connection", "content-length"):
                continue
            self.send_header(k, v)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        conn.close()

    do_GET = do_POST = do_DELETE = do_PUT = do_HEAD = _relay

    def log_message(self, fmt, *args):  # quiet: bridge ops log, not request spam
        pass


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"freeshare-bridge on :{PORT} -> {UPSTREAM_HOST} via {upstream_ip()} (no SNI)",
          flush=True)
    server.serve_forever()
