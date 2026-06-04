import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireDevice } from "./device-auth.server";

// ----- Helpers -----

async function teachersForStudent(student_id: string) {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("id", student_id)
    .maybeSingle();
  const classId = (student as any)?.class_id ?? null;
  if (!classId) return [] as Array<{ teacher_id: string; subject: string | null }>;
  const { data: rows } = await supabaseAdmin
    .from("teacher_subjects")
    .select("teacher_id, subjects(name)")
    .or(`class_id.eq.${classId},class_id.is.null`);
  const map = new Map<string, { teacher_id: string; subject: string | null }>();
  for (const r of (rows ?? []) as any[]) {
    if (!map.has(r.teacher_id)) {
      map.set(r.teacher_id, { teacher_id: r.teacher_id, subject: r.subjects?.name ?? null });
    }
  }
  return Array.from(map.values());
}

async function profileMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, { full_name: string | null; avatar_url: string | null }>();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  const m = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  for (const p of (data ?? []) as any[]) {
    m.set(p.id, { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null });
  }
  return m;
}

// ----- Student device-token paths -----

export const listStudentTeachers = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const teachers = await teachersForStudent(student_id);
    const ids = teachers.map((t) => t.teacher_id);
    const profiles = await profileMap(ids);

    // unread counts (messages from teachers, not yet read by student is approximated by
    // counting teacher-sent messages with no read_at and read_at IS NULL where sender_role='teacher').
    const { data: unread } = await supabaseAdmin
      .from("student_messages")
      .select("teacher_id")
      .eq("student_id", student_id)
      .eq("sender_role", "teacher")
      .is("read_at", null);
    const unreadByTeacher = new Map<string, number>();
    for (const r of (unread ?? []) as any[]) {
      unreadByTeacher.set(r.teacher_id, (unreadByTeacher.get(r.teacher_id) ?? 0) + 1);
    }

    return teachers.map((t) => ({
      teacher_id: t.teacher_id,
      subject: t.subject,
      full_name: profiles.get(t.teacher_id)?.full_name ?? "Teacher",
      avatar_url: profiles.get(t.teacher_id)?.avatar_url ?? null,
      unread: unreadByTeacher.get(t.teacher_id) ?? 0,
    }));
  });

export const listStudentMessages = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        teacher_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);

    // Authorize: teacher must teach this student's class.
    const allowed = await teachersForStudent(student_id);
    if (!allowed.some((t) => t.teacher_id === data.teacher_id)) {
      throw new Error("Not your teacher");
    }

    const { data: rows } = await supabaseAdmin
      .from("student_messages")
      .select("id, sender_role, body, created_at, read_at")
      .eq("student_id", student_id)
      .eq("teacher_id", data.teacher_id)
      .order("created_at", { ascending: true })
      .limit(200);

    // Mark teacher → student messages as read.
    await supabaseAdmin
      .from("student_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("student_id", student_id)
      .eq("teacher_id", data.teacher_id)
      .eq("sender_role", "teacher")
      .is("read_at", null);

    return rows ?? [];
  });

export const sendStudentMessage = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        teacher_id: z.string().uuid(),
        body: z.string().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const allowed = await teachersForStudent(student_id);
    if (!allowed.some((t) => t.teacher_id === data.teacher_id)) {
      throw new Error("Not your teacher");
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("student_messages")
      .insert({
        student_id,
        teacher_id: data.teacher_id,
        sender_role: "student",
        body: data.body.trim(),
      })
      .select("id, sender_role, body, created_at, read_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

// ----- Teacher (auth) paths -----

export const listTeacherInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const teacher_id = context.userId;
    const { data: ts } = await supabaseAdmin
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", teacher_id);
    const classIds = Array.from(
      new Set((ts ?? []).map((r: any) => r.class_id).filter(Boolean)),
    );
    if (classIds.length === 0) return [];

    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, full_name, avatar_url, class_id, classes(name, section)")
      .in("class_id", classIds);

    const studentIds = (students ?? []).map((s: any) => s.id);
    if (studentIds.length === 0) return [];

    const { data: msgs } = await supabaseAdmin
      .from("student_messages")
      .select("id, student_id, sender_role, body, created_at, read_at")
      .eq("teacher_id", teacher_id)
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const lastByStudent = new Map<
      string,
      { body: string; created_at: string; sender_role: string }
    >();
    const unreadByStudent = new Map<string, number>();
    for (const m of (msgs ?? []) as any[]) {
      if (!lastByStudent.has(m.student_id)) {
        lastByStudent.set(m.student_id, {
          body: m.body,
          created_at: m.created_at,
          sender_role: m.sender_role,
        });
      }
      if (m.sender_role === "student" && !m.read_at) {
        unreadByStudent.set(m.student_id, (unreadByStudent.get(m.student_id) ?? 0) + 1);
      }
    }

    return (students ?? [])
      .map((s: any) => ({
        student_id: s.id,
        full_name: s.full_name,
        avatar_url: s.avatar_url,
        class_label: s.classes ? `${s.classes.name} ${s.classes.section ?? ""}`.trim() : null,
        last: lastByStudent.get(s.id) ?? null,
        unread: unreadByStudent.get(s.id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        const at = a.last?.created_at ?? "";
        const bt = b.last?.created_at ?? "";
        return bt.localeCompare(at);
      });
  });

export const listTeacherConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ student_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const teacher_id = context.userId;
    // Authorize: teacher must teach this student's class.
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("id, class_id")
      .eq("id", data.student_id)
      .maybeSingle();
    const classId = (s as any)?.class_id;
    if (!classId) throw new Error("Student not found");
    const { data: ts } = await supabaseAdmin
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", teacher_id)
      .eq("class_id", classId)
      .limit(1);
    if (!ts || ts.length === 0) throw new Error("Not your class");

    const { data: rows } = await supabaseAdmin
      .from("student_messages")
      .select("id, sender_role, body, created_at, read_at")
      .eq("student_id", data.student_id)
      .eq("teacher_id", teacher_id)
      .order("created_at", { ascending: true })
      .limit(200);

    await supabaseAdmin
      .from("student_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("student_id", data.student_id)
      .eq("teacher_id", teacher_id)
      .eq("sender_role", "student")
      .is("read_at", null);

    return rows ?? [];
  });

export const sendTeacherMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        student_id: z.string().uuid(),
        body: z.string().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const teacher_id = context.userId;
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("id, class_id")
      .eq("id", data.student_id)
      .maybeSingle();
    const classId = (s as any)?.class_id;
    if (!classId) throw new Error("Student not found");
    const { data: ts } = await supabaseAdmin
      .from("teacher_subjects")
      .select("class_id")
      .eq("teacher_id", teacher_id)
      .eq("class_id", classId)
      .limit(1);
    if (!ts || ts.length === 0) throw new Error("Not your class");

    const { data: inserted, error } = await supabaseAdmin
      .from("student_messages")
      .insert({
        student_id: data.student_id,
        teacher_id,
        sender_role: "teacher",
        body: data.body.trim(),
      })
      .select("id, sender_role, body, created_at, read_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });