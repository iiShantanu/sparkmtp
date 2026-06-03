
# Make Spark a real tutor, not a generic voice AI

Today the ElevenLabs agent is configured **once globally** with a static system prompt (the PATCH we did earlier). When a student taps **Start**, ElevenLabs has no idea who they are, what class they're in, what homework was assigned, what they struggled with last time, or which subjects their teacher flagged as weak. That's why it behaves like a friendly chatbot instead of a tutor.

The fix has three parts: send rich student context **per session**, give Spark a **persistent memory** of each student across sessions, and tell the agent to **open like a tutor** (proactively suggest subjects, recall past struggles, continue unfinished topics).

---

## 1. Per-session context via ElevenLabs conversation overrides

ElevenLabs supports `overrides` on `startSession` — you can dynamically inject the system prompt, first message, and variables for that one call. We'll stop relying on the static PATCH'd prompt and instead build a fresh, student-specific prompt every time **Start** is tapped.

Server-side (`startVoiceConversation` in `src/lib/student-runtime.functions.ts`), before returning the WebRTC token, we will gather:

- **Student**: name, class, section
- **Teacher AI config**: the resolved `ai_configs` row (teaching style, tone, language, complexity, custom prompt) — same resolver already used for text turns
- **Subjects** the teacher teaches this class
- **Active homework** (titles, subjects, due dates, teacher instructions)
- **Active notices** addressed to the student/class
- **Learning profile** (new table — see §2): weak topics, strong topics, current focus, last-session summary, unresolved doubts
- **Recent interaction history**: last ~10 interaction_logs question/response pairs as a memory snippet

Return all of this to the client along with the token. The client passes it via `conversation.startSession({ conversationToken, overrides: { agent: { prompt, firstMessage, language } } })`.

The new system prompt template will instruct the agent to:
- Greet the student by name
- Open by **asking which subject they want to work on**, and **suggest one based on weak topics or pending homework** ("You had trouble with fractions last time — want to keep going, or start the science homework due tomorrow?")
- Reference specific past sessions when relevant ("Last time we were working on ___ — should we continue?")
- Stay in the Socratic / guided style their teacher configured
- Keep using the existing `[emotion:…]` tag rule for the avatar

The `firstMessage` override will be a personalized opener generated server-side from the same context, so the agent talks first the moment the call connects — no awkward silence.

> Enabling overrides in the ElevenLabs agent settings: prompt, firstMessage, and language overrides must be allow-listed on the agent. We'll PATCH the agent once via the existing API key flow to enable them, then rely on per-session overrides instead of mutating the static prompt going forward.

## 2. Persistent learning memory per student

Add a new table `student_learning_profile` (one row per student) with:

- `current_focus` (text — e.g. "fractions")
- `weak_topics` (text[])
- `strong_topics` (text[])
- `last_session_summary` (text)
- `unresolved_doubts` (jsonb — array of `{ topic, question, last_seen_at }`)
- `updated_at`

After every voice/text/homework turn (in `runSparkTextTurn`, `runHomeworkTurn`, and a new post-call summarizer for voice sessions), run a **lightweight Lovable AI call** (`google/gemini-3.1-flash-lite-preview`) that takes the latest exchange + previous profile and returns an updated profile JSON. We persist that back via `supabaseAdmin`.

For voice sessions specifically, ElevenLabs gives us the full transcript through `onMessage` events. We'll buffer those client-side and send the whole transcript to a new server function `summarizeVoiceSession` on `endSession`, which updates the profile.

RLS: profile is server-managed only (no client policy). Reads only happen through `supabaseAdmin` inside server functions — no GRANT to anon/authenticated needed beyond `service_role`.

## 3. Tutor-style opening flow

The agent's prompt will enforce this opening script (executed via `firstMessage` + system instructions):

1. Greet by first name.
2. If `unresolved_doubts` is non-empty → "Last time we were stuck on X. Want to finish that first?"
3. Else if pending homework exists → "You have homework on Y due Z. Should we tackle it?"
4. Else if `weak_topics` non-empty → "Your teacher flagged fractions as something to practice. Want to work on that?"
5. Else → "Which subject would you like to study today? You have A, B, C."

Always offer **a concrete suggestion + an open question**, never a generic "How can I help?".

## 4. Prototype banner

Add a small "Prototype" badge in the student header (per your note that this is still a prototype), purely visual, no logic.

---

## Technical Details

### Files to change / create

| File | Change |
| --- | --- |
| `supabase/migrations/<ts>_student_learning_profile.sql` | New table + `service_role` grant + no public-facing RLS policies (server-only) |
| `src/lib/student-runtime.functions.ts` | Expand `startVoiceConversation` to build full context payload; add `summarizeVoiceSession`; extend `runSparkTextTurn` / `runHomeworkTurn` to update profile after each turn |
| `src/lib/spark-context.server.ts` (new) | Helpers: `loadStudentContext(student_id)`, `buildTutorSystemPrompt(ctx)`, `buildFirstMessage(ctx)`, `updateLearningProfile(student_id, transcript, prevProfile)` |
| `src/routes/student.tsx` | Pass `overrides.agent.prompt` + `overrides.agent.firstMessage` to `conversation.startSession`; buffer transcript; call `summarizeVoiceSession` on `endSession`; add prototype badge |
| One-time PATCH to ElevenLabs agent | Enable `prompt`, `first_message`, and `language` in `conversation_config.agent.overrides` so per-session overrides are accepted |

### Prompt template shape (server-built, sent as override)

```
You are Spark, {student.full_name}'s personal tutor for {class.name} {section}.
Teacher's style: {teaching_style} | tone: {tone} | language: {language} | complexity: {complexity}.

What you know about this student:
- Current focus: {current_focus}
- Weak topics: {weak_topics}
- Strong topics: {strong_topics}
- Last session: {last_session_summary}
- Unresolved doubts: {unresolved_doubts}

Subjects available: {subjects}
Active homework: {homework[]}  (title, subject, due, teacher instructions)
Active notices: {notices[]}

Rules:
- Begin EVERY reply with one [emotion:…] tag (existing list).
- Open with a concrete suggestion based on the rules above. Never say "how can I help".
- Teach Socratically — guide, don't give the final answer.
- Reference past sessions when relevant ("we were stuck on X, want to continue?").
- After the student picks a subject, stay focused on it until they switch.
```

### Cost / model choice

- Per-turn profile updates: `google/gemini-3.1-flash-lite-preview` (cheap, fast). 
- End-of-call summary: same model, single call per session.
- Existing tutor responses unchanged (`google/gemini-3-flash-preview`).

### No breaking changes

- Existing `runSparkTextTurn` / `runHomeworkTurn` keep their current return shape.
- The static agent prompt PATCH still works as a fallback if overrides ever fail; the override just supersedes it per session.

---

## Out of scope (ask if you want these next)

- Showing the learning profile to teachers in the dashboard
- Parent visibility into weak/strong topics
- Multi-language detection (currently respects teacher's configured `language`)
- Long-term spaced-repetition scheduling
