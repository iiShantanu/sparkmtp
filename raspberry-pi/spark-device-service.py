#!/usr/bin/env python3
"""
Spark device helper service.

Runs locally on the Raspberry Pi at http://127.0.0.1:8765 and lets the
student web page manage Wi-Fi (via nmcli) and Bluetooth (via bluetoothctl).

Bind address is localhost only — not reachable from the network.
CORS allows the published Lovable URL and localhost.
"""
from __future__ import annotations

import os
import re
import shlex
import subprocess
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

# Origins the kiosk page may be loaded from. The Pi calls back into
# http://127.0.0.1:8765 from whichever origin the browser is on, so every
# valid front-end URL must be listed here or Flask-CORS will reject the
# request and the panels will look like "device service unavailable" even
# though the service is healthy.
#
# Add more origins at deploy time by setting SPARK_ALLOWED_ORIGINS to a
# comma-separated list, e.g.:
#     SPARK_ALLOWED_ORIGINS=https://my-fork.example,https://staging.example
DEFAULT_ALLOWED_ORIGINS = [
    "https://sparkmtp.lovable.app",
    "https://spark.brightstudio.io",
    "https://id-preview--6f1d38b2-3248-4f98-99b3-14092af7ace6.lovable.app",
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:8080",
]
_extra = [o.strip() for o in os.environ.get("SPARK_ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS + _extra

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=False)


def run(cmd: list[str], timeout: int = 15) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError as e:
        return 127, "", str(e)
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


# ---------- health ----------
@app.get("/health")
def health() -> Any:
    return jsonify(ok=True, version="1.0.0")


# ---------- Wi-Fi ----------
@app.get("/wifi/status")
def wifi_status() -> Any:
    code, out, _ = run(["nmcli", "-t", "-f", "ACTIVE,SSID,DEVICE", "device", "wifi"])
    ssid = None
    if code == 0:
        for line in out.splitlines():
            parts = line.split(":")
            if parts and parts[0] == "yes" and len(parts) >= 2:
                ssid = parts[1]
                break
    ip = None
    code, out, _ = run(["hostname", "-I"])
    if code == 0:
        ip = (out.strip().split() or [None])[0]
    return jsonify(connected=bool(ssid), ssid=ssid, ip=ip)


@app.get("/wifi/scan")
def wifi_scan() -> Any:
    run(["nmcli", "device", "wifi", "rescan"], timeout=10)
    code, out, err = run(
        ["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list"]
    )
    if code != 0:
        return jsonify(networks=[], error=err), 500
    seen: set[str] = set()
    networks: list[dict[str, Any]] = []
    for line in out.splitlines():
        # nmcli -t escapes colons inside fields with a backslash. Split safely.
        parts = re.split(r"(?<!\\):", line)
        if len(parts) < 4:
            continue
        in_use, ssid, signal, security = parts[0], parts[1].replace("\\:", ":"), parts[2], parts[3]
        if not ssid or ssid in seen:
            continue
        seen.add(ssid)
        networks.append(
            {
                "ssid": ssid,
                "signal": int(signal) if signal.isdigit() else 0,
                "security": security or "open",
                "in_use": in_use.strip() == "*",
            }
        )
    networks.sort(key=lambda n: n["signal"], reverse=True)
    return jsonify(networks=networks)


@app.post("/wifi/connect")
def wifi_connect() -> Any:
    body = request.get_json(silent=True) or {}
    ssid = (body.get("ssid") or "").strip()
    password = body.get("password") or ""
    if not ssid:
        return jsonify(ok=False, error="ssid required"), 400
    cmd = ["nmcli", "device", "wifi", "connect", ssid]
    if password:
        cmd += ["password", password]
    code, out, err = run(cmd, timeout=30)
    return jsonify(ok=code == 0, error=None if code == 0 else (err or out).strip())


@app.post("/wifi/disconnect")
def wifi_disconnect() -> Any:
    code, _, err = run(["nmcli", "radio", "wifi", "off"])
    run(["nmcli", "radio", "wifi", "on"])
    return jsonify(ok=code == 0, error=err if code != 0 else None)


# ---------- Bluetooth ----------
def bt_cmd(cmds: str, timeout: int = 10) -> tuple[int, str, str]:
    # Pipe a script into bluetoothctl
    try:
        proc = subprocess.run(
            ["bluetoothctl"], input=cmds, capture_output=True, text=True, timeout=timeout
        )
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError as e:
        return 127, "", str(e)
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


@app.get("/bt/status")
def bt_status() -> Any:
    code, out, _ = bt_cmd("show\n")
    powered = "Powered: yes" in out
    code2, devs_out, _ = bt_cmd("devices Connected\n")
    connected = []
    for line in devs_out.splitlines():
        m = re.match(r"^Device\s+([0-9A-F:]{17})\s+(.+)$", line)
        if m:
            connected.append({"mac": m.group(1), "name": m.group(2)})
    return jsonify(powered=powered, connected=connected)


@app.get("/bt/scan")
def bt_scan() -> Any:
    bt_cmd("power on\nagent on\nscan on\n", timeout=8)
    code, out, _ = bt_cmd("devices\n", timeout=5)
    devices: list[dict[str, Any]] = []
    paired_codes = bt_cmd("paired-devices\n")[1]
    paired_macs = set(
        m.group(1)
        for m in re.finditer(r"Device\s+([0-9A-F:]{17})", paired_codes)
    )
    for line in out.splitlines():
        m = re.match(r"^Device\s+([0-9A-F:]{17})\s+(.+)$", line)
        if m:
            mac = m.group(1)
            devices.append({"mac": mac, "name": m.group(2), "paired": mac in paired_macs})
    bt_cmd("scan off\n", timeout=3)
    return jsonify(devices=devices)


@app.post("/bt/pair")
def bt_pair() -> Any:
    mac = (request.get_json(silent=True) or {}).get("mac", "")
    if not re.match(r"^[0-9A-Fa-f:]{17}$", mac):
        return jsonify(ok=False, error="invalid mac"), 400
    code, out, err = bt_cmd(f"pair {mac}\ntrust {mac}\n", timeout=30)
    return jsonify(ok=code == 0, error=err if code != 0 else None)


@app.post("/bt/connect")
def bt_connect() -> Any:
    mac = (request.get_json(silent=True) or {}).get("mac", "")
    if not re.match(r"^[0-9A-Fa-f:]{17}$", mac):
        return jsonify(ok=False, error="invalid mac"), 400
    code, out, err = bt_cmd(f"connect {mac}\n", timeout=15)
    return jsonify(ok=code == 0, error=err if code != 0 else None)


@app.post("/bt/disconnect")
def bt_disconnect() -> Any:
    mac = (request.get_json(silent=True) or {}).get("mac", "")
    code, out, err = bt_cmd(f"disconnect {mac}\n", timeout=10)
    return jsonify(ok=code == 0, error=err if code != 0 else None)


@app.post("/bt/power")
def bt_power() -> Any:
    on = bool((request.get_json(silent=True) or {}).get("on", True))
    code, _, err = bt_cmd(f"power {'on' if on else 'off'}\n")
    return jsonify(ok=code == 0, error=err if code != 0 else None)


if __name__ == "__main__":
    # Bind to localhost only.
    app.run(host="127.0.0.1", port=8765, debug=False)