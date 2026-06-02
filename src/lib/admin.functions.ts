import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access required");
}

// ---------- Subjects ----------
export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("subjects")
      .select("id,name,code,created_at")
      .order("name");
    return data ?? [];
  });

export const createSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ name: z.string().min(1).max(80), code: z.string().max(20).optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("subjects")
      .insert({ name: data.name, code: data.code ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Classes ----------
export const adminListClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("classes")
      .select("id,name,section,created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminCreateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ name: z.string().min(1).max(80), section: z.string().max(40).optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("classes")
      .insert({ name: data.name, section: data.section ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Students ----------
export const adminListStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("students")
      .select("id,full_name,roll_number,class_id,classes(name,section)")
      .order("full_name");
    return data ?? [];
  });

export const adminCreateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        full_name: z.string().min(1).max(120),
        class_id: z.string().uuid(),
        roll_number: z.string().max(40).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("students").insert({
      full_name: data.full_name,
      class_id: data.class_id,
      roll_number: data.roll_number ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Users / Teachers ----------
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id,full_name,email,created_at,approval_status"),
      context.supabase.from("user_roles").select("user_id,role"),
    ]);
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const a = roleMap.get(r.user_id) ?? [];
      a.push(r.role);
      roleMap.set(r.user_id, a);
    });
    return (profiles ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

// ---------- Approval queue ----------
export const adminListPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,full_name,email,created_at,approval_status")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false });
    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: roles } = ids.length
      ? await context.supabase.from("user_roles").select("user_id,role").in("user_id", ids)
      : { data: [] as any[] };
    const rmap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const a = rmap.get(r.user_id) ?? [];
      a.push(r.role);
      rmap.set(r.user_id, a);
    });
    return (profiles ?? []).map((p: any) => ({ ...p, roles: rmap.get(p.id) ?? [] }));
  });

export const adminSetApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ approval_status: data.status })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListTeacherAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("teacher_subjects")
      .select("id,teacher_id,subject_id,class_id,subjects(name),classes(name,section)");
    return data ?? [];
  });

export const adminAssignTeacherSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        teacher_id: z.string().uuid(),
        subject_id: z.string().uuid(),
        class_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_subjects").insert({
      teacher_id: data.teacher_id,
      subject_id: data.subject_id,
      class_id: data.class_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUnassignTeacherSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Parent ↔ student links ----------
export const adminListParentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("parent_students")
      .select("id,parent_user_id,student_id,relationship,students(full_name)");
    return data ?? [];
  });

export const adminLinkParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        parent_user_id: z.string().uuid(),
        student_id: z.string().uuid(),
        relationship: z.string().max(40).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("parent_students").insert({
      parent_user_id: data.parent_user_id,
      student_id: data.student_id,
      relationship: data.relationship ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUnlinkParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("parent_students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Invitations ----------
export const adminListInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("invitations")
      .select("id,email,role,token,payload,created_at,expires_at,accepted_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminCreateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "teacher", "parent"]),
        // teacher: array of {subject_id, class_id?}
        subjects: z
          .array(z.object({ subject_id: z.string().uuid(), class_id: z.string().uuid().optional() }))
          .optional(),
        // parent: array of student_ids
        students: z.array(z.string().uuid()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: Record<string, any> = {};
    if (data.subjects?.length) payload.subjects = data.subjects;
    if (data.students?.length) payload.students = data.students;
    const { data: row, error } = await context.supabase
      .from("invitations")
      .insert({
        email: data.email,
        role: data.role,
        payload: payload as any,
        created_by: context.userId,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, token: row.token };
  });

export const adminRevokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("invitations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });