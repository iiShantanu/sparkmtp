## Goal

Replace the current turn-based voice loop in **Talk to Spark** with a true real-time conversation powered by the ElevenLabs Conversational AI **agent** (the one configured via `ELEVENLABS_AGENT_ID`). Today the overlay calls `runSparkVoiceTurn` (STT → Lovable AI LLM → TTS) which feels exactly like the chat box. After this change, Spark will stream audio both ways through the ElevenLabs agent — student speaks, Spark hears in real-time and replies immediately with its own voice and persona, with natural interruption support.

The Quiz mode and the Chat (text) mode are NOT changed in this plan — only Talk to Spark.

## What changes

### 1. `src/routes/student.tsx` — rewrite `VoiceMode`

Replace the entire `MediaRecorder` / `runSparkVoiceTurn` / `playSparkAudio` flow with the `@elevenlabs/react` SDK (already installed at `^1.6.4`).

- Import `useConversation` from `@elevenlabs/react`.
- On mount (when `autoStart`), call the existing `startVoiceConversation` server function to fetch `{ agentId, token, systemPrompt, firstMessage, language, overridesEnabled, warning }`. This already injects student context, learning profile, and homework instructions into the prompt.
- Request mic permission, then call `conversation.startSession({ conversationToken: token, connectionType: "webrtc", overrides: overridesEnabled ? { agent: { prompt: { prompt: systemPrompt }, firstMessage, language } } : undefined })`.
- Drive the `SparkAvatar` from live SDK state:
  - `conversation.status === "connected"` and `isSpeaking === true` → `speaking`
  - connected and not speaking → `listening`
  - otherwise → `thinking` / `friendly` / `error`
- Build the on-screen transcript from `onMessage` events (`user_transcript` → "you", `agent_response` / `agent_response_correction` → "spark"). Drop the manual `appendLine` plumbing tied to the old server turn.
- Replace the "Done speaking" / "Talk again" buttons with a single **End / Resume** control:
  - While `status === "connected"`: show **End conversation** (calls `endSession`).
  - While disconnected: show **Talk to Spark** (re-runs the start flow).
  - Mute toggle button using `setMicMuted` for situations where the student wants Spark to keep talking without interrupting.
- Keep the existing text composer at the bottom, but route it through `conversation.sendUserMessage(text)` instead of `runSparkTextTurn`, so typed and spoken turns share one conversation.
- On unmount / overlay close: `await conversation.endSession()`, stop mic tracks, and still call `summarizeVoiceSession` with the captured transcript so the learning-profile update keeps working.
- Surface `warning` from `startVoiceConversation` (e.g. agent id missing) and `onError` from the hook with a clear inline message and an "error" Spark emotion.
- Remove now-unused imports: `runSparkVoiceTurn`, `runSparkTextTurn`, `playSparkAudio`, `startBrowserRecording`, `stopBrowserRecording`, and the `RecorderState` ref type — but keep `summarizeVoiceSession`, `runQuizVoiceTurn` (Quiz still uses it), `runHomeworkTurn` (used elsewhere), and the homework picker bar.

### 2. Homework Mode inside the agent call

`startVoiceConversation` already builds a Homework-aware system prompt and first message when `homework_id` is passed. The new `VoiceMode` will:

- Pass `homework_id: activeHomework?.id ?? null` into `startVoiceConversation`.
- When the student picks a different homework from the in-overlay picker, end the current session and start a new one with the new homework id, so the agent gets a fresh prompt.
- Keep the existing "Mark done" button and `completeHomework` server call exactly as-is.

### 3. No server / DB / schema changes

- `startVoiceConversation`, `elevenlabs.server.ts`, and `ensureAgentOverridesEnabled` already exist and stay.
- `runSparkVoiceTurn` stays in the file (still referenced by other utilities/tests historically), but is no longer wired from the UI.
- Secrets are already set: `ELEVENLABS_AGENT_ID`, `ELEVENLABS_API_KEY`. No `add_secret` call needed.

## Out of scope

- Quiz mode keeps the current turn-based loop with `runQuizVoiceTurn`.
- Chat with Spark (text overlay) is unchanged.
- No design changes to the home screen, homework cards, reminders, or messages panel.

## Validation

1. Open `/student`, tap **Talk to Spark**. Within ~1s of granting mic permission, Spark's voice should greet the student through the ElevenLabs agent (not the browser `speechSynthesis` fallback).
2. Speak a question without tapping anything — Spark should respond live, and the avatar should switch between `speaking` and `listening` automatically. Interrupting Spark mid-sentence should cut its voice off.
3. Open a homework card → Talk to Spark; confirm the agent's first line references that homework.
4. Type into the text composer mid-conversation; confirm the agent answers in the same voice session.
5. Close the overlay; confirm mic LED turns off (session ended) and `summarizeVoiceSession` fires once.
6. Quiz still works as before (untouched).
