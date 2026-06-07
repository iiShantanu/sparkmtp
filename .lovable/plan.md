
## Why only half the screen shows

On the Raspberry Pi 7" Touch Display 2 in portrait mode, three things compound:

1. The display panel is natively landscape (e.g. 1280×720 or 720×1280 depending on firmware). Without an explicit rotation in `/boot/firmware/config.txt`, the X server comes up landscape while the panel is mounted portrait.
2. `startx` launches Chromium before any `xrandr` rotation/resize is applied, so Chromium captures the original (landscape) framebuffer size.
3. Chromium `--kiosk --start-fullscreen` then opens a window matching that stale size, which on a rotated panel covers only the top/left half of the visible area.

The web app itself is fine — `src/routes/student.tsx` already uses `h-screen` / `w-full` and the panels fill the viewport. The remaining work is on the Pi, with one small CSS guard for safety.

## Changes

### 1. `raspberry-pi/setup.sh` — robust display setup

- Add a new step (before the `.xinitrc` step) that ensures `/boot/firmware/config.txt` (and legacy `/boot/config.txt`) contains a Spark-managed block:
  ```
  # >>> spark-display >>>
  disable_overscan=1
  display_lcd_rotate=1     # portrait for the official DSI touch display
  display_hdmi_rotate=1    # same orientation when HDMI is used
  # <<< spark-display <<<
  ```
  Idempotent: only inserted if the markers aren't already present. Re-running setup updates the block in place.
- Make the rotation configurable via an env var `SPARK_DISPLAY_ROTATE` (default `1` = 90° portrait; `0` keeps landscape) so the same script works on landscape kiosks too.

### 2. `raspberry-pi/setup.sh` — rewrite `.xinitrc` to size Chromium to the actual screen

Replace the current `.xinitrc` template with:

```sh
#!/bin/sh
xset s off -dpms s noblank

# Apply rotation at the X layer too (covers HDMI users where display_*_rotate
# isn't honored). Safe no-op if already correctly oriented.
PRIMARY="$(xrandr | awk '/ connected/ {print $1; exit}')"
if [ -n "$PRIMARY" ]; then
  xrandr --output "$PRIMARY" --rotate right >/dev/null 2>&1 || true
fi

# Read the real, post-rotation screen size from xdpyinfo so Chromium opens
# at the true panel dimensions instead of guessing.
DIMS="$(xdpyinfo | awk '/dimensions:/ {print $2; exit}')"   # e.g. 720x1280
SCREEN_W="${DIMS%x*}"
SCREEN_H="${DIMS#*x}"

command -v unclutter >/dev/null 2>&1 && unclutter -idle 1 -root &

CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium)"

exec "$CHROMIUM_BIN" \
  --password-store=basic \
  --kiosk \
  --start-fullscreen \
  --window-position=0,0 \
  --window-size=${SCREEN_W},${SCREEN_H} \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --hide-scrollbars \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --noerrdialogs \
  --check-for-update-interval=31536000 \
  https://sparkmtp.lovable.app/student
```

Install `x11-utils` (provides `xdpyinfo`) alongside the other X packages so the size detection works.

### 3. `raspberry-pi/setup.sh` — verification block

Add to the final summary:
- Print `Display Rotation:` (value written to config.txt)
- Print `Screen Size (post-X):` by running `DISPLAY=:0 xdpyinfo` if an X session is already up; otherwise note "Available after reboot".

### 4. `raspberry-pi/README.md` — short addendum

Add a "Display orientation" section explaining:
- Default is portrait (`SPARK_DISPLAY_ROTATE=1`).
- To run landscape: `SPARK_DISPLAY_ROTATE=0 bash setup.sh`.
- To change after install: edit the `# >>> spark-display >>>` block in `/boot/firmware/config.txt` and reboot.
- Troubleshooting steps if the kiosk still appears partial (check `xdpyinfo`, check `xrandr`, confirm the config block is present).

### 5. `src/styles.css` — small viewport safety net

Add a defensive rule so even if Chromium ever underestimates the viewport, the app still tracks the visible area:

```css
html, body, #root {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
}
```

This is purely a safety net; the real fix is on the Pi.

## Result

After `bash setup.sh` + reboot on a Pi with the 7" Touch Display 2 mounted in portrait:

1. The DSI panel rotates at the firmware level (`display_lcd_rotate=1`).
2. `.xinitrc` re-asserts rotation via `xrandr` and reads the actual rotated dimensions.
3. Chromium opens at exactly `720×1280` (or whatever the panel reports), fullscreen, no scrollbars, no pinch zoom — filling the whole display.
4. The Spark UI, which is already responsive, occupies the entire screen instead of one half.
