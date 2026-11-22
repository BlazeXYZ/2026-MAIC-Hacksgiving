"""HTTPS fixtures and assertions for the iOS WebView smoke test."""

import json
import ssl
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ORIGIN = "capacitor://localhost"
SURVEY = "/api/v1/intake/survey"
QUEUE = "/api/v1/coordinator/queue"
PLACES = "/api/v1/resources/safe-places"
KEY = "synthetic-staff-key"
seen: set[tuple[str, str]] = set()
failure: str | None = None
done = False


class Handler(BaseHTTPRequestHandler):
    def reply(self, payload: object, status: int = 200) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Coordinator-Key")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.reply({})

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        has_key = self.headers.get("X-Coordinator-Key") == KEY
        if self.headers.get("Origin") == ORIGIN and (path != QUEUE or has_key):
            seen.add(("GET", path))
        if path == QUEUE:
            self.reply({"tickets": [], "counts": {}}, 200 if has_key else 403)
        elif path.endswith("/threads"):
            self.reply({"threads": [], "held_count": 0})
        else:
            self.reply([])

    def do_POST(self) -> None:
        global done, failure
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.headers.get("Origin") == ORIGIN:
            seen.add(("POST", self.path))
        if self.path == "/smoke-result":
            required = {("GET", PLACES), ("POST", SURVEY), ("GET", QUEUE)}
            missing = required - seen
            failure = payload.get("error") or (f"Missing WebView requests: {missing}" if missing else None)
            self.reply({})
            done = True
        elif self.path == SURVEY:
            self.reply({
                "token": "cf-EXAMPL", "status": "pending", "urgency": "today",
                "category": "other", "summary": "Synthetic request",
                "service": {"name": "Sample dispatch", "next_step": "Wait"},
            }, 201)
        else:
            self.reply({"category": "other", "urgency": "today", "summary": "Synthetic request"})


def main(directory: Path) -> None:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(directory / "server.pem", directory / "server.key")
    with HTTPServer(("127.0.0.1", 18443), Handler) as server:
        server.socket = context.wrap_socket(server.socket, server_side=True)
        server.timeout = 1
        started = time.monotonic()
        while not done and time.monotonic() - started < 120:
            server.handle_request()
    if not done or failure:
        raise SystemExit(failure or f"WebView walkthrough timed out. Requests observed: {seen}")
    print("iOS WebView passed HTTPS resources, intake, and staff sign-in.")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
