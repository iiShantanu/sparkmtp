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
- Uses firmware/kernel display rotation as the default source of truth, so the
  official Raspberry Pi Touch Display 2 keeps touch coordinates aligned.
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
The installer manages display rotation for you. By default it writes a
`# >>> spark-display >>>` block to `/boot/firmware/config.txt` setting
`display_lcd_rotate=1` and `display_hdmi_rotate=1` (portrait, 90° clockwise) —
the correct orientation for the 7" Touch Display 2 mounted upright. For the
official Raspberry Pi Touch Display 2, `.xinitrc` does **not** rotate again with
`xrandr` by default, because the firmware/kernel already aligns touch and video.
It still reads the real screen size from `xdpyinfo`, so Chromium opens at the
panel's true dimensions and fills the whole display.

To install for a landscape kiosk instead:

```bash
SPARK_DISPLAY_ROTATE=0 bash setup.sh
```

Valid values: `0` landscape, `1` portrait CW (default), `2` upside-down,
`3` portrait CCW. To change rotation after install, edit the
`# >>> spark-display >>>` block in `/boot/firmware/config.txt` (or re-run
setup with a new `SPARK_DISPLAY_ROTATE`) and reboot.

For third-party HDMI screens that ignore firmware rotation, explicitly enable
the X-layer rotation as well:

```bash
SPARK_XRANDR_ROTATE=match bash setup.sh
```

If the kiosk still renders into only part of the screen:

```bash
DISPLAY=:0 xdpyinfo | grep dimensions   # actual X screen size
DISPLAY=:0 xrandr                       # connected output + current rotation
grep -A4 'spark-display' /boot/firmware/config.txt
```

### Touch-only kiosk (no cursor, correct touch axes)

The installer makes the kiosk truly touch-only:

- **No mouse pointer.** `~/.xserverrc` launches the X server with `-nocursor`,
  so a cursor is never drawn. `unclutter -idle 0` runs as a backup.
- **Touch axes match the rotated display.** On the Raspberry Pi Touch
  Display 2 the kernel/libinput already rotates touch input together with
  the panel, so by default we apply the identity matrix
  (`SPARK_TOUCH_MATRIX=auto`). If you mount a third-party touchscreen whose
  driver does NOT auto-rotate, install with `SPARK_TOUCH_MATRIX=match` so
  `.xinitrc` applies the `xinput` *Coordinate Transformation Matrix* that
  matches `SPARK_DISPLAY_ROTATE`. You can also pass an explicit 9-number
  matrix as the value.

If touch is reversed (vertical finger moves the cursor horizontally) or
buttons don't register where you tap, your axes are wrong. Try, in order:

```bash
# 1. Reset to identity (let the kernel handle rotation)
SPARK_DISPLAY_ROTATE=1 SPARK_XRANDR_ROTATE=auto SPARK_TOUCH_MATRIX=auto sudo -E bash setup.sh && sudo reboot

# 2. For third-party HDMI panels only, apply X rotation too
SPARK_DISPLAY_ROTATE=1 SPARK_XRANDR_ROTATE=match SPARK_TOUCH_MATRIX=auto sudo -E bash setup.sh && sudo reboot

# 3. If that panel's touch driver does not auto-rotate, apply the matching touch matrix
SPARK_DISPLAY_ROTATE=1 SPARK_XRANDR_ROTATE=match SPARK_TOUCH_MATRIX=match sudo -E bash setup.sh && sudo reboot

# 4. Last resort, set an explicit matrix (rotate=1 / right is shown)
SPARK_DISPLAY_ROTATE=1 SPARK_XRANDR_ROTATE=auto SPARK_TOUCH_MATRIX="0 1 0 -1 0 1 0 0 1" sudo -E bash setup.sh && sudo reboot
```

Verify over SSH:

```bash
DISPLAY=:0 xinput --list
DISPLAY=:0 xinput list-props "<your touchscreen name>" | grep "Coordinate Transformation Matrix"
```

If a new touchscreen model is not auto-detected (the matcher looks for names
containing `Touch`, `Touchscreen`, `FT5`, `Goodix`, or `Raspberry Pi`), add its
name to the `case` block in `setup.sh` and re-run the installer.

### "I see the desktop instead of Chromium"
- Re-run `sudo bash setup.sh` — it idempotently re-applies the console autologin
  + `.xinitrc` + `.bash_profile` setup.
- Confirm boot target: `systemctl get-default` → should be `multi-user.target`.
- Confirm tty1 autologin: `cat /etc/systemd/system/getty@tty1.service.d/autologin.conf`.

### Wi-Fi / Bluetooth panels say "device service unavailable"

Almost always a CORS mismatch: the helper service only accepts requests from
origins listed in `ALLOWED_ORIGINS` inside `spark-device-service.py`. The
published kiosk URL (`https://sparkmtp.lovable.app`), the custom domain
(`https://spark.brightstudio.io`), the preview URL, and `localhost` are all
included by default. If you fork the app to a new URL, add it via env var
without editing Python:

```bash
sudo systemctl edit spark-device
# In the editor, add:
# [Service]
# Environment=SPARK_ALLOWED_ORIGINS=https://your-site.example
sudo systemctl restart spark-device
```

Verify from the Pi (replace the Origin with your kiosk URL):

```bash
curl -i -H 'Origin: https://sparkmtp.lovable.app' http://127.0.0.1:8765/health
# Look for: Access-Control-Allow-Origin: https://sparkmtp.lovable.app
```

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