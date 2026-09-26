#!/usr/bin/env python3

"""Small dependency-free client for the SSApp localhost control API."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def request(base_url, token, path, body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-SSAPP-Token"] = token
    req = urllib.request.Request(
        base_url.rstrip("/") + path,
        data=data,
        headers=headers,
        method="GET" if data is None else "POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            raise RuntimeError(f"SSApp returned HTTP {error.code}: {payload}") from error


def main():
    parser = argparse.ArgumentParser(description="Control Social Stream Ninja through its localhost API.")
    parser.add_argument("operation", choices=["capabilities", "status", "call"])
    parser.add_argument("action", nargs="?", help="API action for the call operation")
    parser.add_argument("--value", default="{}", help="JSON object passed as the command value")
    parser.add_argument("--base-url", default=os.environ.get("SSAPP_CONTROL_URL", "http://127.0.0.1:17777"))
    parser.add_argument("--token", default=os.environ.get("SSAPP_CONTROL_TOKEN", ""))
    parser.add_argument("--token-file", default=os.environ.get("SSAPP_CONTROL_TOKEN_FILE", ""))
    args = parser.parse_args()

    if not args.token and args.token_file:
        try:
            with open(os.path.expanduser(args.token_file), "r", encoding="utf-8") as token_file:
                args.token = token_file.read().strip()
        except OSError as error:
            parser.error(f"cannot read token file: {error}")
    if args.operation == "capabilities":
        result = request(args.base_url, args.token, "/api/v1/capabilities")
    elif args.operation == "status":
        result = request(args.base_url, args.token, "/api/v1/status")
    else:
        if not args.action:
            parser.error("call requires an action")
        try:
            value = json.loads(args.value)
        except json.JSONDecodeError as error:
            parser.error(f"--value must be valid JSON: {error}")
        result = request(args.base_url, args.token, "/api/v1/command", {"action": args.action, "value": value})

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
