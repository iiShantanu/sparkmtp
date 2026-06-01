
# Spark — Teacher-Guided AI Learning Ecosystem

A single TanStack Start web app with role-based access (Teacher, Parent, School Admin, Student/Device), backed by Lovable Cloud (Postgres + Auth + Realtime + Storage). Same codebase serves all roles; the student surface is a dedicated route optimized for Raspberry Pi kiosk use.

## Visual direction

Production educational SaaS — clean, trustworthy, dense-but-calm. Inspired by Linear/Notion/Unacademy reference: white surfaces, subtle borders, soft shadows, a confident indigo primary with a warm secondary accent, generous spacing in summary cards, dense data tables, restrained motion. Sidebar nav + top bar layout. Tablet- and laptop-first responsive.

## Architecture

```text
TanStack Start (SSR)
├─ Lovable Cloud (Supabase)
│   ├─ Auth (email+password, Google)
│   ├─ Postgres (RLS everywhere)
│   ├─ Realtime (interaction logs, notifications)
│   └─ Storage (avatars, homework attachments)
├─ Role gating
│   └─ /_authenticated/{teacher,parent,admin,student}/...
├─ Server functions (createServerFn) — app-internal RPC
└─ Public API routes /api/public/device/* — Pi device integration
```

Roles stored in a dedicated `user_roles` table (never on profiles) with a `has_role()` security-definer function, per platform best practice.

## Data model (Postgres)

- `profiles` (id → auth.users, full_name, avatar_url, phone)
- `user_roles` (user_id, role enum: teacher|parent|admin|student)
- `schools` (id, name)
- `classes` (id, school_id, name, section, teacher_id)
- `students` (id, profile_id nullable, class_id, roll_number, name, dob)
- `parent_students` (parent_user_id, student_id) — many-to-many
- `homework` (id, class_id, teacher_id, title, subject, difficulty, instructions, voice_enabled, due_at, created_at)
- `homework_assignments` (id, homework_id, student_id, status, completed_at)
- `ai_configs` (id, scope: global|class|student, scope_id, teaching_style, tone, language, complexity, mode, custom_prompt, updated_by, updated_at)
- `interaction_logs` (id, student_id, homework_id nullable, subject, question, ai_response, transcript, duration_sec, topic, difficulty, needs_intervention, created_at)
- `analytics_daily` (student_id, date, learning_minutes, questions_asked, completion_rate, …) — materialized via triggers
- `notifications` (id, recipient_user_id, type, title, body, link, read_at, created_at)
- `audit_logs` (id, actor_user_id, entity, entity_id, action, diff jsonb, created_at)
- `devices` (id, pairing_code, student_id, last_seen_at, api_token_hash) — Pi pairing

Every public table gets GRANTs + RLS policies scoped by role + ownership.

## Routes

```text
/                              → marketing landing + role-aware redirect
/login, /signup, /reset-password
/_authenticated/
  teacher/
    overview, students, students.$id, homework, homework.new,
    ai-config, analytics, notifications, settings
  parent/
    overview, child.$id, notifications, settings
  admin/
    overview, schools, classes, users, usage, audit
  student/                     → Pi-optimized kiosk UI
    home, lesson.$id, ask
/api/public/device/
  pair, sync-log, fetch-homework, push-notification    (HMAC-signed)
```

## Phased build

To keep this manageable I'll ship in phases and confirm between major ones.

**Phase 1 — Foundation (this build)**
1. Enable Lovable Cloud.
2. Design system: tokens, sidebar shell, top bar, card/table primitives.
3. Auth: email+password + Google, signup with role selection (teacher/parent), profile bootstrap trigger, `user_roles` + `has_role()`.
4. Schema + RLS for: profiles, user_roles, schools, classes, students, parent_students, homework, homework_assignments, ai_configs, interaction_logs, notifications, audit_logs, devices.
5. Role-gated layouts (`_authenticated/teacher`, `/parent`, `/admin`, `/student`) with redirects by role.
6. Teacher Overview + Students list + Student Profile (read + notes).
7. Homework: create, assign by class/section/student, list, status.
8. AI Configuration page with editable prompt + structured controls, scoped global/class/student, with audit trail.
9. Parent Overview + Child detail.
10. Seed data + empty states + loading/error states.

**Phase 2**
- Analytics dashboards (Recharts): trends, subject performance, engagement, class summaries.
- Notifications center + Realtime subscription, toast on new.
- Admin: schools/classes/users CRUD, usage, audit log viewer.
- Filtering/search across tables, CSV export.

**Phase 3 — Device integration**
- `/api/public/device/*` routes with HMAC signature verification.
- Device pairing flow (teacher generates code → Pi posts code → token issued).
- Sync endpoints: fetch active homework, push interaction logs, receive prompt updates, push notifications.
- Realtime channel so dashboard updates the moment the Pi posts a log.
- Student kiosk route (`/_authenticated/student/*`) for Pi browser: large type, simple nav, voice-friendly.

**Phase 4 — Polish**
- Settings (profile, notification prefs, AI defaults, data export).
- Milestones, weak-concept detection rollups.
- Accessibility pass, responsive QA on tablet, perf.

## Technical notes

- Auth listener via `onAuthStateChange` at root; route guards in `beforeLoad` reading router context (no flash).
- Server functions for all DB reads/writes from components; `requireSupabaseAuth` middleware; `attachSupabaseAuth` registered globally.
- Device endpoints use service-role client + HMAC; never expose service key client-side.
- AI prompt changes write to `audit_logs` via trigger.
- Realtime: subscribe to `interaction_logs` (teacher's class), `notifications` (per user).
- No edge functions — TanStack server fns + server routes only.

## What I need from you before Phase 1

I can start immediately with sensible defaults, but two quick confirmations help:

1. **AI behavior in the app itself** — do you want the teacher's prompt to also drive a live "preview chat" inside the dashboard (using Lovable AI Gateway), or is the prompt purely configuration that the Pi consumes? Default: include a preview chat.
2. **Sign-up model** — open self-serve signup for teachers and parents, or admin-invite only? Default: self-serve for teachers/parents, admin invite-only.

If you don't reply, I'll proceed with the defaults above.
