
-- Approval workflow
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.profiles
  ADD COLUMN approval_status public.approval_status NOT NULL DEFAULT 'pending';

-- Existing users are grandfathered as approved
UPDATE public.profiles SET approval_status = 'approved';

-- Helper
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND approval_status = 'approved')
$$;

-- Update handle_new_user: invite => approved, self-signup => pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _full_name text;
  _invite_token text;
  _invite public.invitations%ROWTYPE;
  _assign jsonb;
  _approval public.approval_status;
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
    _approval := 'approved';
  ELSE
    BEGIN
      _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'parent');
    EXCEPTION WHEN OTHERS THEN
      _role := 'parent';
    END;
    _approval := 'pending';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, approval_status)
  VALUES (NEW.id, _full_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url', _approval)
  ON CONFLICT (id) DO UPDATE SET approval_status = EXCLUDED.approval_status;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _invite.id IS NOT NULL THEN
    IF _role = 'teacher' AND jsonb_typeof(_invite.payload->'subjects') = 'array' THEN
      FOR _assign IN SELECT jsonb_array_elements(_invite.payload->'subjects') LOOP
        INSERT INTO public.teacher_subjects (teacher_id, subject_id, class_id)
        VALUES (NEW.id, (_assign->>'subject_id')::uuid, NULLIF(_assign->>'class_id','')::uuid)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
    IF _role = 'parent' AND jsonb_typeof(_invite.payload->'students') = 'array' THEN
      FOR _assign IN SELECT jsonb_array_elements(_invite.payload->'students') LOOP
        INSERT INTO public.parent_students (parent_user_id, student_id)
        VALUES (NEW.id, (_assign #>> '{}')::uuid)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
    UPDATE public.invitations SET accepted_at = now(), accepted_user_id = NEW.id WHERE id = _invite.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Allow admin to update profiles (for approval)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT TO authenticated USING (is_admin());
