import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTeacherOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: assignments } = await supabase
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", userId);
    const classIds = Array.from(
      new Set((assignments ?? []).map((a: any) => a.class_id).filter((x: any) => !!x)),
    ) as string[];
    const hasGlobal = (assignments ?? []).some((a: any) => !a.class_id);

    let classesQ = supabase.from("classes").select("id,name,section");
    let studentsQ = supabase.from("students").select("id,full_name,class_id");
    if (!hasGlobal) {
      if (classIds.length === 0) {
        return { classes: [], homework: [], students: [] };
      }
      classesQ = classesQ.in("id", classIds);
      studentsQ = studentsQ.in("class_id", classIds);
    }

    const [classes, homework, students] = await Promise.all([
      classesQ,
      supabase
        .from("homework")
        .select("id,title,subject,difficulty,due_at,created_at")
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      studentsQ,
    ]);
    return {
      classes: classes.data ?? [],
      homework: homework.data ?? [],
      students: students.data ?? [],
    };
  });

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Classes where the teacher has at least one assignment (subject in this class, or global subject)
    const { data: assignments } = await supabase
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", userId);
    const classIds = Array.from(
      new Set((assignments ?? []).map((a: any) => a.class_id).filter((x: any) => !!x)),
    );
    const hasGlobal = (assignments ?? []).some((a: any) => !a.class_id);
    if (!hasGlobal && classIds.length === 0) return [];
    let query = supabase
      .from("classes")
      .select("id,name,section,created_at")
      .order("created_at", { ascending: false });
    if (!hasGlobal) query = query.in("id", classIds as string[]);
    const { data } = await query;
    return data ?? [];
  });

export const listMySubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("teacher_subjects")
      .select("id,subject_id,class_id,subjects(id,name,code),classes(id,name,section)")
      .eq("teacher_id", userId);
    return data ?? [];
  });

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Resolve classes the teacher can see
    const { data: assignments } = await supabase
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", userId);
    const classIds = Array.from(
      new Set((assignments ?? []).map((a: any) => a.class_id).filter((x: any) => !!x)),
    );
    const hasGlobal = (assignments ?? []).some((a: any) => !a.class_id);
    let query = supabase
      .from("students")
      .select("id,full_name,roll_number,class_id,classes(name,section)")
      .order("full_name");
    if (!hasGlobal) {
      if (classIds.length === 0) return [];
      query = query.in("class_id", classIds as string[]);
    }
    const { data } = await query;
    return data ?? [];
  });

export const listHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("homework")
      .select("id,title,subject,difficulty,instructions,due_at,voice_enabled,class_id,created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(1).max(160),
        subject: z.string().min(1).max(80),
        subject_id: z.string().uuid(),
        class_id: z.string().uuid(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        instructions: z.string().max(4000).optional(),
        voice_enabled: z.boolean().optional(),
        due_at: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Verify teacher is assigned to this subject in this class (or globally)
    const { data: ts } = await supabase
      .from("teacher_subjects")
      .select("id,class_id")
      .eq("teacher_id", userId)
      .eq("subject_id", data.subject_id);
    const allowed = (ts ?? []).some(
      (r: any) => r.class_id === null || r.class_id === data.class_id,
    );
    if (!allowed) throw new Error("You are not assigned to teach this subject in this class.");
    const { data: row, error } = await supabase
      .from("homework")
      .insert({
        title: data.title,
        subject: data.subject,
        subject_id: data.subject_id,
        difficulty: data.difficulty,
        instructions: data.instructions ?? null,
        voice_enabled: data.voice_enabled ?? false,
        due_at: data.due_at ?? null,
        class_id: data.class_id,
        teacher_id: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("homework").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("owner_id", userId)
      .eq("scope", "global")
      .maybeSingle();
    return data;
  });

export const upsertMyAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        custom_prompt: z.string().max(8000),
        mode: z.enum(["guided", "direct", "hint_only", "step_by_step"]),
        complexity: z.string().min(1).max(40),
        language: z.string().min(1).max(40),
        tone: z.string().min(1).max(40),
        teaching_style: z.string().min(1).max(40),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("ai_configs")
      .select("id")
      .eq("owner_id", userId)
      .eq("scope", "global")
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase
        .from("ai_configs")
        .update({ ...data, updated_by: userId })
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ai_configs").insert({
        ...data,
        owner_id: userId,
        scope: "global",
        updated_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const aiConfigShape = z.object({
  custom_prompt: z.string().max(8000),
  mode: z.enum(["guided", "direct", "hint_only", "step_by_step"]),
  complexity: z.string().min(1).max(40),
  language: z.string().min(1).max(40),
  tone: z.string().min(1).max(40),
  teaching_style: z.string().min(1).max(40),
});

export const getStudentAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ student_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id,full_name,class_id,classes!inner(name,section,teacher_id)")
      .eq("id", data.student_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Student not found");

    const { data: cfg } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("owner_id", userId)
      .eq("scope", "student")
      .eq("scope_id", data.student_id)
      .maybeSingle();

    const { data: fallback } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("owner_id", userId)
      .eq("scope", "global")
      .maybeSingle();

    return { student, config: cfg, fallback };
  });

export const upsertStudentAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    aiConfigShape.extend({ student_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { student_id, ...cfg } = data;
    const existing = await supabase
      .from("ai_configs")
      .select("id")
      .eq("owner_id", userId)
      .eq("scope", "student")
      .eq("scope_id", student_id)
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase
        .from("ai_configs")
        .update({ ...cfg, updated_by: userId })
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ai_configs").insert({
        ...cfg,
        owner_id: userId,
        scope: "student",
        scope_id: student_id,
        updated_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteStudentAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ student_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_configs")
      .delete()
      .eq("owner_id", userId)
      .eq("scope", "student")
      .eq("scope_id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });