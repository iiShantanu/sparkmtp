## Goal

Turn the existing app into the thesis prototype:

1. A Raspberry Pi browser opens the **student page** with no login — paired once to one student.
2. Inside that page the student **talks to the AI** (ElevenLabs) and sees **pop-up reminders** for homework and teacher notices.
3. Teachers control the AI **per student, per subject, and as a global default**, plus push notices/reminders that the Pi surfaces.
4. Admin keeps the existing approval + management flow.

## 1. Database changes (one migration)

Tables:
- `devices` already exists. Reuse it. Add `claimed boolean default false` and reuse `pairing_code`, `student_id`, `token_hash`, `last_seen_at`. Admin/teacher generates a 6-char code; the Pi posts that code once to bind itself and receives an opaque device token (stored hashed). All later requests use that token.
- `ai_configs`: already has `scope` (`global` / `student`) and `subject_id`. Add `'subject'` to the `ai_scope` enum so a teacher can save **subject-wide** config (owner = teacher, scope = `subject`, scope_id = subject_id). Keep `global` = teacher default across their subjects, `student` = per-student override.
- `notices` (new): `id, teacher_id, subject_id?, class_id?, student_id?, title, body, kind('reminder'|'notice'|'homework_due'), starts_at, expires_at`. Targeting: if `student_id` set → that student; else class/subject + class scope. Admin + author can manage. Pi-readable via device-scoped server function (no client RLS for the device).
- `interaction_logs`: already exists. Used to write transcripts of student↔AI turns from the Pi for teacher review.

Resolution order at runtime (server function):  
`student override (ai_configs.scope='student', scope_id=student)` → `subject override (scope='subject', scope_id=subject, owner=that subject's teacher)` → `teacher global (scope='global', owner=that teacher)` → built-in default.

## 2. Server functions (`src/lib/`)

- `device.functions.ts`:
  - `adminCreatePairingCode({ student_id, name })` — admin or teacher with access to that student creates a code.
  - `devicePair({ code })` — public (no auth) server fn: validates code, marks `claimed`, returns `{ device_token, student_id }`.
  - All Pi-side fns below accept `device_token` instead of a user session and look up the bound student.
- `student-runtime.functions.ts` (device-token auth):
  - `getStudentSession()` → student profile, active subjects, today's homework, active notices.
  - `getResolvedAiConfig({ subject_id })` → merged AI config (prompt, mode, language, tone, voice).
  - `getElevenLabsAgentToken({ subject_id })` → server-minted ElevenLabs conversation token; injects the resolved prompt as agent override.
  - `runHomeworkTurn({ subject_id, homework_id, audio_or_text })` → STT (if audio) → Lovable AI (Gemini, with resolved prompt + homework instructions) → TTS → returns `{ transcript, reply_text, audio_url }`. Writes to `interaction_logs`.
  - `ackNotice({ notice_id })`, `heartbeat()`.
- `teacher-ai.functions.ts` extension:
  - `listMyAiConfigs()` — global + per-subject + per-student rows the teacher owns.
  - `upsertAiConfig({ scope, scope_id?, subject_id?, ...fields })` — RLS-enforced.
  - `previewResolvedConfig({ student_id, subject_id })` — what the student will actually get.
- `teacher-notices.functions.ts`:
  - `createNotice`, `listMyNotices`, `deleteNotice`, scoped to teacher's subjects/classes.

ElevenLabs key handling: store `ELEVENLABS_API_KEY` as a Lovable Cloud secret; all calls happen inside server functions, never in the browser.

## 3. UI changes

### Pi / student
- New public route `src/routes/device-pair.tsx` — first-time setup: enter pairing code, store device token in localStorage.
- New route `src/routes/student.tsx` (device-token gated, no Supabase session):
  - Header: student name, today's date, current subject selector (limited to subjects teachers have assigned to that student's class).
  - Big "Talk to Spark" voice button → opens ElevenLabs Agent (WebRTC) using the token from `getElevenLabsAgentToken`. Live transcript + speaking indicator.
  - Homework drawer: list of today's homework. Tapping one switches to **pipeline mode** (`runHomeworkTurn`) so the teacher's subject/student prompt is enforced strictly.
  - **Pop-up reminders**: polled every 60s from `getStudentSession()`. Modal with TTS playback of the title/body and "Got it" → `ackNotice`.

### Teacher
- `/_authenticated/teacher/ai` becomes a tabbed page:
  - **Global default** (existing single-config form).
  - **Per subject** — one card per subject the teacher teaches.
  - **Per student** — existing per-student override page, plus a "Preview resolved config" panel.
- `/_authenticated/teacher/notices` — create/list reminders, target = subject, class, or single student.
- `/_authenticated/teacher/devices` — generate a pairing code for any student in the teacher's classes; see last-seen.

### Admin
- `/_authenticated/admin/devices` — same pairing UI, all students.
- Keep existing approval / subjects / classes / users / invitations / parents pages unchanged.

## 4. ElevenLabs integration

- **Conversational Agent (WebRTC)** for open chat: `@elevenlabs/react`'s `useConversation`. Server fn returns a single-use conversation token + overrides (prompt, voice, first message) from the resolved config.
- **STT + Lovable AI + TTS pipeline** for homework drills: server fn uses ElevenLabs `scribe_v2` for transcription, Lovable AI Gateway (`google/gemini-3-flash-preview`) for reasoning with the teacher's exact prompt + homework instructions, ElevenLabs TTS (`eleven_turbo_v2_5`) for the reply audio. Returns base64 audio + transcript for the Pi to play.
- Voice id, language, tone are pulled from `ai_configs` so teachers control them.

## 5. Out of scope (for this round)

- Real device-OS kiosk setup on the Pi (browser autostart, screen wake) — documented but not coded.
- Push to phone for parents.
- Audio recording archival in Storage (we keep text transcripts in `interaction_logs`).

## 6. Files touched

- New: migration, `src/lib/device.functions.ts`, `src/lib/student-runtime.functions.ts`, `src/lib/teacher-notices.functions.ts`, `src/lib/elevenlabs.server.ts`, `src/routes/device-pair.tsx`, `src/routes/student.tsx`, `src/routes/_authenticated/teacher/notices.tsx`, `src/routes/_authenticated/teacher/devices.tsx`, `src/routes/_authenticated/admin/devices.tsx`.
- Edited: `src/lib/teacher.functions.ts` (subject scope + preview), `src/routes/_authenticated/teacher/ai.tsx` (tabs), `src/routes/_authenticated/teacher.tsx` and `admin.tsx` (nav).
- Secret: prompt user for `ELEVENLABS_API_KEY` before the ElevenLabs server fns are wired up.

After approval I'll request the `ELEVENLABS_API_KEY` secret, run the migration, and build the changes above.