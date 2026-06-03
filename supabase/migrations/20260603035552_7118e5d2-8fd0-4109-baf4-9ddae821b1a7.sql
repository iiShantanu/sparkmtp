CREATE TABLE public.student_learning_profile (
  student_id uuid PRIMARY KEY,
  current_focus text,
  weak_topics text[] NOT NULL DEFAULT '{}',
  strong_topics text[] NOT NULL DEFAULT '{}',
  last_session_summary text,
  unresolved_doubts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.student_learning_profile TO service_role;

ALTER TABLE public.student_learning_profile ENABLE ROW LEVEL SECURITY;

-- Teachers who can see this student can read their profile (for future dashboards)
CREATE POLICY slp_read ON public.student_learning_profile
  FOR SELECT TO authenticated
  USING (is_admin() OR teacher_can_see_student(student_id) OR is_student_parent(student_id));
