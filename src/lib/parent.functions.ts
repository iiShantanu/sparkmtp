import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getParentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const links = await supabase
      .from("parent_students")
      .select("student_id,relationship,students(id,full_name,avatar_url,class_id)")
      .eq("parent_user_id", userId);
    const children = (links.data ?? []).map((l) => ({
      ...(l.students as unknown as { id: string; full_name: string; avatar_url: string | null; class_id: string | null }),
      relationship: l.relationship,
    }));

    let recentLogs: Array<{
      id: string;
      student_id: string;
      subject: string | null;
      question: string;
      created_at: string;
      needs_intervention: boolean;
    }> = [];
    if (children.length > 0) {
      const { data } = await supabase
        .from("interaction_logs")
        .select("id,student_id,subject,question,created_at,needs_intervention")
        .in(
          "student_id",
          children.map((c) => c.id),
        )
        .order("created_at", { ascending: false })
        .limit(20);
      recentLogs = data ?? [];
    }
    return { children, recentLogs };
  });

export const getChildDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ studentId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [student, logs, assignments] = await Promise.all([
      supabase.from("students").select("*").eq("id", data.studentId).maybeSingle(),
      supabase
        .from("interaction_logs")
        .select("*")
        .eq("student_id", data.studentId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("homework_assignments")
        .select("id,status,score,completed_at,homework(id,title,subject,difficulty,due_at)")
        .eq("student_id", data.studentId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      student: student.data,
      logs: logs.data ?? [],
      assignments: assignments.data ?? [],
    };
  });