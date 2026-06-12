
# Voice-controlled apps for Spark

Give Spark voice control over Messages, Notes, To-do, Music, Pomodoro, Wi-Fi and Bluetooth using ElevenLabs **client tools**. Tools are auto-provisioned on the agent at every session start, and Spark acts immediately (no spoken confirmation step).

## What you'll be able to say

| Domain | Examples |
|---|---|
| Messages | "Send a message to my math teacher saying I finished the homework." "Read my latest message from Mrs Sharma." |
| Notes | "Take a note: photosynthesis happens in chloroplasts." "Read my notes." "Delete the last note." |
| To-do | "Add buy notebook to my to-do." "What's on my to-do list?" "Mark buy notebook as done." |
| Music | "Play some lofi." "Pause." "Next track." "Switch to focus beats." |
| Pomodoro | "Start a 25-minute focus session." "Pause the timer." "Reset Pomodoro." |
| Wi-Fi | "Scan Wi-Fi." "Connect to HomeNet, password skylight42." (Pi device only) |
| Bluetooth | "Scan Bluetooth." "Pair to AirPods." (Pi device only) |

## How it works

1. **Centralised app-control bus** (`src/lib/spark-controls.ts`)
   A tiny pub/sub + imperative store the voice tools call into. Panels (music player, pomodoro, notes, todo, messages, wifi, bluetooth) subscribe to the bus so a voice command opens the right panel and reflects state instantly. Panels keep working with mouse/touch — the bus is just an extra control surface.

2. **Auto-provisioning the agent** (extend `src/lib/elevenlabs.server.ts`)
   When `startVoiceConversation` runs, also PATCH the agent's `conversation_config.agent.prompt.tools` with the full tool catalog (names, descriptions, parameter schemas). This means zero ElevenLabs dashboard setup — the agent always knows the current tool list.

3. **Client tool handlers** (extend `src/components/student/voice-mode.tsx`)
   Pass `clientTools` to `useConversation`. Each handler returns a short string the agent reads back ("Sent.", "Added 'buy notebook'.", "Playing lofi."). Server-backed tools (`send_message`, `list_messages`, `add_goal`) call existing server fns via `useServerFn`; local tools (`add_note`, `add_todo`, music, pomodoro, wifi, bluetooth) call the control bus.

4. **Lift panel state where needed**
   - **Music** & **Pomodoro**: introduce a small zustand-style store (plain `useSyncExternalStore` over the bus) so voice commands work even when the panel isn't visible — voice "play lofi" auto-opens the player and starts.
   - **Notes / To-do**: keep `localStorage`, expose `add/list/remove/complete` helpers the bus re-uses.
   - **Messages**: use existing `listStudentTeachers` / `sendStudentMessage` / `listStudentMessages` server fns; teacher matching is fuzzy (subject name or teacher name).
   - **Wi-Fi / Bluetooth**: call the existing `deviceBridge`. On non-Pi previews, the tool returns "Wi-Fi controls need the Spark device", which Spark reads back.

5. **No-confirmation policy**
   System prompt addendum tells Spark to act immediately, then report back in one short sentence. Skipping the "are you sure?" round-trip per your choice.

## Tool catalog (provisioned to the agent)

```text
send_message(teacher: string, body: string)
list_recent_messages(teacher?: string, limit?: number)
add_note(text: string)
list_notes(limit?: number)
delete_note(match: string)            # last | first | text substring
add_todo(text: string)
list_todos(filter?: "all"|"open"|"done")
complete_todo(match: string)
play_music(category?: "lofi"|"focus"|"chill"|"classical"|"nature", track?: string)
pause_music()
resume_music()
next_track() / previous_track()
start_pomodoro(minutes?: number)      # default 25
pause_pomodoro() / resume_pomodoro() / reset_pomodoro()
wifi_scan() / wifi_connect(ssid, password?)
bluetooth_scan() / bluetooth_pair(device)
open_panel(name: "messages"|"notes"|"todo"|"music"|"pomodoro"|"wifi"|"bluetooth")
close_panel()
```

## Files to touch

- **New** `src/lib/spark-controls.ts` — control bus, panel-open store, music & pomodoro state, notes/todo helpers.
- **New** `src/lib/spark-voice-tools.ts` — JSON Schema definitions of the tool catalog (shared between server provisioning and client handlers, so they can't drift).
- **Edit** `src/lib/elevenlabs.server.ts` — PATCH `conversation_config.agent.prompt.tools` alongside the existing overrides.
- **Edit** `src/lib/student-runtime.functions.ts` — append a "voice tool usage" addendum to the system prompt explaining each tool and the no-confirmation rule.
- **Edit** `src/components/student/voice-mode.tsx` — wire `clientTools` to handlers; accept `onOpenPanel`, `studentToken` props.
- **Edit** `src/routes/student.tsx` — give `VoiceMode` the `setTool` setter; subscribe panels' open state to the bus.
- **Edit** `music-player.tsx`, `pomodoro.tsx`, `notes-panel.tsx`, `todo-panel.tsx` — read from / dispatch through the bus so voice commands and UI stay in sync.
- **Edit** `messages-panel.tsx` — no behaviour change, but the voice send_message tool reuses its server fns.

## Out of scope (for this pass)

- Spoken voice confirmation flows (per your "just do it" choice).
- Reading long message threads aloud — only the latest message per teacher.
- Cross-device Wi-Fi/Bluetooth on non-Pi browsers (Web Bluetooth API requires user gesture; voice-triggered pairing isn't possible there).

## Acceptance check

- "Talk to Spark" → "Play some lofi" → music panel opens, lofi starts, Spark says "Playing lofi."
- "Start a 20-minute focus session" → pomodoro opens at 20:00 and runs.
- "Take a note: mitochondria is the powerhouse" → note saved, panel reflects it on next open.
- "Send a message to my science teacher: I'll be late" → message appears in teacher's inbox.
- On preview (non-Pi): "Connect to HomeNet" → Spark says it needs the Spark device.
