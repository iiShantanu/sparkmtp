-- Promote the signed-in user to teacher so they can create classes/students
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'teacher'::public.app_role FROM auth.users WHERE email = 'shantanutiwari2612@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Unique partial indexes so per-scope ai_configs upserts are clean
CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_owner_global_uidx
  ON public.ai_configs(owner_id) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_owner_scope_uidx
  ON public.ai_configs(owner_id, scope, scope_id) WHERE scope_id IS NOT NULL;