
-- Daily learning goals (hybrid auto/teacher)
CREATE TABLE public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  goal_date date NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','teacher')),
  set_by_user_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, goal_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_goals TO authenticated;
GRANT ALL ON public.daily_goals TO service_role;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage goals for their students"
  ON public.daily_goals FOR ALL TO authenticated
  USING (public.is_student_teacher(student_id) OR public.is_admin())
  WITH CHECK (public.is_student_teacher(student_id) OR public.is_admin());
CREATE POLICY "Parents can view their child's goals"
  ON public.daily_goals FOR SELECT TO authenticated
  USING (public.is_student_parent(student_id));
CREATE TRIGGER trg_daily_goals_touch BEFORE UPDATE ON public.daily_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Quiz attempts (Spark oral quiz mode)
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject text,
  topic text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  score integer DEFAULT 0,
  total integer DEFAULT 0,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers view quiz attempts for their students"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (public.is_student_teacher(student_id) OR public.is_admin() OR public.is_student_parent(student_id));

-- Study sessions (Pomodoro / Reading / Homework / Revision logs)
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind text NOT NULL,
  planned_minutes integer NOT NULL DEFAULT 0,
  actual_minutes integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers view study sessions for their students"
  ON public.study_sessions FOR SELECT TO authenticated
  USING (public.is_student_teacher(student_id) OR public.is_admin() OR public.is_student_parent(student_id));

-- Learning streaks (one row per student)
CREATE TABLE public.learning_streaks (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_streaks TO authenticated;
GRANT ALL ON public.learning_streaks TO service_role;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers/parents view streaks"
  ON public.learning_streaks FOR SELECT TO authenticated
  USING (public.is_student_teacher(student_id) OR public.is_admin() OR public.is_student_parent(student_id));
CREATE TRIGGER trg_learning_streaks_touch BEFORE UPDATE ON public.learning_streaks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
