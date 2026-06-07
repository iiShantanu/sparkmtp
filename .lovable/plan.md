## Root cause

The Raspberry Pi is fine — Wi-Fi/Bluetooth, NetworkManager, BlueZ, the helper service, and the API are all running. The problem is **CORS** in `raspberry-pi/spark-device-service.py`.

`ALLOWED_ORIGINS` currently lists:

```python
ALLOWED_ORIGINS = [
    "https://bloom-classroom-hub.lovable.app",                          # old project URL
    "https://id-preview--6f1d38b2-3248-4f98-99b3-14092af7ace6.lovable.app",  # preview only
    "http://localhost",
    "http://127.0.0.1",
]
```

The kiosk loads `https://sparkmtp.lovable.app/student` (the current published URL). That origin is **not** in the allow-list, so when the browser calls `http://127.0.0.1:8765/wifi/status`, Flask-CORS rejects it. The browser surfaces it as a network failure, `deviceBridge` throws `DeviceBridgeUnavailable`, and the panels display the "not available outside kiosk" message — even though the service is actually up.

That's why every status check in the installer summary passes but the panels stay empty.

---

## Fix (Raspberry Pi only)

### `raspberry-pi/spark-device-service.py`

Update `ALLOWED_ORIGINS` to include the real published URL and any future custom domain, and make it overridable via env var so we never have to edit Python again:

```python
DEFAULT_ALLOWED_ORIGINS = [
    "https://sparkmtp.lovable.app",
    "https://spark.brightstudio.io",
    "https://id-preview--6f1d38b2-3248-4f98-99b3-14092af7ace6.lovable.app",
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:8080",
]
extra = [o.strip() for o in os.environ.get("SPARK_ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS + extra
```

Drop the stale `bloom-classroom-hub.lovable.app` entry.

### `raspberry-pi/README.md`

Add a short "Allowed origins" note explaining how to add an extra origin via `SPARK_ALLOWED_ORIGINS=https://your-site.example systemctl edit spark-device` if anyone forks the app to a new URL.

---

## What the user needs to do after the fix

On the Pi:

```bash
cd ~/spark && git pull
sudo bash raspberry-pi/setup.sh          # re-copies the updated python file
sudo systemctl restart spark-device
```

Then refresh the kiosk page — the Wi-Fi and Bluetooth panels will start working.

---

## What stays the same

- Web app code, virtual keyboard, display rotation, cursor hiding — untouched.
- Port (`8765`), API shape, bridge client — unchanged.
- Recovery flow — unchanged.
