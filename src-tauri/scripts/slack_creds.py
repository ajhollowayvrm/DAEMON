#!/usr/bin/env python3
"""
Extract Slack credentials from the desktop app's local storage.

Reads:
  - xoxc- client token from Slack's LevelDB (Local Storage)
  - xoxd- "d" cookie from Slack's Cookies SQLite DB (decrypted via macOS Keychain)

Outputs JSON: { "token": "xoxc-...", "cookie": "xoxd-...", "team_id": "...", "user_id": "..." }
"""

import base64
import glob
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import shutil

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding


def get_slack_encryption_key():
    """Get the Slack Safe Storage key from macOS Keychain."""
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "Slack Safe Storage", "-w"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError("Could not get Slack Safe Storage key from Keychain")
    return result.stdout.strip()


def decrypt_cookie(encrypted_value: bytes, key_password: str) -> str:
    """Decrypt a Chromium-encrypted cookie value using PBKDF2 + AES-128-CBC."""
    # Chromium on macOS: "v10" prefix, PBKDF2 with SHA-1, 1003 iterations, 16-byte key
    if not encrypted_value.startswith(b"v10"):
        raise ValueError("Unknown encryption version")

    encrypted_value = encrypted_value[3:]  # strip "v10" prefix
    salt = b"saltysalt"
    iv = b" " * 16  # 16 spaces

    key = hashlib.pbkdf2_hmac("sha1", key_password.encode(), salt, 1003, dklen=16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted_raw = decryptor.update(encrypted_value) + decryptor.finalize()

    # Remove PKCS7 padding
    pad_len = decrypted_raw[-1]
    decrypted_raw = decrypted_raw[:-pad_len]

    # The decrypted bytes may have leading garbage before the actual xoxd- value
    decoded = decrypted_raw.decode("utf-8", errors="ignore")
    xoxd_start = decoded.find("xoxd-")
    if xoxd_start >= 0:
        return decoded[xoxd_start:]

    return decoded


def get_xoxd_cookie():
    """Get and decrypt the xoxd- cookie from Slack's Cookies database."""
    cookies_path = os.path.expanduser("~/Library/Application Support/Slack/Cookies")
    if not os.path.exists(cookies_path):
        raise FileNotFoundError("Slack Cookies database not found")

    # Copy to temp file since Slack may have it locked
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    tmp.close()
    shutil.copy2(cookies_path, tmp.name)

    try:
        conn = sqlite3.connect(tmp.name)
        cursor = conn.execute(
            "SELECT encrypted_value FROM cookies WHERE name = 'd' AND host_key LIKE '%slack%'"
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise RuntimeError("No 'd' cookie found in Slack cookies")

        encrypted_value = row[0]
        key_password = get_slack_encryption_key()
        return decrypt_cookie(encrypted_value, key_password)
    finally:
        os.unlink(tmp.name)


def get_xoxc_token():
    """Extract xoxc- token from Slack's LevelDB local storage."""
    ldb_dir = os.path.expanduser("~/Library/Application Support/Slack/Local Storage/leveldb")
    if not os.path.exists(ldb_dir):
        raise FileNotFoundError("Slack LevelDB storage not found")

    # Search through .ldb files for xoxc tokens
    pattern = re.compile(r"xoxc-[a-zA-Z0-9-]+")
    tokens = set()

    for f in glob.glob(os.path.join(ldb_dir, "*.ldb")):
        try:
            with open(f, "rb") as fh:
                content = fh.read()
                for match in pattern.findall(content.decode("utf-8", errors="ignore")):
                    tokens.add(match)
        except Exception:
            continue

    # Also check .log files
    for f in glob.glob(os.path.join(ldb_dir, "*.log")):
        try:
            with open(f, "rb") as fh:
                content = fh.read()
                for match in pattern.findall(content.decode("utf-8", errors="ignore")):
                    tokens.add(match)
        except Exception:
            continue

    if not tokens:
        raise RuntimeError("No xoxc- token found in Slack storage")

    # Return all found tokens so we can try each one
    return sorted(tokens, key=len, reverse=True)


def get_user_info(token: str, cookie: str):
    """Get team and user info using auth.test."""
    import ssl
    import urllib.request

    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except ImportError:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        "https://slack.com/api/auth.test",
        headers={
            "Authorization": f"Bearer {token}",
            "Cookie": f"d={cookie}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=b"",
    )
    resp = urllib.request.urlopen(req, context=ctx)
    data = json.loads(resp.read())

    if not data.get("ok"):
        raise RuntimeError(f"auth.test failed: {data.get('error', 'unknown')}")

    return {
        "team_id": data.get("team_id", ""),
        "team_name": data.get("team", ""),
        "user_id": data.get("user_id", ""),
        "user_name": data.get("user", ""),
    }


def main():
    try:
        tokens = get_xoxc_token()
        cookie = get_xoxd_cookie()

        # Try each token to find the main workspace (nectar-hr.slack.com)
        # Prefer the production workspace over test workspaces
        best_result = None
        for token in tokens:
            try:
                info = get_user_info(token, cookie)
                result = {
                    "token": token,
                    "cookie": cookie,
                    **info,
                }
                # Prefer non-test workspaces
                if "test" not in info.get("team_name", "").lower():
                    print(json.dumps(result))
                    return
                if best_result is None:
                    best_result = result
            except Exception:
                continue

        if best_result:
            print(json.dumps(best_result))
        else:
            raise RuntimeError("No valid Slack token found")
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
