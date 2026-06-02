DROP POLICY IF EXISTS "students_insert" ON public.students;
DROP POLICY IF EXISTS "students_read" ON public.students;
DROP POLICY IF EXISTS "students_update" ON public.students;
DROP POLICY IF EXISTS "students_delete" ON public.students;

CREATE POLICY "students_read" ON public.students
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR profile_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_student_teacher(id)
  OR public.is_student_parent(id)
);

CREATE POLICY "students_insert" ON public.students
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  )
);

CREATE POLICY "students_update" ON public.students
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR created_by = auth.uid()
  OR public.is_student_teacher(id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    created_by = auth.uid()
    AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = students.class_id
          AND c.teacher_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "students_delete" ON public.students
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR created_by = auth.uid()
  OR public.is_student_teacher(id)
);