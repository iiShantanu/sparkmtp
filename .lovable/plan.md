
# Student page — Raspberry Pi kiosk plan

I'll split this into **what's fully possible in the browser**, **what needs a small helper service on the Pi**, and **what's not realistic**. Then I'll lay out the concrete changes.

---

## 1. Feasibility — read this first

| Feature | Verdict | How |
|---|---|---|
| Fix "Start" disconnecting silently | Possible | Debug ElevenLabs override / agent config |
| Stop repeating notice popup | Possible | Persist dismissals in `localStorage`, not in-memory |
| Talk-to-AI button on first screen | Possible | Already there — make it the dominant action |
| Clock | Possible | Pure JS |
| Timer / Pomodoro / Stopwatch | Possible | Pure JS + localStorage |
| Store & play music | Possible | Files saved in **IndexedDB** on the device; HTML `<audio>` plays them. No server. |
| Offline interface (UI loads with no Wi-Fi, AI disabled) | Possible | Service worker + cache + IndexedDB |
| **Wi-Fi scan / connect from the page** | **Not possible from a normal browser.** No Web API exists for Wi-Fi. | Requires a tiny helper service on the Pi (Python/Node) that runs `nmcli` and exposes `http://127.0.0.1:8765`. The page calls localhost. |
| **Bluetooth pairing** | **Partially possible.** Web Bluetooth can connect to *specific* BLE devices but **cannot do system-wide pairing** (no classic audio, no "pair my speaker"). | Real pairing also needs the helper service calling `bluetoothctl`. |
| Kiosk mode (page opens on boot, nothing else accessible) | Possible | OS-level config on the Pi (Chromium `--kiosk`, autostart, disable cursor/keys). I can provide the scripts but they install on the Pi, not in this repo. |
| True PWA install / offline cache on Pi Chromium | Possible | Add manifest + service worker |

**Bottom line:** Wi-Fi and Bluetooth from a web page need a **small companion process running on the Raspberry Pi**. I'll design the web UI assuming that helper exists at `http://127.0.0.1:8765`, and I'll provide the helper as a small Python script + systemd unit you install once on the Pi. If the helper isn't running (e.g. development on your laptop), those panels show "Hardware controls unavailable on this device."

---

## 2. Bug fixes (do first)

### 2a. Voice Start disconnects immediately
Most likely causes given the recent overrides change:
- ElevenLabs agent rejected the override payload (`prompt`/`firstMessage`/`language` not enabled, or `prompt` shape wrong)
- Token expired / wrong agent ID
- `conversation.startSession` throws and `onDisconnect` fires before `onError` is surfaced

Plan: add visible error capture (show `onError` message in UI), log the override payload, re-verify the agent's `conversation_config.agent.overrides` allow-list via the ElevenLabs API, and fall back to **no overrides** if the patch returns 4xx so the user always gets *some* conversation.

### 2b. Repeating notice popup
Currently dismissals live in a `useRef<Set>` that resets on remount, and the 30s `refresh()` re-opens the first unacknowledged notice. Fix:
- Persist dismissed IDs in `localStorage` (`spark_dismissed_notices`)
- Only auto-open a notice if it arrived **after** the last dismissal timestamp
- Never auto-open while the panel is open or voice/homework view is active

---

## 3. New home layout (kiosk-first)

Reorganise `/student` into a single dashboard the student lands on:

```text
┌──────────────────────────────────────────────────────┐
│ Hi, {name}    🕘 14:32   🔔(2)  📶 Wi-Fi  🔵 BT      │
├──────────────────────────────────────────────────────┤
│  ┌──────────────────┐   ┌────────────────────────┐   │
│  │  TALK TO SPARK   │   │  Today's homework      │   │
│  │  (big avatar)    │   │  • Fractions           │   │
│  │  [ Start ]       │   │  • Reading             │   │
│  └──────────────────┘   └────────────────────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ Music   │ │ Pomodoro│ │ Clock   │ │ Settings│    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
└──────────────────────────────────────────────────────┘
```

- **Talk to Spark** stays the primary CTA.
- Header gets: clock, notice bell (opens panel — never auto-opens), Wi-Fi indicator, Bluetooth indicator.
- New tiles: Music, Pomodoro/Timer, Settings (Wi-Fi/Bluetooth live here).
- All other routes (`/login`, `/admin`, `/teacher`, etc.) remain in the codebase but the Pi's kiosk Chromium only opens `/student` — students literally can't navigate elsewhere.

---

## 4. New features

### Clock
Always visible in header. 12/24h toggle in settings, persisted locally.

### Pomodoro / Timer / Stopwatch
- Modal opened from tile. Three tabs.
- State persists across reloads via `localStorage`.
- Optional chime sound (bundled audio file).

### Music player
- "Add music" button opens file picker (`<input type="file" accept="audio/*" multiple>`).
- Files stored as `Blob` in **IndexedDB** (`spark_music` store).
- Player with play/pause/next/prev/volume, current track displayed.
- Works fully offline. No upload, no cloud, no auth.

### Wi-Fi panel (Settings → Wi-Fi)
- Calls `GET http://127.0.0.1:8765/wifi/scan` → list of SSIDs + signal.
- "Connect" prompts for password, calls `POST /wifi/connect`.
- Shows current SSID and IP.
- If helper unreachable: "Wi-Fi controls require the Spark device service. Not available in browser preview."

### Bluetooth panel (Settings → Bluetooth)
- `GET /bt/scan`, `POST /bt/pair`, `POST /bt/connect`, `POST /bt/disconnect`.
- Useful for pairing a speaker/headphones for the AI voice and music.
- Same fallback message if helper is missing.

### Offline mode
- Service worker caches the app shell, fonts, icons, the SPA bundle.
- IndexedDB holds: dismissed notices, music library, Pomodoro state, last-known student session snapshot, queued voice transcripts to summarise once online.
- When offline: AI tiles show "Offline — reconnect to talk with Spark", everything else (clock, music, timer, viewing cached homework text) keeps working.
- Online detection via `navigator.onLine` + ping to the backend every 30s.

---

## 5. Raspberry Pi side (delivered as docs + scripts, not app code)

I'll add a `raspberry-pi/` folder in the repo with:

1. `spark-device-service.py` — Flask app on `127.0.0.1:8765`:
   - `/wifi/scan|connect|status` → wraps `nmcli`
   - `/bt/scan|pair|connect|disconnect|status` → wraps `bluetoothctl`
   - CORS locked to `http://localhost` + the published Lovable domain
2. `spark-device.service` — systemd unit, auto-start on boot
3. `kiosk-autostart.sh` — launches Chromium in `--kiosk --app=https://<your-app>/student --noerrdialogs --disable-pinch --overscroll-history-navigation=0`
4. `setup.sh` — installs deps (`network-manager`, `bluez`, `chromium-browser`, `unclutter`), enables the service, configures autologin to the kiosk session
5. `README.md` — flash → boot → run `setup.sh` → done

You run `setup.sh` once on the Pi. After that, power-on lands directly in the student page, full screen, no address bar, no other apps reachable.

---

## 6. Files I'll touch (technical section)

**Edit**
- `src/routes/student.tsx` — new dashboard layout, header clock/indicators, remove notice auto-popup, hand off to new components
- `src/lib/student-runtime.functions.ts` — better error surfacing for voice start, allow voice start without overrides as fallback
- `src/lib/spark-context.server.ts` — return a flag when overrides PATCH failed so client knows to skip them
- `vite.config.ts` — register `vite-plugin-pwa` with the guarded wrapper described in the PWA skill

**Create**
- `src/components/student/header-bar.tsx` (clock, bell, wifi/bt indicators)
- `src/components/student/music-player.tsx` + `src/lib/music-store.ts` (IndexedDB)
- `src/components/student/pomodoro.tsx`
- `src/components/student/wifi-panel.tsx` + `src/components/student/bluetooth-panel.tsx`
- `src/lib/device-bridge.ts` — typed client for `http://127.0.0.1:8765`
- `src/lib/offline-store.ts` — IndexedDB wrapper (dismissed notices, cached session, queued transcripts)
- `src/pwa-register.ts` — guarded SW registration (kiosk-only, never in Lovable preview)
- `raspberry-pi/` folder with service, systemd unit, kiosk autostart, README

**Not changed**
- Admin / teacher / parent routes
- Auth, DB schema, RLS
- ElevenLabs agent config beyond verifying overrides

---

## 7. What I want confirmed before building

1. **Helper service language: Python (Flask) or Node?** Python is lighter on Pi and matches `nmcli`/`bluetoothctl` examples best — that's my recommendation.
2. **Music storage cap** — fine to leave it unbounded (IndexedDB will use whatever the Pi's SD card allows), or cap at, say, 500 MB with a "manage library" screen?
3. **Kiosk URL** — point the Pi at the published URL (`https://bloom-classroom-hub.lovable.app/student`) so updates push automatically, correct?
4. **Offline AI** — confirm you only want the *UI* offline; we will NOT bundle a local LLM. AI features simply show "offline" when there's no internet.

Once you confirm, I'll switch to build mode and implement in this order: bug fixes → new home layout + clock/pomodoro/music → offline/PWA → Wi-Fi/Bluetooth panels + Pi helper service + kiosk scripts.
