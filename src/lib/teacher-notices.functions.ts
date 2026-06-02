import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notices")
      .select("*")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(1).max(120),
        body: z.string().max(2000).optional(),
        kind: z.enum(["reminder", "notice", "homework_due"]).default("notice"),
        subject_id: z.string().uuid().nullable().optional(),
        class_id: z.string().uuid().nullable().optional(),
        student_id: z.string().uuid().nullable().optional(),
        expires_at: z.string().nullable().optional(),
      })
      .refine(
        (v) => v.subject_id || v.class_id || v.student_id,
        "Pick at least one target (subject, class, or student)",
      )
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("notices")
      .insert({
        teacher_id: userId,
        title: data.title,
        body: data.body ?? null,
        kind: data.kind,
        subject_id: data.subject_id ?? null,
        class_id: data.class_id ?? null,
        student_id: data.student_id ?? null,
        expires_at: data.expires_at ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("notices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });