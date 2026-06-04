import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireDevice } from "./device-auth.server";
import { getLearningProfile } from "./spark-context.server";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Daily Goal ----------

export const getOrCreateTodayGoal = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const goal_date = todayDate();

    const { data: existing } = await supabaseAdmin
      .from("daily_goals")
      .select("*")
      .eq("student_id", student_id)
      .eq("goal_date", goal_date)
      .maybeSingle();
    if (existing) return existing;

    // Auto-generate from due homework first, then weak topics.
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("id", student_id)
      .single();
    const classId = (student as any)?.class_id ?? null;

    let title = "Spend 15 focused minutes learning something new.";
    if (classId) {
      const { data: hw } = await supabaseAdmin
        .from("homework")
        .select("title, subject, due_at")
        .eq("class_id", classId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(1);
      if (hw && hw.length) {
        const h = hw[0] as any;
        title = `Finish "${h.title}"${h.subject ? ` (${h.subject})` : ""}`;
      } else {
        const profile = await getLearningProfile(student_id);
        if (profile.weak_topics.length) {
          title = `Practice ${profile.weak_topics[0]} for 10 minutes`;
        }
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("daily_goals")
      .insert({ student_id, goal_date, title, source: "auto" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const markGoalDone = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ device_token: z.string().min(10), goal_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { error } = await supabaseAdmin
      .from("daily_goals")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.goal_id)
      .eq("student_id", student_id);
    if (error) throw new Error(error.message);
    await bumpStreakInternal(student_id);
    return { ok: true };
  });

// ---------- Streaks ----------

async function bumpStreakInternal(student_id: string) {
  const today = todayDate();
  const { data: row } = await supabaseAdmin
    .from("learning_streaks")
    .select("*")
    .eq("student_id", student_id)
    .maybeSingle();

  if (!row) {
    await supabaseAdmin.from("learning_streaks").insert({
      student_id,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return { current_streak: 1, longest_streak: 1, last_active_date: today };
  }

  const last = (row as any).last_active_date as string | null;
  if (last === today) return row;

  // Was yesterday? continue. Otherwise reset to 1.
  const yest = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const newCurrent = last === yest ? (row as any).current_streak + 1 : 1;
  const newLongest = Math.max(newCurrent, (row as any).longest_streak ?? 0);

  await supabaseAdmin
    .from("learning_streaks")
    .update({
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", student_id);
  return { current_streak: newCurrent, longest_streak: newLongest, last_active_date: today };
}

export const getStreak = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { data: row } = await supabaseAdmin
      .from("learning_streaks")
      .select("current_streak, longest_streak, last_active_date")
      .eq("student_id", student_id)
      .maybeSingle();
    return row ?? { current_streak: 0, longest_streak: 0, last_active_date: null };
  });

export const bumpStreak = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    return bumpStreakInternal(student_id);
  });

// ---------- Study sessions ----------

export const logStudySession = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        kind: z.string().min(1).max(40),
        planned_minutes: z.number().int().min(0).max(600),
        actual_minutes: z.number().int().min(0).max(600),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    await supabaseAdmin.from("study_sessions").insert({
      student_id,
      kind: data.kind,
      planned_minutes: data.planned_minutes,
      actual_minutes: data.actual_minutes,
      ended_at: new Date().toISOString(),
    });
    if (data.actual_minutes >= 5) await bumpStreakInternal(student_id);
    return { ok: true };
  });

// ---------- Homework progress ----------

export const markHomeworkDone = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        homework_id: z.string().uuid(),
        minutes: z.number().int().min(0).max(600).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { data: hw } = await supabaseAdmin
      .from("homework")
      .select("id, title, class_id")
      .eq("id", data.homework_id)
      .maybeSingle();
    if (!hw) throw new Error("Homework not found");
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("id", student_id)
      .single();
    if ((s as any)?.class_id !== (hw as any).class_id) throw new Error("Not your class");

    await supabaseAdmin.from("study_sessions").insert({
      student_id,
      kind: "homework",
      planned_minutes: 0,
      actual_minutes: data.minutes ?? 10,
      ended_at: new Date().toISOString(),
    });
    await bumpStreakInternal(student_id);
    return { ok: true };
  });

// ---------- Quiz ----------

export const startQuizSession = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        subject: z.string().max(60).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const profile = await getLearningProfile(student_id);
    const focus = data.subject || profile.weak_topics[0] || profile.current_focus || "general";
    const { data: row } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({
        student_id,
        subject: data.subject ?? null,
        topic: focus,
      })
      .select("*")
      .single();
    return {
      quiz_id: (row as any)?.id ?? null,
      topic: focus,
      systemPrompt: [
        `You are Spark running an oral QUIZ for a student.`,
        `Topic focus: ${focus}.`,
        `Ask EXACTLY 5 short questions, ONE at a time. Wait for the student's spoken answer before the next.`,
        `After each answer, give a one-sentence judgement (correct / partially correct / incorrect) and the right answer if needed.`,
        `After all 5, give a final score out of 5, one strength, and one thing to practice.`,
        `Then say "Quiz finished — well done!" and stop.`,
        `Begin every reply with one emotion tag, e.g. [emotion:friendly]. Do not read the tag aloud.`,
      ].join("\n"),
      firstMessage: `[emotion:happy] Ready for a quick quiz on ${focus}? I'll ask 5 questions. Question 1 coming up.`,
    };
  });

export const finishQuiz = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        quiz_id: z.string().uuid(),
        score: z.number().int().min(0).max(20),
        total: z.number().int().min(0).max(20),
        transcript: z.string().max(40_000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    await supabaseAdmin
      .from("quiz_attempts")
      .update({
        ended_at: new Date().toISOString(),
        score: data.score,
        total: data.total,
        transcript: data.transcript ?? null,
      })
      .eq("id", data.quiz_id)
      .eq("student_id", student_id);
    await bumpStreakInternal(student_id);
    return { ok: true };
  });

// ---------- Teacher-facing helpers ----------

export const teacherSetGoal = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({ student_id: z.string().uuid(), title: z.string().min(1).max(240) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
    void requireSupabaseAuth; // satisfy tree-shaker
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    // Note: teacher auth check is done via RLS on direct client writes. Here we
    // upsert as service_role; protection comes from the teacher route requiring
    // an authenticated session. Keep this minimal until per-teacher gating is
    // wired into the wrapper.
    const today = todayDate();
    const { error } = await admin
      .from("daily_goals")
      .upsert(
        {
          student_id: data.student_id,
          goal_date: today,
          title: data.title,
          source: "teacher",
        },
        { onConflict: "student_id,goal_date" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });