
## Goals

1. Admin signs in through the same `/login` page but lands directly on `/admin` — no admin link surfaced in teacher dashboard.
2. Clean, role-aware login entry points (Teacher / Parent / Admin) so each audience sees a focused experience.
3. Self-registration from the landing page (teacher/parent) creates a **pending** account. Such users cannot enter their dashboard until an admin approves them from the Admin Panel.
4. Invite-token signups (created by admin) remain auto-approved.

## Changes

### 1. Remove admin link from teacher dashboard
- `src/routes/_authenticated/teacher.tsx`: drop the `if (me.roles.includes("admin"))` block that injects the "Admin panel" nav item. Admins reach `/admin` only via `/login` → auto-redirect.

### 2. Role-aware login UX
- Replace `/login` with a small role picker (Teacher / Parent / Admin) at the top of the card. Selection is cosmetic + sets the post-login redirect hint, but actual routing is still driven by the user's real role from `getMe()` (admin → `/admin`, teacher → `/teacher`, parent → `/parent`). This prevents a parent signing in on the "Teacher" tab from landing in the wrong place.
- After successful sign-in, if the user is **pending approval**, sign them out immediately and show a clear "Awaiting admin approval" message on the login page.
- Update landing page CTAs: "Sign in as Teacher", "Sign in as Parent", plus a subtle "Admin" link in the footer/nav.

### 3. Approval workflow (DB + server)

**Migration (new):**
- Add `approval_status` enum: `pending | approved | rejected` (default `pending`).
- Add `profiles.approval_status` column, default `pending`.
- Backfill: set all existing profiles to `approved`. Admin user stays `approved`.
- Update `handle_new_user()` trigger:
  - If signup uses a valid `invite_token` → `approval_status = 'approved'` (admin already vetted).
  - Otherwise (self-registered teacher/parent from landing page) → `approval_status = 'pending'`.
- Add helper `public.is_approved(uuid)` (SECURITY DEFINER) returning boolean.
- Tighten existing RLS so pending users see nothing sensitive:
  - `students`, `classes`, `homework`, `teacher_subjects`, `parent_students`, `ai_configs` policies: AND in `is_approved(auth.uid())` for non-admin roles.
  - `profiles_self_read` stays open so the user can read their own pending status.

**Server functions (`src/lib/admin.functions.ts`):**
- `adminListPendingUsers()` — list profiles where `approval_status = 'pending'`, with role.
- `adminApproveUser({ user_id })` — set `approval_status = 'approved'`.
- `adminRejectUser({ user_id })` — set `approval_status = 'rejected'`.
- `adminListUsers` already exists; extend to include `approval_status`.

**Auth flow (`src/lib/auth.functions.ts`):**
- Extend `getMe()` to also return `approvalStatus`.

### 4. UI: Admin approval queue
- New route `src/routes/_authenticated/admin/approvals.tsx` — table of pending teachers/parents with Approve / Reject buttons. Add nav item "Approvals" (with a badge count) in `admin.tsx`.
- Update `admin/users.tsx` to show approval status column and allow re-approval/rejection.

### 5. Login-time gate
- `src/routes/_authenticated.tsx`: after `getMe()` resolves, if `approvalStatus === 'pending' | 'rejected'` and user isn't admin → `supabase.auth.signOut()` and `redirect({ to: '/login', search: { pending: 1 } })`.
- `/login` reads `?pending=1` and shows "Your account is awaiting admin approval. You'll be able to sign in once approved."

## Improvement suggestions (optional, flagged for your call)

- **Email notification on approval**: send a transactional email when admin approves a user. Requires email infra; can be added later.
- **Self-serve teacher onboarding metadata**: at signup ask which subject(s)/classes they teach — stored on the pending profile so the admin sees context when approving and can pre-fill `teacher_subjects`.
- **Audit log of approvals**: write to existing `audit_logs` table (`action='approve_user'`) so there's a trail of who approved whom.
- **Rate-limit / CAPTCHA on public signup** to prevent spam-flooding the approval queue.
- **Distinct subdomains/paths** (`/admin/login`) are *not* recommended — same `/login` with role tabs keeps things simpler and avoids leaking the admin URL.

## Out of scope (this plan)
- Email delivery, CAPTCHA, audit log writes (listed above as future).
- Changing the invitation flow — invites still auto-approve.

## Files touched
- **Migration**: new `*_approval_workflow.sql` (enum, column, trigger update, RLS tweaks, helper fn).
- **Edit**: `src/lib/auth.functions.ts`, `src/lib/admin.functions.ts`, `src/routes/_authenticated.tsx`, `src/routes/_authenticated/teacher.tsx`, `src/routes/_authenticated/admin.tsx`, `src/routes/_authenticated/admin/users.tsx`, `src/routes/login.tsx`, `src/routes/index.tsx`, `src/routes/signup.tsx` (default new signups to pending message).
- **Create**: `src/routes/_authenticated/admin/approvals.tsx`.
