## Goal

Reshape the `/student` home into a single dashboard where Spark is reachable in one tap (voice or chat overlays — no page jump), and add the Tier 1 + selected Tier 2 features you picked.

## 1. Home screen rework

Replace the single big "Talk to Spark" tile with a header strip that always shows today's avatar + daily goal, and two equal CTAs underneath:

```text
┌─────────────────────────────────────────────┐
│  🟣 Spark      Today's goal:                │
│                "Finish 5 fraction problems" │
├──────────────────────┬──────────────────────┤
│  🎙 Talk to Spark    │  💬 Chat with Spark  │
└──────────────────────┴──────────────────────┘
[ Reminders strip — homework due, exam tomorrow, revision ]
[ Streak: 🔥 5 days ]            [ Daily goal progress bar ]
[ Today's homework cards ]
[ Tools row: Music · Pomodoro · Timer · Wi-Fi · Bluetooth ]
```

Both Spark buttons open **modal overlays** on top of home — no `setView("voice"/"homework")` navigation. Closing the overlay returns to the same dashboard with state intact.

- **Talk overlay**: identical to today's `VoiceMode`, but `begin()` runs automatically on mount so Spark starts speaking the moment the modal opens (after the one-time mic permission).
- **Chat overlay**: text-only conversation using the same `runSparkTextTurn` server function that already exists, rendered with AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`) and react-markdown. No new AI route needed.

Homework cards still open the existing `HomeworkMode` (kept as an overlay too, for consistency).

## 2. Tier 1 features

### 🔔 Smart Reminders
Compute on the client from data the dashboard already loads:
- Homework `due_at` within next 24 h → "Due today".
- Notices of kind `exam` starting within 48 h → "Exam tomorrow".
- Topics from `student_learning_profile.weak_topics` not practised in the last 3 days → "Revise X".

Rendered as a horizontal chip strip above the homework list, colour-coded (amber/red/blue). Tapping a chip either opens the relevant homework overlay or pre-fills the chat overlay with "Help me revise X".

### 🎯 Daily Learning Goal (hybrid)
New table `daily_goals(student_id, goal_date, title, source, completed_at, set_by_user_id)`. Server function `getOrCreateTodayGoal(device_token)`:
1. If a teacher-set row exists for today → return it.
2. Else if none exists, generate one from due homework + weakest topic, insert with `source = 'auto'`, return it.

Student tap "Mark done" → updates `completed_at` and ticks the streak counter. Teacher gets a small control on their existing student page to override today's goal (`source = 'teacher'`).

### 🧠 Quiz Mode (oral)
A third Spark intent. Add a "Quiz me" entry inside the Talk overlay's footer and a tile under Tools. It calls a new server fn `startQuizSession({ device_token, subject? })` which builds a system prompt instructing Spark to: pick 5 questions from the student's weak topics + recent homework, ask one at a time, wait for the spoken answer, score it, and produce a recap.

The session reuses the existing ElevenLabs voice plumbing; quiz attempts are stored in `quiz_attempts(student_id, started_at, ended_at, topic, score, total, transcript)` so teachers can review later.

## 3. Tier 2 features

### 🎵 Focus Music — built-in curated library
Ship a small set of royalty-free tracks under `public/music/{lofi,instrumental,nature}/*.mp3` (5–6 tracks per category, ~3–4 MB each). Replace the empty-library state in `MusicPlayer` with tabs: `Curated · My uploads`. Curated tab lists the bundled tracks grouped by category; "My uploads" keeps the existing IndexedDB picker.

Spark gets a client tool `playFocusMusic({ category })` so the student can say "play some lo-fi" and the player opens to that category and starts the first track.

### ⏱ Pomodoro polish
Keep the current 3-tab modal but:
- When a Pomodoro segment ends, fire a short Spark voice line via the existing TTS server fn ("Nice work — take a 5-minute break"), instead of the placeholder beep.
- Persist active timer state in `localStorage` so the timer keeps ticking if the student navigates away or the kiosk reloads.

### ⏰ Study Timer
Add a fourth tab to the Pomodoro modal called "Session". Presets: Reading Practice / Homework Session / Revision Session, with editable minutes. On completion, log a row to `study_sessions(student_id, kind, planned_minutes, actual_minutes, ended_at)` for streak/teacher reporting.

### 🏆 Learning Streaks
New table `learning_streaks(student_id, current_streak, longest_streak, last_active_date)`. A day counts as "active" if the student either marked the daily goal done, finished a homework session, or completed a Pomodoro segment that day. Server fn `bumpStreakIfNeeded()` runs at the end of each of those actions. Streak chip shown on the dashboard with a flame icon and number.

## 4. Skipped this round

Per your scope choice: Read Aloud Mode, Weather, Calculator, School Schedule, Birthday Wishes. Easy follow-ups later.

## Technical notes

- **No new pages**: everything lives inside `/student`. Voice / Chat / Homework / Quiz are all modal overlays rendered above `Home`. The `view` state becomes `null | "voice" | "chat" | "homework" | "quiz"`.
- **Chat overlay** uses the AI Elements primitives already recommended (`bun x ai-elements@latest add conversation message prompt-input shimmer`) and `react-markdown` for assistant replies. Streaming is optional v1 — first cut can call the existing `runSparkTextTurn` server fn per turn and render the reply.
- **New tables**: `daily_goals`, `quiz_attempts`, `study_sessions`, `learning_streaks`. All scoped by `student_id`, RLS off (device-token gated via server fns using `supabaseAdmin`, mirroring the current pattern in `student-runtime.functions.ts`).
- **Teacher side**: minimal additions — a "Today's goal" override input on the existing student detail page, a read-only quiz/session/streak summary card. No new teacher routes.
- **Music assets**: bundled under `public/`, total budget ~60 MB. Cached by the PWA service worker on first visit so they play offline.
- **Offline behaviour**: Music, Pomodoro, Timer, Clock, Streak display all work offline; Talk/Chat/Quiz/Goal-fetch require network and stay gated by the existing `useOnline` hook.
- **Spark client tools** added to the ElevenLabs agent config: `playFocusMusic`, `startPomodoro`, `openHomework`, `markGoalDone`. These let the student trigger UI by voice.
