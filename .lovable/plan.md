## Goal

Add a super admin panel that manages all users, classes, and global subjects. Teachers get scoped access (only their assigned subjects, classes, and students). Admin manages parent accounts and links them to students.

## Data model changes

New tables:
- `subjects` — global catalog: `id`, `name`, `code` (admin-managed)
- `teacher_subjects` — assignment: `teacher_id`, `subject_id`, optional `class_id`
- `invitations` — pending admin/teacher/parent invites: `email`, `role`, `token`, `expires_at`, `accepted_at`, `created_by`

Schema additions:
- `homework.subject_id` (FK → subjects) replacing free-text `subject` over time; keep `subject` column for back-compat
- `classes` stays admin-owned (teacher cannot create)
- Trigger on `auth.users` already promotes signups; extend `handle_new_user` to consume `invitations` token from `raw_user_meta_data` and assign correct role + links

## RLS rewrite (scoped by role)

- **classes**: insert/update/delete → admin only. Read → admin, assigned teachers (via `teacher_subjects.class_id` or via classes they're listed under), parents of enrolled students.
- **students**: insert/update/delete → admin only. Read → admin, teachers who teach a subject in that student's class, parents linked to that student.
- **homework**: insert → teacher must own a `teacher_subjects` row for `(subject_id, class_id)`. Read → admin, teacher who created it OR teaches that subject+class, parents/students linked.
- **ai_configs**: teachers can only write `scope='student'` configs for students in their classes AND for one of their subjects (new `subject_id` column on ai_configs). Admin: all. Remove teacher access to global `scope='global'` admin config.
- **subjects / teacher_subjects / invitations / parent_students**: admin-only writes; teachers read their own `teacher_subjects`; parents read their own `parent_students`.

New SECURITY DEFINER helpers:
- `is_admin()` — wraps `has_role(auth.uid(),'admin')`
- `teacher_teaches(_subject_id, _class_id)` — checks `teacher_subjects`
- `teacher_can_see_student(_student_id)` — true if teacher teaches any subject in student's class

## Server functions

New `src/lib/admin.functions.ts` (all gated by `is_admin()` check inside handler):
- Subjects: list/create/update/delete
- Classes: list/create/update/delete (admin version, no teacher_id filter)
- Students: list/create/update/delete
- Teachers: list, assign subjects (+ optional class), unassign
- Parents: create account via invite, link/unlink to student
- Invitations: create (admin/teacher/parent), list pending, revoke
- Users: list all with roles

Update `src/lib/teacher.functions.ts`:
- Remove `createClass`, `createStudent`
- Filter `listStudents` to students in classes where teacher teaches a subject
- `listSubjects` → only teacher's assigned subjects
- `createHomework` validates `subject_id` is in teacher's assignments
- AI config functions: enforce subject+student scope check; remove global config write

Update `src/lib/parent.functions.ts`: unchanged scope, reads via `parent_students`.

## Routes & UI

New `src/routes/_authenticated/admin.tsx` layout — guards with `current_user_role()='admin'`, sidebar nav.
Children:
- `admin/index.tsx` — overview dashboard
- `admin/users.tsx` — list users, change role
- `admin/invitations.tsx` — create + revoke invites (teacher/parent/admin)
- `admin/subjects.tsx` — CRUD subjects
- `admin/classes.tsx` — CRUD classes + assign teachers per subject
- `admin/students.tsx` — CRUD students, enroll in class
- `admin/parents.tsx` — create parent accounts, link to students
- `admin/ai.tsx` — global AI config defaults

Update teacher routes:
- Remove "New class" / "New student" buttons
- `teacher/homework.tsx` subject dropdown shows only assigned subjects
- `teacher/students.tsx` shows only scoped students
- `teacher/ai.tsx` removed (no global config for teachers); per-student AI config page stays but enforces subject choice from teacher's assignments

App shell: show "Admin" link when role is admin.

## Invitation flow

1. Admin creates invite → row in `invitations` with token, role, optional `subject_id`/`student_id` payload
2. App sends link `/signup?invite=<token>` (email send is out-of-scope; show link in admin UI to copy)
3. Signup page passes token in `signUp` `options.data` → `handle_new_user` trigger reads token, assigns role + creates `teacher_subjects` or `parent_students` rows, marks invite accepted

## Migration order

1. Create `subjects`, `teacher_subjects`, `invitations` tables + GRANTs + RLS
2. Add `subject_id` to `homework` and `ai_configs` (nullable initially)
3. Add SECURITY DEFINER helpers
4. Drop & recreate RLS on `classes`, `students`, `homework`, `ai_configs` per new rules
5. Update `handle_new_user` to process invitations
6. Promote current user (`shantanutiwari2612@gmail.com`) to admin

## Out of scope (this round)

- Email delivery of invites (link is shown in admin UI to copy/share)
- Bulk CSV import
- Audit log UI (table already exists; not surfaced)

Confirm to proceed and I'll start with the migration.