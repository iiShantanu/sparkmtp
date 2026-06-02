
-- 1. Subjects catalog
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- 2. Teacher ↔ subject (+ optional class) assignments
CREATE TABLE public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, subject_id, class_id)
);
CREATE INDEX idx_teacher_subjects_teacher ON public.teacher_subjects(teacher_id);
CREATE INDEX idx_teacher_subjects_class ON public.teacher_subjects(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT ALL ON public.teacher_subjects TO service_role;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

-- 3. Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user_id uuid
);
CREATE INDEX idx_invitations_email ON public.invitations(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 4. Columns on existing tables
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id);
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id);

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION public.teacher_teaches(_subject_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.subject_id = _subject_id
      AND (ts.class_id IS NULL OR ts.class_id = _class_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_see_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teacher_subjects ts ON ts.teacher_id = auth.uid()
    WHERE s.id = _student_id
      AND (ts.class_id = s.class_id OR ts.class_id IS NULL)
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_see_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    WHERE ts.teacher_id = auth.uid()
      AND (ts.class_id = _class_id OR ts.class_id IS NULL)
  )
$$;

-- 6. RLS policies on new tables
CREATE POLICY subjects_read ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY subjects_admin_write ON public.subjects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY ts_read ON public.teacher_subjects FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY ts_admin_write ON public.teacher_subjects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY invitations_admin_all ON public.invitations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Rewrite RLS on existing tables
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;
DROP POLICY IF EXISTS classes_read   ON public.classes;

CREATE POLICY classes_admin_write ON public.classes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY classes_read ON public.classes FOR SELECT TO authenticated USING (
  public.is_admin()
  OR public.teacher_can_see_class(id)
  OR EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.parent_students ps ON ps.student_id = s.id
    WHERE s.class_id = classes.id AND ps.parent_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS students_insert ON public.students;
DROP POLICY IF EXISTS students_update ON public.students;
DROP POLICY IF EXISTS students_delete ON public.students;
DROP POLICY IF EXISTS students_read   ON public.students;

CREATE POLICY students_admin_write ON public.students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY students_read ON public.students FOR SELECT TO authenticated USING (
  public.is_admin()
  OR profile_id = auth.uid()
  OR public.teacher_can_see_student(id)
  OR public.is_student_parent(id)
);

DROP POLICY IF EXISTS homework_insert ON public.homework;
DROP POLICY IF EXISTS homework_update ON public.homework;
DROP POLICY IF EXISTS homework_delete ON public.homework;
DROP POLICY IF EXISTS homework_read   ON public.homework;

CREATE POLICY homework_insert ON public.homework FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
  OR (
    teacher_id = auth.uid()
    AND subject_id IS NOT NULL
    AND class_id IS NOT NULL
    AND public.teacher_teaches(subject_id, class_id)
  )
);
CREATE POLICY homework_update ON public.homework FOR UPDATE TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());
CREATE POLICY homework_delete ON public.homework FOR DELETE TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());
CREATE POLICY homework_read ON public.homework FOR SELECT TO authenticated USING (
  public.is_admin()
  OR teacher_id = auth.uid()
  OR (subject_id IS NOT NULL AND class_id IS NOT NULL AND public.teacher_teaches(subject_id, class_id))
  OR EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    JOIN public.students s ON s.id = ha.student_id
    WHERE ha.homework_id = homework.id
      AND (s.profile_id = auth.uid() OR public.is_student_parent(s.id))
  )
);

-- ai_configs: keep owner_all (admin or owner), but block teachers writing student-scope rows for students they don't teach
DROP POLICY IF EXISTS ai_configs_owner_all ON public.ai_configs;
CREATE POLICY ai_configs_rw ON public.ai_configs FOR ALL TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (
    public.is_admin()
    OR (
      owner_id = auth.uid()
      AND (
        scope = 'global'
        OR (scope = 'student' AND scope_id IS NOT NULL AND public.teacher_can_see_student(scope_id))
      )
    )
  );

-- 8. Invitation-aware signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _full_name text;
  _invite_token text;
  _invite public.invitations%ROWTYPE;
  _assign jsonb;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF _invite_token IS NOT NULL THEN
    SELECT * INTO _invite FROM public.invitations
      WHERE token = _invite_token AND accepted_at IS NULL AND expires_at > now()
      LIMIT 1;
  END IF;

  IF _invite.id IS NOT NULL THEN
    _role := _invite.role;
  ELSE
    BEGIN
      _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'parent');
    EXCEPTION WHEN OTHERS THEN
      _role := 'parent';
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, _full_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _invite.id IS NOT NULL THEN
    -- teacher_subjects: payload.subjects = [{subject_id, class_id}]
    IF _role = 'teacher' AND jsonb_typeof(_invite.payload->'subjects') = 'array' THEN
      FOR _assign IN SELECT jsonb_array_elements(_invite.payload->'subjects') LOOP
        INSERT INTO public.teacher_subjects (teacher_id, subject_id, class_id)
        VALUES (
          NEW.id,
          (_assign->>'subject_id')::uuid,
          NULLIF(_assign->>'class_id','')::uuid
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- parent_students: payload.students = [student_id, ...]
    IF _role = 'parent' AND jsonb_typeof(_invite.payload->'students') = 'array' THEN
      FOR _assign IN SELECT jsonb_array_elements(_invite.payload->'students') LOOP
        INSERT INTO public.parent_students (parent_user_id, student_id)
        VALUES (NEW.id, (_assign #>> '{}')::uuid)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    UPDATE public.invitations
      SET accepted_at = now(), accepted_user_id = NEW.id
      WHERE id = _invite.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 9. Ensure admin exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'shantanutiwari2612@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
