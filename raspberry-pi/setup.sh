#!/usr/bin/env bash
# =============================================================================
# Spark Raspberry Pi kiosk installer
# Target: Raspberry Pi OS Bookworm (32-bit and 64-bit)
# Result: Boot -> console autologin -> startx -> Chromium kiosk -> Spark
# =============================================================================
set -euo pipefail

SPARK_URL="https://sparkmtp.lovable.app/student"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Display rotation (config.txt display_*_rotate values):
#   0 = landscape (no rotation)
#   1 = portrait, 90° clockwise   (default — matches the 7" Touch Display 2 mounted upright)
#   2 = upside down
#   3 = portrait, 90° counter-clockwise
SPARK_DISPLAY_ROTATE="${SPARK_DISPLAY_ROTATE:-1}"

# Touch coordinate transformation:
#   auto     = let libinput/kernel handle rotation (default — correct for the
#              Raspberry Pi Touch Display 2 and most DSI panels). Picks identity.
#   match    = apply the xinput CTM that matches SPARK_DISPLAY_ROTATE.
#              Use this only if touch axes are swapped/inverted after rotation
#              AND the panel driver does NOT auto-rotate touch input.
#   "<9 floats>" = explicit matrix, e.g. "0 1 0 -1 0 1 0 0 1"
SPARK_TOUCH_MATRIX="${SPARK_TOUCH_MATRIX:-auto}"

say()  { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# 0. Sudo + user detection (never assume 'pi')
# -----------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

SPARK_USER="${SUDO_USER:-${USER:-}}"
if [[ -z "${SPARK_USER}" || "${SPARK_USER}" == "root" ]]; then
  # Fallback: first regular user with UID >= 1000
  SPARK_USER="$(getent passwd | awk -F: '$3>=1000 && $3<65534 {print $1; exit}')"
fi
[[ -n "${SPARK_USER}" ]] || die "Could not detect a non-root user. Run as a regular user with sudo."
id "${SPARK_USER}" >/dev/null 2>&1 || die "User '${SPARK_USER}' does not exist."
SPARK_HOME="$(getent passwd "${SPARK_USER}" | cut -d: -f6)"
[[ -d "${SPARK_HOME}" ]] || die "Home directory for ${SPARK_USER} not found."

say "Installing Spark kiosk for user: ${SPARK_USER} (home: ${SPARK_HOME})"

export DEBIAN_FRONTEND=noninteractive

# -----------------------------------------------------------------------------
# 1. SSH always on (remote recovery)
# -----------------------------------------------------------------------------
say "Ensuring SSH is enabled"
apt-get update -y
apt-get install -y openssh-server
systemctl enable ssh
systemctl start ssh
ok "SSH enabled and running"

# -----------------------------------------------------------------------------
# 2. Base packages
# -----------------------------------------------------------------------------
say "Installing base packages (Chromium, X, Python, NetworkManager, Bluetooth)"
apt-get install -y \
  xserver-xorg xinit x11-xserver-utils \
  x11-utils xinput \
  chromium-browser chromium-codecs-ffmpeg-extra \
  python3 python3-pip python3-flask python3-flask-cors \
  network-manager bluez bluez-tools rfkill \
  curl ca-certificates iproute2 unclutter

# Some Bookworm images ship 'chromium' instead of 'chromium-browser'
if ! command -v chromium-browser >/dev/null 2>&1; then
  if command -v chromium >/dev/null 2>&1; then
    ln -sf "$(command -v chromium)" /usr/local/bin/chromium-browser
  else
    apt-get install -y chromium || die "Could not install Chromium."
  fi
fi
ok "Base packages installed"

# Ensure Flask is importable for system python (use apt packages; avoid PEP 668)
python3 -c "import flask, flask_cors" 2>/dev/null || {
  warn "python3-flask / python3-flask-cors missing; trying pip with --break-system-packages"
  python3 -m pip install --break-system-packages --no-cache-dir flask flask-cors
}
ok "Flask available"

# -----------------------------------------------------------------------------
# 3. Permissions: Wi-Fi + Bluetooth
# -----------------------------------------------------------------------------
say "Granting Wi-Fi/Bluetooth permissions to ${SPARK_USER}"
for grp in netdev bluetooth; do
  if getent group "$grp" >/dev/null; then
    usermod -aG "$grp" "${SPARK_USER}"
    ok "Added ${SPARK_USER} to ${grp}"
  else
    warn "Group ${grp} not present on this system"
  fi
done

systemctl enable NetworkManager
systemctl start NetworkManager
systemctl enable bluetooth
systemctl start bluetooth
ok "NetworkManager + bluetooth enabled"

# -----------------------------------------------------------------------------
# 4. Device helper service
# -----------------------------------------------------------------------------
say "Installing Spark device helper service to /opt/spark/"
install -d -m 0755 /opt/spark
install -m 0755 "${SCRIPT_DIR}/spark-device-service.py" /opt/spark/spark-device-service.py
chown -R "${SPARK_USER}:${SPARK_USER}" /opt/spark

sed "s/__SPARK_USER__/${SPARK_USER}/g" \
  "${SCRIPT_DIR}/spark-device.service.template" \
  > /etc/systemd/system/spark-device.service
chmod 0644 /etc/systemd/system/spark-device.service

systemctl daemon-reload
systemctl enable spark-device
systemctl restart spark-device
ok "spark-device.service installed"

# -----------------------------------------------------------------------------
# 5. Service verification
# -----------------------------------------------------------------------------
say "Verifying device service"
for i in {1..10}; do
  if systemctl is-active --quiet spark-device; then break; fi
  sleep 1
done
systemctl is-active --quiet spark-device \
  || die "spark-device service failed to start. Inspect: journalctl -u spark-device -n 100 --no-pager"
ok "spark-device active"

for i in {1..10}; do
  if curl -fsS --max-time 2 http://127.0.0.1:8765/ >/dev/null 2>&1 \
     || curl -fsS --max-time 2 http://127.0.0.1:8765/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS --max-time 2 http://127.0.0.1:8765/ >/dev/null 2>&1 \
  || curl -fsS --max-time 2 http://127.0.0.1:8765/health >/dev/null 2>&1 \
  || die "Device API not responding on http://127.0.0.1:8765"
ok "Device API responding on :8765"

ss -tulpn 2>/dev/null | grep -q ':8765' \
  || die "Nothing listening on port 8765 according to ss"
ok "Port 8765 listening"

# nmcli sanity
if sudo -u "${SPARK_USER}" nmcli -t -f RUNNING general >/dev/null 2>&1; then
  ok "nmcli works for ${SPARK_USER}"
else
  warn "nmcli check failed for ${SPARK_USER}; group membership applies after next login"
fi

# -----------------------------------------------------------------------------
# 6. Remove keyring / disable Chromium password prompts
# -----------------------------------------------------------------------------
say "Removing gnome-keyring and stale keyring data"
apt-get purge -y gnome-keyring 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true
rm -rf "${SPARK_HOME}/.local/share/keyrings" || true
ok "Keyring removed"

# -----------------------------------------------------------------------------
# 7. Console autologin on tty1 (no desktop)
# -----------------------------------------------------------------------------
say "Enabling console autologin on tty1 for ${SPARK_USER}"
# Make sure no graphical desktop autologin is competing
if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_boot_behaviour B2 || true   # B2 = Console Autologin
fi
systemctl set-default multi-user.target

install -d -m 0755 /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${SPARK_USER} --noclear %I \$TERM
EOF
systemctl daemon-reload
ok "tty1 autologin configured"

# -----------------------------------------------------------------------------
# 8. ~/.xinitrc and ~/.bash_profile for kiosk
# -----------------------------------------------------------------------------
say "Writing ${SPARK_HOME}/.xinitrc and ${SPARK_HOME}/.bash_profile"

# ~/.xserverrc — launch the X server with -nocursor so no mouse pointer is ever
# drawn (true touch-only kiosk). startx reads this file automatically.
cat > "${SPARK_HOME}/.xserverrc" <<'EOF'
#!/bin/sh
exec /usr/bin/X -nocursor "$@"
EOF
chmod 0755 "${SPARK_HOME}/.xserverrc"
chown "${SPARK_USER}:${SPARK_USER}" "${SPARK_HOME}/.xserverrc"

cat > "${SPARK_HOME}/.xinitrc" <<EOF
#!/bin/sh
# Spark kiosk X session — do not edit by hand, regenerated by setup.sh

xset s off
xset -dpms
xset s noblank

# Re-assert rotation at the X layer (covers HDMI panels where display_hdmi_rotate
# is ignored). Safe no-op if the display is already correctly oriented.
PRIMARY="\$(xrandr 2>/dev/null | awk '/ connected/ {print \$1; exit}')"
MATCH_MATRIX="1 0 0 0 1 0 0 0 1"
if [ -n "\$PRIMARY" ] && [ "${SPARK_DISPLAY_ROTATE}" = "1" ]; then
  xrandr --output "\$PRIMARY" --rotate right >/dev/null 2>&1 || true
  MATCH_MATRIX="0 1 0 -1 0 1 0 0 1"
elif [ -n "\$PRIMARY" ] && [ "${SPARK_DISPLAY_ROTATE}" = "3" ]; then
  xrandr --output "\$PRIMARY" --rotate left >/dev/null 2>&1 || true
  MATCH_MATRIX="0 -1 1 1 0 0 0 0 1"
elif [ -n "\$PRIMARY" ] && [ "${SPARK_DISPLAY_ROTATE}" = "2" ]; then
  xrandr --output "\$PRIMARY" --rotate inverted >/dev/null 2>&1 || true
  MATCH_MATRIX="-1 0 1 0 -1 1 0 0 1"
fi

# Decide which CTM to apply to touchscreens.
#   auto     -> identity (libinput already rotates touch with the panel on
#               the Pi Touch Display 2 — applying a matrix on top swaps axes
#               and breaks button taps).
#   match    -> the matrix matching SPARK_DISPLAY_ROTATE above.
#   "a b c d e f g h i" -> use that explicit matrix verbatim.
case "${SPARK_TOUCH_MATRIX}" in
  auto)  TOUCH_MATRIX="1 0 0 0 1 0 0 0 1" ;;
  match) TOUCH_MATRIX="\$MATCH_MATRIX" ;;
  *)     TOUCH_MATRIX="${SPARK_TOUCH_MATRIX}" ;;
esac

# Apply the matrix to every touchscreen device. Filters by common
# touchscreen name markers so we don't clobber mice / trackpads.
if command -v xinput >/dev/null 2>&1; then
  xinput --list --name-only 2>/dev/null | while IFS= read -r dev; do
    case "\$dev" in
      *Touchscreen*|*touchscreen*|*Touch*|*touch*|*FT5*|*Goodix*|*"Raspberry Pi"*)
        xinput set-prop "\$dev" "Coordinate Transformation Matrix" \$TOUCH_MATRIX >/dev/null 2>&1 || true
        ;;
    esac
  done
fi

# Read the real, post-rotation screen size so Chromium opens at the true panel
# dimensions instead of guessing. Falls back to 1280x720 if xdpyinfo is missing.
DIMS="\$(xdpyinfo 2>/dev/null | awk '/dimensions:/ {print \$2; exit}')"
if [ -z "\$DIMS" ]; then DIMS="1280x720"; fi
SCREEN_W="\${DIMS%x*}"
SCREEN_H="\${DIMS#*x}"

# Belt-and-suspenders: X is already launched with -nocursor via ~/.xserverrc,
# but also run unclutter with -idle 0 so any cursor that does appear is hidden
# instantly. Harmless if unclutter is missing.
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0 -root &

# Pick whichever chromium binary exists
CHROMIUM_BIN="\$(command -v chromium-browser || command -v chromium)"

exec "\$CHROMIUM_BIN" \\
  --password-store=basic \\
  --kiosk \\
  --start-fullscreen \\
  --window-position=0,0 \\
  --window-size=\${SCREEN_W},\${SCREEN_H} \\
  --force-device-scale-factor=1 \\
  --high-dpi-support=1 \\
  --hide-scrollbars \\
  --overscroll-history-navigation=0 \\
  --disable-pinch \\
  --disable-session-crashed-bubble \\
  --disable-infobars \\
  --noerrdialogs \\
  --check-for-update-interval=31536000 \\
  ${SPARK_URL}
EOF
chmod 0755 "${SPARK_HOME}/.xinitrc"
chown "${SPARK_USER}:${SPARK_USER}" "${SPARK_HOME}/.xinitrc"

# Append (idempotent) a guarded startx block to .bash_profile
BP="${SPARK_HOME}/.bash_profile"
touch "$BP"
if ! grep -q "# >>> spark-kiosk >>>" "$BP"; then
  cat >> "$BP" <<'EOF'

# >>> spark-kiosk >>>
# Auto-start Chromium kiosk on tty1 unless recovery mode is requested.
# Set SPARK_DISABLE_KIOSK=1 (e.g. in /etc/environment or via SSH) to skip.
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ] && [ "${SPARK_DISABLE_KIOSK:-0}" != "1" ]; then
    startx
fi
# <<< spark-kiosk <<<
EOF
fi
chown "${SPARK_USER}:${SPARK_USER}" "$BP"
ok "Kiosk auto-start wired (recovery: export SPARK_DISABLE_KIOSK=1)"

# -----------------------------------------------------------------------------
# 8b. Display rotation (firmware level) for portrait kiosks
# -----------------------------------------------------------------------------
say "Configuring display rotation (SPARK_DISPLAY_ROTATE=${SPARK_DISPLAY_ROTATE})"

# Bookworm puts firmware config under /boot/firmware/; older images use /boot/
CONFIG_TXT=""
for candidate in /boot/firmware/config.txt /boot/config.txt; do
  if [[ -f "$candidate" ]]; then CONFIG_TXT="$candidate"; break; fi
done

if [[ -n "$CONFIG_TXT" ]]; then
  # Strip any previous Spark-managed block, then append a fresh one.
  if grep -q "# >>> spark-display >>>" "$CONFIG_TXT"; then
    sed -i '/# >>> spark-display >>>/,/# <<< spark-display <<</d' "$CONFIG_TXT"
  fi
  cat >> "$CONFIG_TXT" <<EOF

# >>> spark-display >>>
# Managed by raspberry-pi/setup.sh — edit SPARK_DISPLAY_ROTATE and re-run.
disable_overscan=1
display_lcd_rotate=${SPARK_DISPLAY_ROTATE}
display_hdmi_rotate=${SPARK_DISPLAY_ROTATE}
# <<< spark-display <<<
EOF
  ok "Wrote display rotation block to ${CONFIG_TXT}"
else
  warn "Could not find /boot/firmware/config.txt or /boot/config.txt — skipping rotation"
fi

# -----------------------------------------------------------------------------
# 9. Final summary
# -----------------------------------------------------------------------------
IP_ADDR="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -n "$IP_ADDR" ]] || IP_ADDR="(not connected)"

ssh_status="$(systemctl is-active ssh || true)"
dev_status="$(systemctl is-active spark-device || true)"
bt_status="$(systemctl is-active bluetooth || true)"
nm_status="$(systemctl is-active NetworkManager || true)"
api_status="down"
if curl -fsS --max-time 2 http://127.0.0.1:8765/ >/dev/null 2>&1 \
   || curl -fsS --max-time 2 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  api_status="up (http://127.0.0.1:8765)"
fi

cat <<SUMMARY

============================================================
  Spark kiosk installation complete
============================================================
  Username:               ${SPARK_USER}
  IP Address:             ${IP_ADDR}
  Spark URL:              ${SPARK_URL}
  Display Rotation:       ${SPARK_DISPLAY_ROTATE} (0=landscape, 1=portrait CW, 2=180°, 3=portrait CCW)
  SSH Status:             ${ssh_status}
  Device Service Status:  ${dev_status}
  API Status:             ${api_status}
  Bluetooth Status:       ${bt_status}
  NetworkManager Status:  ${nm_status}
============================================================

Reboot now to enter kiosk mode:

    sudo reboot

SSH back in any time as: ${SPARK_USER}@${IP_ADDR}
Recovery (skip kiosk): create /etc/profile.d/spark-recovery.sh
with:  export SPARK_DISABLE_KIOSK=1
SUMMARY