## Goal

Make the Spark kiosk a true touch-only device on the rotated 7" Touch Display 2:
1. Hide the mouse cursor completely (always, not just when idle).
2. Fix swapped touch axes so horizontal finger movement maps to horizontal screen movement after the 90° rotation.

Both are Raspberry Pi setup changes — no web app code changes needed.

---

## Why this is happening (plain language)

When the screen is rotated in software (via `xrandr --rotate right`), only the *picture* is rotated. The touchscreen itself still reports finger positions in its original landscape coordinates, so a horizontal swipe gets interpreted as vertical. This is a well-known Raspberry Pi issue and is fixed by telling the X input system to apply the same rotation to the touch input using a "coordinate transformation matrix".

The cursor is showing because `unclutter` only hides it after 1 second of idle — and any stray mouse/HID device keeps waking it. For a kiosk we want it gone permanently.

---

## Planned changes

### 1. `raspberry-pi/setup.sh` — `.xinitrc` rewrite

**Hide cursor permanently** by adding `-nocursor` to the X server arguments via a new `~/.xserverrc`, and removing the `unclutter` idle approach (keep `unclutter` installed as a fallback but launch it with `-idle 0` so it hides immediately too).

**Rotate touch input** to match the display. Right after the `xrandr --rotate` call, apply the matching coordinate transformation matrix to every touchscreen device using `xinput`:

```text
rotate=right (portrait CW, SPARK_DISPLAY_ROTATE=1)  → matrix  0  1  0  -1  0  1  0  0  1
rotate=left  (portrait CCW, =3)                     → matrix  0 -1  1   1  0  0  0  0  1
rotate=inverted (180°, =2)                          → matrix -1  0  1   0 -1  1  0  0  1
rotate=normal (=0)                                  → matrix  1  0  0   0  1  0  0  0  1
```

The script will enumerate pointer devices (`xinput --list --name-only`) and apply the matrix to anything whose name contains a touchscreen marker (`Touchscreen`, `FT5`, `Goodix`, `Touch`, `Raspberry Pi`). This is safe for non-touch devices because they are filtered out by name.

### 2. `raspberry-pi/setup.sh` — new `~/.xserverrc`

Write a small `~/.xserverrc` that launches the X server with `-nocursor`, which removes the cursor at the X server level (most reliable method, survives focus changes and works even before the page loads):

```sh
#!/bin/sh
exec /usr/bin/X -nocursor "$@"
```

### 3. `raspberry-pi/setup.sh` — keep Chromium flags clean

Remove the cursor-related concern from Chromium (it doesn't draw its own cursor — the cursor comes from X). No Chromium flag changes needed for this fix.

### 4. `raspberry-pi/README.md` — short troubleshooting note

Add a one-paragraph note explaining:
- The cursor is hidden via `~/.xserverrc` (`X -nocursor`).
- Touch rotation is handled automatically based on `SPARK_DISPLAY_ROTATE`.
- How to verify with `xinput --list` and how to re-apply the matrix manually if a new touchscreen shows up.

---

## What stays the same

- `SPARK_DISPLAY_ROTATE` env var and the `config.txt` block from the previous fix.
- The web app, virtual keyboard, all routes — untouched.
- Recovery flow (`SPARK_DISABLE_KIOSK=1`) — untouched.

---

## Verification after reboot

1. No mouse pointer is ever drawn on screen.
2. Dragging a finger left↔right moves things left↔right (not up↔down).
3. `xinput --list` shows the touchscreen with the new transformation matrix when checked via SSH: `xinput list-props "<device name>" | grep "Coordinate Transformation Matrix"`.
