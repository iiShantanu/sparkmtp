
CREATE TABLE public.student_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('student','teacher')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_messages_student ON public.student_messages(student_id, created_at DESC);
CREATE INDEX idx_student_messages_teacher ON public.student_messages(teacher_id, created_at DESC);
CREATE INDEX idx_student_messages_pair ON public.student_messages(student_id, teacher_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.student_messages TO authenticated;
GRANT ALL ON public.student_messages TO service_role;

ALTER TABLE public.student_messages ENABLE ROW LEVEL SECURITY;

-- Teachers can read messages for any student in a class they teach (via teacher_subjects.class_id),
-- or for any student if they are admin.
CREATE POLICY "teachers read their students messages"
  ON public.student_messages FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "teachers send messages as themselves"
  ON public.student_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'teacher'
    AND teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_subjects ts ON ts.class_id = s.class_id
      WHERE s.id = student_messages.student_id AND ts.teacher_id = auth.uid()
    )
  );

CREATE POLICY "teachers mark their messages read"
  ON public.student_messages FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
