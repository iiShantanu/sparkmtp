# Make voice actions visible + floating Pomodoro

## Problem
1. When Spark says "Done", nothing is visible: voice handlers for notes/todos/messages just mutate state silently without opening the panel.
2. Notes & To-do panels work, but voice-added items are invisible until the user manually opens the panel.
3. Pomodoro takes over the whole screen — once started, the user can't use anything else without losing the timer view.

## Fix

### 1) Voice handlers always open the matching panel
Edit `src/components/student/voice-mode.tsx` so every tool that mutates or reads a panel's data emits `panel:open` for that panel before/after running:

- `add_note`, `list_notes`, `delete_note` → open `notes`
- `add_todo`, `list_todos`, `complete_todo` → open `todo`
- `send_message`, `list_recent_messages` → open `messages`
- (music, pomodoro, wifi, bt already do this)

This guarantees Spark's "Saved." / "Added." / "Sent." is paired with a visible UI change.

### 2) Auto-close voice overlay when a tool panel opens (optional polish)
Currently the voice overlay sits on top, so opening `notes` while in voice mode would stack two modals. In the `sparkBus` subscriber in `src/routes/student.tsx`, when `panel:open` fires for a non-`messages` panel, also clear `overlay` if it's `"voice"` or `"chat"` so the tool panel is actually visible. (Voice session keeps running in the background until user re-opens it; transcript persists.)

Acceptable alternative if user prefers voice to stay foreground: keep overlay open and raise tool panel z-index above it. I'll go with auto-close — it's what "show me the task" implies.

### 3) Floating Pomodoro
Convert `src/components/student/pomodoro.tsx` so the full-screen modal becomes a small floating chip once the timer is running OR when the user closes the modal mid-run:

- Persisted state already tracks `endsAt` / `elapsedAt` — reuse it.
- New component `PomodoroFloating` (same file) — fixed bottom-right pill showing `MM:SS` + pause/resume + expand button. Subscribes to the same persisted state and `sparkBus` ticks every second.
- Mount the floating chip from `src/routes/student.tsx` (always rendered when a pomodoro session is active, independent of `tool === "pomodoro"`).
- Closing the big modal no longer stops the timer; tapping the chip re-opens the modal.
- Voice `start_pomodoro` → starts the timer AND opens the modal once; user can then close the modal and keep the floating chip.

## Files

- `src/components/student/voice-mode.tsx` — emit `panel:open` from notes/todo/messages handlers.
- `src/routes/student.tsx` — bus subscriber clears voice/chat overlay when a tool panel opens; always render `<PomodoroFloating />` when a session is active.
- `src/components/student/pomodoro.tsx` — export `PomodoroFloating`; closing modal no longer pauses; floating chip controls.

## Out of scope
- Floating mini-players for music/notes/todo (only Pomodoro was requested).
- Server-backed notes/todos (still localStorage).
- Reading notes/messages aloud beyond the current "X | Y | Z" join.

## Acceptance
- "Take a note: buy milk" → notes panel opens, "buy milk" is visible at top.
- "Add to-do: finish science HW" → to-do panel opens with new item checked off-able.
- "Send a message to my math teacher: running late" → messages panel opens with the sent message.
- "Start a 20 minute focus session" → big Pomodoro opens at 20:00 running, close it → bottom-right chip shows live countdown; tap chip → big modal reopens at correct remaining time.
