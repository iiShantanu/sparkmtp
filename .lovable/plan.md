## Goals

1. Fix the broken AI homework reply ("try again" error).
2. Make the bell icon open a notice list so notices can be reviewed after dismissing.
3. Add a beautiful animated Spark avatar that reacts to listening / speaking / thinking / error / forgot / angry / love / friendly emotions, driven by an emotion tag the AI returns.

## 1. Fix AI homework "try again"

Most likely cause: `runHomeworkTurn` server fn fails when `LOVABLE_API_KEY` or `ELEVENLABS_API_KEY` is missing, or when TTS fails — currently a single throw kills the whole turn so the student only sees a generic error.

Changes in `src/lib/student-runtime.functions.ts`:
- Verify `LOVABLE_API_KEY` exists (request via secrets if missing) and switch the AI call to the Lovable AI Gateway provider via the AI SDK (`google/gemini-3-flash-preview`) instead of the hand-rolled fetch.
- Make TTS optional: if `ELEVENLABS_API_KEY` is missing or TTS fails, still return `{ transcript, reply, emotion, audio_base64: null }` so the chat keeps working.
- Add an `emotion` field to the response (see §3) by asking the model to start its reply with `[emotion:happy]` etc. and stripping it server-side.
- Wrap AI + TTS in try/catch and surface a real error message to the client instead of a generic failure.

Pre-flight: check secrets and, if `LOVABLE_API_KEY` is missing, provision it; if `ELEVENLABS_API_KEY` is missing, leave it (voice + TTS degrade gracefully, chat still works).

## 2. Notice center (bell becomes clickable)

In `src/routes/student.tsx`:
- Add `noticesOpen` state. Make the header bell a button that toggles a slide-in panel listing every active notice (title, kind, body, time). Each row has a "Mark seen" button that adds the id to `dismissedRef` and calls `ackNotice`.
- The auto-popup `NoticeModal` still appears for the first unseen notice; closing it (X or "Got it") just dismisses that one — the rest stay reachable from the bell.
- Show an unread dot on the bell when there are notices not yet in `dismissedRef`.

## 3. Animated Spark avatar (Lottie, AI-driven emotions)

### Emotion model
One shared union used on client + server:
`listening | thinking | speaking | happy | friendly | love | angry | forgot | error | idle`.

The system prompt instructs the model to begin every reply with one tag, e.g. `[emotion:friendly] Let's try the first step…`. Server-side we regex it out, default to `friendly`, and return `{ reply, emotion }`. For ElevenLabs Conversational AI (live voice), parse the same tag from `agent_response` events client-side; while waiting for a response use `thinking`; while `conversation.isSpeaking` use `speaking`; otherwise `listening`.

### Avatar component
New `src/components/spark-avatar.tsx` using `@lottiefiles/dotlottie-react` (lightweight, supports `.lottie` and remote URLs, no build issues).
- Props: `emotion`, `size`.
- Maps each emotion to a free LottieFiles animation URL (curated friendly mascot face set — happy blob, thinking, sleeping/forgot, heart eyes, angry puff, sad/error, listening pulse, speaking mouth). URLs hard-coded as constants so no asset upload is required; if a URL fails to load we fall back to an animated SVG orb that pulses/colors per emotion (so the page always shows something nice).
- Smooth crossfade between emotion clips (200ms opacity transition, no layout jump).
- Subtle ambient float animation around the avatar.

### Wire-up
- `VoiceMode`: replace the current mic circle with `<SparkAvatar emotion={…} />` driven by `isSpeaking` / `status` / parsed agent emotion. Keep Start/End buttons below; add a live caption strip under the avatar.
- `HomeworkMode`: add the avatar at top; emotion = `thinking` while `busy`, otherwise the emotion returned by the last turn (default `friendly`). Show `error` on failure for 3s.
- `Home`: small idle avatar in the hero "Talk to Spark" card with `friendly` emotion.

### Dependency
`bun add @lottiefiles/dotlottie-react` — Worker-safe (client-only component, dynamic import guard not needed since used in route components after hydration).

## 4. QA
- Reload `/student`, confirm the page renders, bell opens panel, modal still pops once.
- Send a homework message; verify reply renders + avatar switches thinking → emotion. If TTS key missing, no audio but reply still shows.
- Toggle voice mode; avatar reacts to speaking/listening.

## Out of scope
- No DB schema changes.
- No changes to teacher/admin routes.
- No new auth flow.

## Files touched
- `src/lib/student-runtime.functions.ts` (AI call refactor + emotion tag + resilient TTS)
- `src/components/spark-avatar.tsx` (new)
- `src/routes/student.tsx` (bell panel, avatar integration, emotion state)
- `package.json` / `bun.lock` (add dotlottie-react)
