#!/usr/bin/env bash
# Launches Chromium in full-screen kiosk mode pointing at the Spark student page.
# Disables every "you crashed last time" dialog and hides the cursor when idle.

set -e

URL="${SPARK_KIOSK_URL:-https://bloom-classroom-hub.lovable.app/student}"

# Prevent screen blanking
xset -dpms || true
xset s off || true
xset s noblank || true

# Hide cursor after 1s of inactivity
( unclutter -idle 1 -root & ) >/dev/null 2>&1 || true

# Clear Chromium's "exit was abnormal" flags so it never shows the restore bar
PREF="$HOME/.config/chromium/Default/Preferences"
if [ -f "$PREF" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$PREF" || true
  sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREF" || true
fi

exec chromium-browser \
  --kiosk "$URL" \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=OverlayScrollbar