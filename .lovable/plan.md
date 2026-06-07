## Goal
Make the Raspberry Pi kiosk behave like a true touch tablet: vertical swipes scroll vertically, taps land exactly where the finger touches, and blank areas do not trigger nearby buttons.

## Plan
1. **Stop forcing the X-layer display rotation by default**
   - The current setup rotates at firmware level and then re-asserts rotation with `xrandr`.
   - On the Raspberry Pi Touch Display 2, that can leave the visible screen and touch input in different coordinate spaces.
   - I’ll change the default so X does **not** rotate again unless explicitly requested.

2. **Add explicit display/touch modes**
   - Keep firmware rotation as the default source of truth.
   - Add a `SPARK_XRANDR_ROTATE` option:
     - `auto` / default: do not apply extra X rotation.
     - `match`: apply X rotation for third-party HDMI panels that need it.
   - Keep `SPARK_TOUCH_MATRIX`, but make the README clearer that Pi Touch Display 2 should use identity touch mapping.

3. **Add a kiosk-safe touch reset/calibration helper**
   - Add commands in the installer-generated session to reset every detected touchscreen to identity mapping before Chromium starts.
   - Improve device matching so the actual Pi touchscreen is handled reliably.
   - Add troubleshooting commands that show both the screen rotation and the active touch matrix.

4. **Update Pi instructions**
   - Update `raspberry-pi/README.md` with the exact recovery command for your case:
     ```bash
     cd ~/spark
     git pull
     SPARK_DISPLAY_ROTATE=1 SPARK_XRANDR_ROTATE=auto SPARK_TOUCH_MATRIX=auto sudo -E bash raspberry-pi/setup.sh
     sudo reboot
     ```
   - Add fallback commands only if the panel is not the official Pi Touch Display 2.

## Files to change
- `raspberry-pi/setup.sh`
- `raspberry-pi/README.md`

## Expected result
After reinstall + reboot, touch coordinates should line up with the visible screen: vertical finger movement scrolls vertically, and taps hit the button or blank area actually touched.