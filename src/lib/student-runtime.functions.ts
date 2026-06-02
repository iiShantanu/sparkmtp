import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireDevice } from "./device-auth.server";
import { sttBase64, tts, getConversationToken } from "./elevenlabs.server";

const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah

type AiCfg = {
  custom_prompt: string;
  mode: string;
  complexity: string;
  language: string;
  tone: string;
  teaching_style: string;
};

const BUILT_IN: AiCfg = {
  custom_prompt:
    "You are Spark, a kind classroom AI tutor. Encourage the student, explain step by step, and never give the final answer outright — guide them to discover it.",
  mode: "guided",
  complexity: "grade_level",
  language: "English",
  tone: "encouraging",
  teaching_style: "socratic",
};

async function resolveConfigFor(
  student_id: string,
  subject_id: string | null,
): Promise<AiCfg & { source: "student" | "subject" | "global" | "default" }> {
  // 1. student override (any teacher) — pick the most recently updated
  const { data: studentOverrides } = await supabaseAdmin
    .from("ai_configs")
    .select("*")
    .eq("scope", "student")
    .eq("scope_id", student_id)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (studentOverrides && studentOverrides.length) {
    return { ...(studentOverrides[0] as any), source: "student" };
  }

  if (subject_id) {
    // 2. teacher who teaches this subject (any class) — subject scope
    const { data: ts } = await supabaseAdmin
      .from("teacher_subjects")
      .select("teacher_id")
      .eq("subject_id", subject_id);
    const teacherIds = Array.from(new Set((ts ?? []).map((r: any) => r.teacher_id)));

    if (teacherIds.length) {
      const { data: subj } = await supabaseAdmin
        .from("ai_configs")
        .select("*")
        .eq("scope", "subject")
        .eq("scope_id", subject_id)
        .in("owner_id", teacherIds)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (subj && subj.length) return { ...(subj[0] as any), source: "subject" };

      // 3. teacher global
      const { data: glb } = await supabaseAdmin
        .from("ai_configs")
        .select("*")
        .eq("scope", "global")
        .in("owner_id", teacherIds)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (glb && glb.length) return { ...(glb[0] as any), source: "global" };
    }
  }

  return { ...BUILT_IN, source: "default" };
}

function buildSystemPrompt(cfg: AiCfg, extras?: { homework_title?: string; instructions?: string | null }) {
  const lines = [
    cfg.custom_prompt,
    `Mode: ${cfg.mode}. Style: ${cfg.teaching_style}. Tone: ${cfg.tone}. Complexity: ${cfg.complexity}. Reply in ${cfg.language}.`,
  ];
  if (extras?.homework_title) lines.push(`Current homework: ${extras.homework_title}.`);
  if (extras?.instructions) lines.push(`Teacher's instructions: ${extras.instructions}`);
  return lines.join("\n");
}

// ---------- public, device-token-authed functions ----------

export const getStudentSession = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, class_id, avatar_url, classes(name, section)")
      .eq("id", student_id)
      .single();

    const classId = (student as any)?.class_id;
    const { data: subjectRows } = classId
      ? await supabaseAdmin
          .from("teacher_subjects")
          .select("subject_id, subjects(id, name, code)")
          .or(`class_id.eq.${classId},class_id.is.null`)
      : { data: [] as any[] };
    const subjectsMap = new Map<string, { id: string; name: string; code: string | null }>();
    for (const r of (subjectRows ?? []) as any[]) {
      const s = r.subjects;
      if (s) subjectsMap.set(s.id, s);
    }
    const subjects = Array.from(subjectsMap.values());

    const { data: homework } = classId
      ? await supabaseAdmin
          .from("homework")
          .select("id, title, subject, subject_id, difficulty, instructions, due_at, voice_enabled")
          .eq("class_id", classId)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(20)
      : { data: [] as any[] };

    const nowIso = new Date().toISOString();
    const orParts = [`student_id.eq.${student_id}`];
    if (classId) orParts.push(`class_id.eq.${classId}`);
    const { data: notices } = await supabaseAdmin
      .from("notices")
      .select("id, title, body, kind, starts_at, expires_at, subject_id, class_id, student_id")
      .or(orParts.join(","))
      .lte("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(25);

    const activeNotices = (notices ?? []).filter(
      (n: any) => !n.expires_at || n.expires_at > nowIso,
    );

    return { student, subjects, homework: homework ?? [], notices: activeNotices };
  });

export const getResolvedAiConfig = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        subject_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    return resolveConfigFor(student_id, data.subject_id ?? null);
  });

export const startVoiceConversation = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        subject_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireDevice(data.device_token);
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) {
      return {
        agentId: null,
        token: null,
        warning:
          "ELEVENLABS_AGENT_ID is not set. Create a Conversational AI agent in ElevenLabs and add the agent id as a secret to enable live voice chat.",
      };
    }
    const token = await getConversationToken(agentId);
    return { agentId, token, warning: null };
  });

// Homework drill turn: STT (optional) → Lovable AI → TTS
export const runHomeworkTurn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        homework_id: z.string().uuid(),
        text: z.string().max(2000).optional(),
        audio_base64: z.string().max(8_000_000).optional(),
        audio_mime: z.string().max(60).optional(),
      })
      .refine((v) => !!v.text || !!v.audio_base64, "Provide text or audio"),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { data: hw } = await supabaseAdmin
      .from("homework")
      .select("id, title, instructions, subject, subject_id, class_id")
      .eq("id", data.homework_id)
      .maybeSingle();
    if (!hw) throw new Error("Homework not found");

    // Authorization: student's class must match
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("id", student_id)
      .single();
    if ((s as any)?.class_id !== (hw as any).class_id) {
      throw new Error("Not your class");
    }

    const userText = data.text
      ? data.text
      : await sttBase64(data.audio_base64!, data.audio_mime || "audio/webm");

    const cfg = await resolveConfigFor(student_id, (hw as any).subject_id);
    const system = buildSystemPrompt(cfg, {
      homework_title: (hw as any).title,
      instructions: (hw as any).instructions,
    });

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`AI failed: ${aiRes.status} ${await aiRes.text()}`);
    const aiJson = (await aiRes.json()) as any;
    const reply: string =
      aiJson.choices?.[0]?.message?.content?.toString() ?? "I'm not sure how to help with that yet.";

    const audio = await tts(reply, DEFAULT_VOICE);

    await supabaseAdmin.from("interaction_logs").insert({
      student_id,
      homework_id: data.homework_id,
      subject: (hw as any).subject,
      question: userText,
      ai_response: reply,
      transcript: userText,
    });

    return { transcript: userText, reply, audio_base64: audio };
  });

export const ackNotice = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        notice_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // Lightweight: just verify token. We don't track per-device ack yet.
    await requireDevice(data.device_token);
    return { ok: true, notice_id: data.notice_id };
  });