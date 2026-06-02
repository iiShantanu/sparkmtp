-- 1. devices: add claimed flag
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS claimed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS devices_pairing_code_idx ON public.devices(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS devices_token_hash_idx ON public.devices(token_hash) WHERE token_hash IS NOT NULL;

-- 2. add 'subject' to ai_scope enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_scope' AND e.enumlabel = 'subject'
  ) THEN
    ALTER TYPE public.ai_scope ADD VALUE 'subject';
  END IF;
END$$;

-- 3. notices table
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  subject_id uuid,
  class_id uuid,
  student_id uuid,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'notice',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY notices_admin_all ON public.notices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY notices_teacher_rw ON public.notices
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY notices_read_targets ON public.notices
  FOR SELECT TO authenticated
  USING (
    (student_id IS NOT NULL AND (public.is_student_teacher(student_id) OR public.is_student_parent(student_id)))
    OR (class_id IS NOT NULL AND public.teacher_can_see_class(class_id))
  );

CREATE INDEX notices_target_idx ON public.notices(student_id, class_id, subject_id);
CREATE INDEX notices_active_idx ON public.notices(starts_at, expires_at);