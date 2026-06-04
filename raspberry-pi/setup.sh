#!/usr/bin/env bash
# One-time installer for the Spark Raspberry Pi kiosk.
# Run from the raspberry-pi/ folder on a fresh Raspberry Pi OS (Bookworm, desktop).

set -e

if [ "$(id -u)" -eq 0 ]; then
  echo "Please run as the 'pi' user (not root). sudo will be invoked when needed." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing packages (NetworkManager, Bluez, Chromium, Python helpers, unclutter)…"
sudo apt update
sudo apt install -y \
  network-manager bluez bluez-tools \
  chromium-browser unclutter \
  python3 python3-pip python3-flask python3-flask-cors

echo "==> Enabling NetworkManager and Bluetooth…"
sudo systemctl enable --now NetworkManager
sudo systemctl enable --now bluetooth

echo "==> Adding pi user to netdev and bluetooth groups…"
sudo usermod -aG netdev,bluetooth pi

echo "==> Installing helper service to /opt/spark/…"
sudo mkdir -p /opt/spark
sudo cp "$SCRIPT_DIR/spark-device-service.py" /opt/spark/
sudo cp "$SCRIPT_DIR/kiosk.sh" /opt/spark/
sudo chmod +x /opt/spark/spark-device-service.py /opt/spark/kiosk.sh

echo "==> Installing systemd unit…"
sudo cp "$SCRIPT_DIR/spark-device.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now spark-device.service

echo "==> Installing kiosk autostart…"
mkdir -p "$HOME/.config/autostart"
cp "$SCRIPT_DIR/kiosk.desktop" "$HOME/.config/autostart/"

echo "==> Configuring autologin for the pi user (raspi-config)…"
sudo raspi-config nonint do_boot_behaviour B4 || true   # Desktop autologin

cat <<EOF

==========================================================
  Spark kiosk is installed.

  - Helper service: http://127.0.0.1:8765/health
  - Kiosk URL:      \$SPARK_KIOSK_URL (defaults to published Lovable URL)

  Reboot to start: sudo reboot

  To change the URL, edit /opt/spark/kiosk.sh or set
  SPARK_KIOSK_URL in /etc/environment.
==========================================================
EOF