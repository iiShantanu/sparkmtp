# Spark Raspberry Pi Kiosk

Turns a Raspberry Pi (Pi 4B + Raspberry Pi Touch Display 2, Bookworm 32/64-bit) into a
single-purpose Spark tablet. After install the device boots straight into Chromium
pointed at `https://sparkmtp.lovable.app/student` — no Raspberry Pi desktop, no
keyring prompts, no info bars. SSH stays on so you can always recover.

## What you get

```
Power On
   ↓
Console autologin (tty1)
   ↓
startx (from ~/.bash_profile)
   ↓
~/.xinitrc → Chromium --kiosk
   ↓
https://sparkmtp.lovable.app/student
```

Plus a small local helper service (`spark-device.service`) on
`http://127.0.0.1:8765` that the student page uses for Wi-Fi/Bluetooth controls.

## Fresh install

1. Flash **Raspberry Pi OS Bookworm** (Lite or Desktop, 32 or 64-bit) with Raspberry Pi Imager.
2. In Imager's advanced options set: hostname, **your** username + password, locale, Wi-Fi, and **enable SSH**.
3. Boot the Pi, log in (locally or over SSH), then run:

   ```bash
   git clone <this-repo-url> spark
   cd spark/raspberry-pi
   bash setup.sh
   sudo reboot
   ```

The installer:

- Detects the current user automatically (never assumes `pi`).
- Installs Chromium, X, `python3`, `flask`, `flask-cors`, NetworkManager, BlueZ.
- Copies `spark-device-service.py` to `/opt/spark/` and registers
  `spark-device.service` with `User=<your user>`.
- Adds your user to `netdev` and `bluetooth`.
- Removes `gnome-keyring` and stale `~/.local/share/keyrings` so Chromium never
  prompts for an unlock password (`--password-store=basic`).
- Switches boot target to **console autologin** on tty1 and writes
  `~/.xinitrc` + a guarded `~/.bash_profile` block that runs `startx`.
- Verifies the device service is up (`systemctl is-active`,
  `curl http://127.0.0.1:8765`, `ss -tulpn | grep 8765`) and aborts loudly on failure.
- Prints a summary with username, IP address, and all service statuses.

## Recovery mode (skip kiosk on next boot)

SSH into the Pi and create:

```bash
echo 'export SPARK_DISABLE_KIOSK=1' | sudo tee /etc/profile.d/spark-recovery.sh
sudo reboot
```

The Pi will autologin to tty1 and stay at a shell prompt. Remove the file to
re-enable kiosk:

```bash
sudo rm /etc/profile.d/spark-recovery.sh
sudo reboot
```

You can also press `Ctrl+Alt+F2` to switch to another tty and log in normally.

## SSH recovery

SSH is **always enabled** by the installer and never disabled. From any machine
on the same network:

```bash
ssh <your-user>@<pi-ip>
```

If you forgot the IP, check your router, or attach a keyboard and run
`hostname -I` on tty1.

## Verification commands

```bash
systemctl is-active ssh
systemctl is-active spark-device
systemctl is-active NetworkManager
systemctl is-active bluetooth
curl http://127.0.0.1:8765/        # device helper API
ss -tulpn | grep 8765              # port 8765 listening
journalctl -u spark-device -n 100 --no-pager
nmcli device status                # Wi-Fi via NetworkManager
bluetoothctl show                  # Bluetooth adapter info
```

## Troubleshooting

### Device service won't start
- `journalctl -u spark-device -n 200 --no-pager`
- Confirm `/opt/spark/spark-device-service.py` exists and is owned by your user.
- Confirm Flask is importable: `python3 -c "import flask, flask_cors"`.
- Restart: `sudo systemctl restart spark-device`.

### Wi-Fi panel in the app does nothing
- `nmcli device wifi list` should show networks.
- Make sure your user is in `netdev`: `groups | tr ' ' '\n' | grep netdev`.
- A logout/login (or reboot) is required after the installer adds the group.
- `systemctl status NetworkManager` should be `active (running)`.

### Bluetooth panel in the app does nothing
- `systemctl status bluetooth` should be `active (running)`.
- `rfkill list` — if Bluetooth is blocked: `sudo rfkill unblock bluetooth`.
- Group: `groups | tr ' ' '\n' | grep bluetooth`.

### Chromium shows "Keyring" / "Unlock login" popup
The installer removes `gnome-keyring`. If you reinstall a desktop later and the
popup returns:

```bash
sudo apt purge -y gnome-keyring
rm -rf ~/.local/share/keyrings
sudo reboot
```

Chromium is launched with `--password-store=basic`, so it never talks to a
system keyring.

### Raspberry Pi Touch Display 2 — important
Do **not** edit `/boot/firmware/config.txt` or `/boot/firmware/cmdline.txt`
with `display_rotate`, `framebuffer_width`, `framebuffer_height`, `video=DSI-1`,
or `rotate=`. During testing these caused framebuffer corruption and
half-screen rendering on the official Touch Display 2. The installer leaves
display configuration completely untouched. Rotate via the desktop settings
only if you are running a desktop session for another purpose.

### "I see the desktop instead of Chromium"
- Re-run `sudo bash setup.sh` — it idempotently re-applies the console autologin
  + `.xinitrc` + `.bash_profile` setup.
- Confirm boot target: `systemctl get-default` → should be `multi-user.target`.
- Confirm tty1 autologin: `cat /etc/systemd/system/getty@tty1.service.d/autologin.conf`.

### Reset everything
```bash
sudo systemctl set-default graphical.target   # restore normal desktop boot
sudo rm /etc/systemd/system/getty@tty1.service.d/autologin.conf
sudo systemctl disable spark-device
sudo rm /etc/systemd/system/spark-device.service
sudo rm -rf /opt/spark
sudo reboot
```

## Files in this directory

| File | Purpose |
| --- | --- |
| `setup.sh` | One-shot installer (idempotent, run with `bash setup.sh`). |
| `spark-device-service.py` | Local Flask API on `:8765` used by the student page. |
| `spark-device.service.template` | systemd unit; `__SPARK_USER__` is replaced at install time. |
| `README.md` | This file. |