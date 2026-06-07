# Class-10 Student Page Redesign

## Goal
Reimagine `/student` for class-10 students as a calm, focused, single-tap experience. Replace the current dense vertical dashboard with **two horizontally-scrollable, full-viewport panels**, keeping the existing top navigation bar.

```text
┌──────────────────── Top Nav (kept) ────────────────────┐
│ Hi, name · Clock · Streak · Wi-Fi · BT · Notices       │
├────────────────────────────────────────────────────────┤
│  PANEL 1  (snap)            │   PANEL 2  (snap)        │
│  ┌───────────────────────┐  │   ┌───────────────────┐  │
│  │   Big Spark avatar    │  │   │  Quiz   Messages  │  │
│  │   "Talk to Spark"     │  │   │  Music  Pomodoro  │  │
│  │   (single CTA)        │  │   │  Wi-Fi  Bluetooth │  │
│  │                       │  │   │  Notices  Homework│  │
│  │  ── Chat with Spark ──│  │   │                   │  │
│  │   [type a message…]   │  │   │                   │  │
│  └───────────────────────┘  │   └───────────────────┘  │
│   ● ○  (dot indicator + swipe hint →)                  │
└────────────────────────────────────────────────────────┘
```

## Panel 1 — Spark (default view)
- Hero Spark avatar, large, centered, with ambient pulse.
- **One single primary action: "Talk to Spark"**. No "Done speaking", no "Try again" sitting on the home screen.
- Tapping it immediately:
  1. Requests mic permission (user gesture).
  2. Mounts `VoiceMode` inline in the panel (not as overlay) with `autoStart`, so the ElevenLabs agent connects and greets without any second tap.
  3. Avatar reflects live state (listening / speaking / thinking) from the existing `useConversation` hook.
- A subtle "End conversation" appears **only while connected**, anchored at the bottom of the hero area.
- Below the hero, a permanently visible **"Chat with Spark"** strip: a single inline text composer (`input + send`) that opens the chat overlay seeded with the typed message. No separate "Chat with Spark" button card — typing is the entry point.
- Today's goal + streak collapse into a small inline chip under the avatar (kept, but de-emphasised).

## Panel 2 — Tools
- Title: "Your tools".
- Large, friendly, equal-size tiles in a 2-column grid (touch-friendly for tablets):
  - Quiz, Messages, Homework, Music, Pomodoro, Wi-Fi, Bluetooth, Notices.
- Each tile opens its existing overlay/tool (`setOverlay` / `setTool`) — no behaviour change to the tools themselves.
- Homework tile expands to show today's homework list inline (reuses existing data; tapping a card still launches the voice/homework flow on Panel 1).

## Horizontal scroll behaviour
- Container: `flex overflow-x-auto snap-x snap-mandatory scroll-smooth`, each panel `w-screen h-[calc(100vh-navH)] snap-center shrink-0`.
- Hidden scrollbar; momentum scroll on touch.
- Bottom-center **dot indicator** (2 dots) showing current panel; tapping a dot scrolls to that panel.
- Right-edge chevron hint on Panel 1, left-edge chevron on Panel 2, fading out after first scroll.
- Keyboard: ← / → arrows switch panels.

## What stays the same
- Top navigation bar (logo, name, clock, streak, Wi-Fi/BT/Notices buttons).
- All existing overlays: voice mode (now also inline on Panel 1), chat, quiz, messages.
- All server functions, data flow, auth/device-token logic, ElevenLabs integration in `src/components/student/voice-mode.tsx`.
- Notices bell + offline banner behaviour.

## Technical details
- File: rewrite `src/routes/student.tsx` only (no schema/server changes). `voice-mode.tsx` is reused as-is, but rendered **inline** inside Panel 1 (it already supports inline use; overlay was just a wrapper). The existing `OverlayShell` is still used for Quiz / Chat / Messages and for Voice when launched from a Homework tile (to preserve the homework picker bar).
- New small components colocated in the route file: `PanelScroller`, `SparkPanel`, `ToolsPanel`, `PanelDots`.
- Mic permission is requested inside `SparkPanel`'s Talk button click handler (same pattern as today) before flipping a local `voiceActive` flag that mounts `VoiceMode` inline. When the user ends the conversation, the panel returns to the idle "Talk to Spark" CTA.
- Chat composer on Panel 1 reuses the existing `chat` overlay: typing + Enter (or send icon) sets `chatSeed` and `setOverlay("chat")`.
- Tailwind only; uses existing semantic tokens (`bg-background`, `bg-card`, `text-primary`, etc.). No new colors.
- Responsive: on very small screens, panels remain full-width; on desktop preview, panels are capped at `max-w-5xl` centred but still snap.

## Out of scope
- No changes to ElevenLabs agent, server functions, or DB.
- No changes to Quiz mode logic, Chat overlay, Messages overlay.
- No new tools — only re-grouping existing ones.

## Validation
- Open `/student`: Panel 1 shows the Spark hero + single Talk button + chat composer; nav bar unchanged.
- Tap "Talk to Spark": mic prompt → agent connects → Spark greets without a second tap; avatar animates with speaking/listening state; "End conversation" appears.
- Type in the chat strip + Enter: Chat overlay opens with the seed message.
- Swipe left (or arrow-right): Panel 2 snaps in, showing all tool tiles; dot indicator updates.
- Tap Quiz / Messages / Music / Pomodoro / Wi-Fi / Bluetooth / Homework: existing overlays/panels open as before.
- Offline: Talk + Chat + online-only tools become disabled with the existing "Needs Wi-Fi" hint; Music/Pomodoro/Clock still work.
