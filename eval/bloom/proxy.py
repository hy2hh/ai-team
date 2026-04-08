#!/usr/bin/env python3
"""
Local Anthropic API proxy — routes LiteLLM requests to `claude -p` CLI.
Enables Bloom to run on Claude subscription credits without an API key.

Usage:
  python proxy.py              # default port 8765
  python proxy.py --port 9000  # custom port
"""

import argparse
import json
import subprocess
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer


def map_model(model_id: str) -> str:
    """Map Anthropic model ID to claude CLI model name."""
    model_lower = model_id.lower()
    if "opus" in model_lower:
        return "opus"
    if "haiku" in model_lower:
        return "haiku"
    return "sonnet"


def extract_text(content) -> str:
    """Extract plain text from Anthropic message content."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return str(content)


def build_prompt(system: str, messages: list) -> tuple[str, str]:
    """Build system prompt and user prompt from Anthropic messages format.

    Returns (system_prompt, user_prompt) for claude -p CLI.
    For multi-turn conversations, prior history is prepended to system prompt.
    """
    # Separate conversation into history + last user message
    if not messages:
        return system, ""

    last_msg = messages[-1]
    history = messages[:-1]

    # Build system prompt with history
    sys_parts = []
    if system:
        sys_parts.append(system)

    if history:
        sys_parts.append("\n=== Conversation History ===")
        for msg in history:
            role = msg.get("role", "unknown").capitalize()
            text = extract_text(msg.get("content", ""))
            sys_parts.append(f"{role}: {text}")
        sys_parts.append("=== End History ===\n")
        sys_parts.append("Continue the conversation naturally. Respond to the latest message.")

    system_prompt = "\n".join(sys_parts)
    user_prompt = extract_text(last_msg.get("content", ""))

    return system_prompt, user_prompt


class ProxyHandler(BaseHTTPRequestHandler):
    """Handle Anthropic Messages API requests."""

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[proxy] {args[0]}", flush=True)

    def do_POST(self):
        if self.path != "/v1/messages":
            self.send_error(404, f"Not found: {self.path}")
            return

        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        model = body.get("model", "claude-sonnet-4-20250514")
        system = body.get("system", "")
        messages = body.get("messages", [])
        max_tokens = body.get("max_tokens", 4096)

        # Handle system as list of content blocks
        if isinstance(system, list):
            system = extract_text(system)

        model_name = map_model(model)
        system_prompt, user_prompt = build_prompt(system, messages)

        print(f"[proxy] model={model_name} messages={len(messages)} system={len(system_prompt)}c prompt={len(user_prompt)}c", flush=True)

        # Call claude -p
        cmd = [
            "claude", "-p", user_prompt,
            "--no-session-persistence",
            "--model", model_name,
        ]
        if system_prompt:
            cmd.extend(["--system-prompt", system_prompt])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )
            response_text = result.stdout.strip()
            if not response_text and result.stderr:
                print(f"[proxy] stderr: {result.stderr[:200]}", flush=True)
                response_text = f"[Error from claude CLI: {result.stderr[:200]}]"
        except subprocess.TimeoutExpired:
            response_text = "[Error: claude -p timed out after 300s]"
        except Exception as e:
            response_text = f"[Error: {e}]"

        # Build Anthropic API response
        response = {
            "id": f"msg_{uuid.uuid4().hex[:24]}",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": response_text}],
            "model": model,
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {
                "input_tokens": len(user_prompt) // 4,  # rough estimate
                "output_tokens": len(response_text) // 4,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
            },
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("x-request-id", f"req_{uuid.uuid4().hex[:24]}")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())


def main():
    parser = argparse.ArgumentParser(description="Anthropic API proxy for claude -p CLI")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), ProxyHandler)
    print(f"[proxy] Anthropic API proxy running on http://127.0.0.1:{args.port}", flush=True)
    print(f"[proxy] Routes /v1/messages → claude -p CLI", flush=True)
    print(f"[proxy] Ctrl+C to stop", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[proxy] Shutting down", flush=True)
        server.server_close()


if __name__ == "__main__":
    main()
