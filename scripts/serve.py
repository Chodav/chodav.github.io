#!/usr/bin/env python3
"""Serve src/ locally and save reading entries to assets/data/reading.json.

Binds to 127.0.0.1 only. GitHub Pages has no write endpoint, so the live
site is read-only. Publishing still requires a git push.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
READING = SRC / "assets" / "data" / "reading.json"
LOCAL_HOSTS = {"127.0.0.1", "localhost"}
MAX_BODY = 200_000
MAX_ENTRIES = 2_000
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
WRITE_LOCK = threading.Lock()


def is_loopback_host(host: str) -> bool:
    return host.strip().lower() in LOCAL_HOSTS


def is_loopback_origin(origin: str) -> bool:
    parsed = urlparse(origin)
    return parsed.scheme == "http" and is_loopback_host(parsed.hostname or "")


def normalize_entry(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    date = str(raw.get("date") or "")
    title = str(raw.get("title") or "").strip()[:160]
    entry_id = str(raw.get("id") or "").strip()
    if not DATE_RE.fullmatch(date) or not title or not ID_RE.fullmatch(entry_id):
        return None
    return {
        "id": entry_id,
        "date": date,
        "title": title,
        "author": str(raw.get("author") or "").strip()[:120],
        "note": str(raw.get("note") or "").strip()[:800],
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SRC), **kwargs)

    def _local_request(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0]
        if not is_loopback_host(host):
            return False
        origin = self.headers.get("Origin")
        if origin is not None and not is_loopback_origin(origin):
            return False
        return True

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/api/reading":
            if not self._local_request():
                self.send_error(403)
                return
            self._send_json({"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/reading":
            self.send_error(404)
            return
        if not self._local_request():
            self.send_error(403)
            return
        origin = self.headers.get("Origin")
        if not origin or not is_loopback_origin(origin):
            self.send_error(403)
            return
        content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            self.send_error(400, "Expected application/json")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid Content-Length")
            return
        if length < 2 or length > MAX_BODY:
            self.send_error(400, "Request too large")
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")
            return
        raw_entries = payload.get("entries") if isinstance(payload, dict) else None
        if not isinstance(raw_entries, list) or len(raw_entries) > MAX_ENTRIES:
            self.send_error(400, "Expected {entries: []}")
            return
        entries = []
        for item in raw_entries:
            normalized = normalize_entry(item)
            if normalized is None:
                self.send_error(400, "Invalid entry")
                return
            entries.append(normalized)
        text = json.dumps({"entries": entries}, indent=2) + "\n"
        with WRITE_LOCK:
            READING.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp_name = tempfile.mkstemp(prefix="reading.", suffix=".tmp", dir=str(READING.parent))
            tmp_path = Path(tmp_name)
            try:
                with open(fd, "w", encoding="utf-8") as handle:
                    handle.write(text)
                    handle.flush()
                tmp_path.replace(READING)
            except Exception:
                tmp_path.unlink(missing_ok=True)
                raise
        self._send_json({"ok": True})

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Serving {SRC} at http://127.0.0.1:{args.port}", flush=True)
    print("Reading entries save to src/assets/data/reading.json", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
