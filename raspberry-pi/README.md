# Spark — Raspberry Pi Kiosk

Turns a Raspberry Pi into a single-purpose Spark student tablet:

- Boots straight into Chromium full-screen on `https://spark.lovable.app/student`
- Nothing else is reachable to the student
- A small local service (`spark-device-service.py`) exposes Wi-Fi and Bluetooth controls to the student page over `http://127.0.0.1:8765`
- Works offline — UI loads, music/timer/clock work; only AI features need internet

## Hardware

- Raspberry Pi 4 (2 GB+) or Pi 5
- Raspberry Pi OS Bookworm (with desktop) — required for Chromium and NetworkManager
- Speaker (USB or 3.5 mm), USB or built-in mic

## One-time setup

1. Flash Raspberry Pi OS (Bookworm, with desktop) and complete the first-boot wizard with a temporary network.
2. Clone this repo (or copy this `raspberry-pi/` folder) to the Pi:

   ```bash
   git clone <your-fork> ~/spark && cd ~/spark/raspberry-pi
   ```

3. Run the installer (asks for your sudo password):

   ```bash
   bash setup.sh
   ```

4. Reboot. The Pi auto-logs in and Chromium opens the student page in kiosk mode.

## Updating

The kiosk points at the published Lovable URL, so every time you publish in Lovable the Pi gets the update on the next reload (or reboot).

## Files

| File                      | Purpose                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `setup.sh`                | Installs everything: NetworkManager, Bluez, Chromium, the helper service, the kiosk autostart |
| `spark-device-service.py` | Flask app on `127.0.0.1:8765` wrapping `nmcli` and `bluetoothctl`                             |
| `spark-device.service`    | systemd unit that runs the helper on boot                                                     |
| `kiosk.desktop`           | LXDE autostart entry that launches Chromium in kiosk mode                                     |
| `kiosk.sh`                | Chromium launch script (full-screen, no cursor, no errors)                                    |

## Security notes

- The helper binds to `127.0.0.1` only — not reachable from the network.
- CORS allows the published Lovable URL and `http://localhost` only.
- `nmcli` and `bluetoothctl` require the `pi` user to be in the `netdev` and `bluetooth` groups (the installer handles this).
- Do NOT expose port 8765 publicly.

## Manual test (without the Pi)

You can run the helper on any Linux machine to test the panels:

```bash
pip install flask flask-cors
python3 spark-device-service.py
```

Then open the student page — the Wi-Fi/Bluetooth panels will talk to it.
On macOS/Windows the `nmcli`/`bluetoothctl` commands won't exist so calls return errors, but the UI flow is testable.
