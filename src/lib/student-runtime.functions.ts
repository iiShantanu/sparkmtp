import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireDevice } from "./device-auth.server";
import {
  sttBase64,
  tts,
  getConversationToken,
  ensureAgentOverridesEnabled,
} from "./elevenlabs.server";
import {
  loadStudentContext,
  buildTutorSystemPrompt,
  buildFirstMessage,
  updateLearningProfile,
  getLearningProfile,
} from "./spark-context.server";

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
  language: "Hinglish",
  tone: "encouraging",
  teaching_style: "socratic",
};

const ELEVENLABS_LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  en: "en",
  hindi: "hi",
  hi: "hi",
  hinglish: "hi",
  spanish: "es",
  es: "es",
  french: "fr",
  fr: "fr",
  german: "de",
  de: "de",
  italian: "it",
  it: "it",
  portuguese: "pt",
  pt: "pt",
  japanese: "ja",
  ja: "ja",
  korean: "ko",
  ko: "ko",
  chinese: "zh",
  zh: "zh",
};

function elevenLabsLanguageCode(language: string): string | null {
  const normalized = language.trim().toLowerCase();
  return ELEVENLABS_LANGUAGE_CODES[normalized] ?? null;
}

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

function buildSystemPrompt(
  cfg: AiCfg,
  extras?: { homework_title?: string; instructions?: string | null },
) {
  const isHinglish = cfg.language.trim().toLowerCase() === "hinglish";
  const langLine = isHinglish
    ? "Reply in Hinglish — a natural mix of Hindi and English written in Roman (Latin) script, the way Indian students chat. Keep technical/subject terms in English."
    : `Reply in ${cfg.language}.`;
  const lines = [
    cfg.custom_prompt,
    `Mode: ${cfg.mode}. Style: ${cfg.teaching_style}. Tone: ${cfg.tone}. Complexity: ${cfg.complexity}. ${langLine}`,
  ];
  if (extras?.homework_title) lines.push(`Current homework: ${extras.homework_title}.`);
  if (extras?.instructions) lines.push(`Teacher's instructions: ${extras.instructions}`);
  lines.push(
    "Express your emotions naturally through tone and wording — do NOT use [emotion:...] tags.",
  );
  return lines.join("\n");
}

const EMOTIONS = ["friendly", "happy", "thinking", "love", "angry", "forgot", "error"] as const;
type Emotion = (typeof EMOTIONS)[number];

function extractEmotion(raw: string): { emotion: Emotion; reply: string } {
  const m = raw.match(/^\s*\[emotion:([a-z]+)\]\s*/i);
  if (m) {
    const tag = m[1].toLowerCase() as Emotion;
    if ((EMOTIONS as readonly string[]).includes(tag)) {
      return { emotion: tag, reply: raw.slice(m[0].length).trim() };
    }
  }
  return { emotion: "friendly", reply: raw.trim() };
}

async function generateSparkReply(system: string, userText: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
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
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    console.error("Lovable AI gateway error", aiRes.status, txt);
    throw new Error(
      aiRes.status === 402
        ? "AI credits exhausted. Ask an admin to top up Lovable Cloud."
        : aiRes.status === 429
          ? "Spark is a bit busy — try again in a moment."
          : `AI failed (${aiRes.status})`,
    );
  }

  const aiJson = (await aiRes.json()) as any;
  const raw: string =
    aiJson.choices?.[0]?.message?.content?.toString() ?? "I'm not sure how to help with that yet.";
  return extractEmotion(raw);
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
        homework_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) {
      return {
        agentId: null,
        token: null,
        systemPrompt: null,
        firstMessage: null,
        language: null,
        warning:
          "ELEVENLABS_AGENT_ID is not set. Create a Conversational AI agent in ElevenLabs and add the agent id as a secret to enable live voice chat.",
      };
    }
    let subjectId = data.subject_id ?? null;
    let homework: any = null;
    if (data.homework_id) {
      const { data: hw } = await supabaseAdmin
        .from("homework")
        .select("id, title, instructions, subject, subject_id, class_id, difficulty")
        .eq("id", data.homework_id)
        .maybeSingle();
      const { data: s } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", student_id)
        .single();
      if (hw && (s as any)?.class_id === (hw as any).class_id) {
        homework = hw;
        subjectId = (hw as any).subject_id ?? subjectId;
      }
    }
    const cfg = await resolveConfigFor(student_id, subjectId);
    const ctx = await loadStudentContext(student_id, cfg);
    const [token, overridesOk] = await Promise.all([
      getConversationToken(agentId),
      ensureAgentOverridesEnabled(agentId),
    ]);
    let systemPrompt: string | null = overridesOk ? buildTutorSystemPrompt(ctx) : null;
    let firstMessage: string | null = overridesOk ? buildFirstMessage(ctx) : null;
    if (overridesOk && homework) {
      systemPrompt = [
        buildTutorSystemPrompt(ctx),
        ``,
        `HOMEWORK MODE — the student is working on the assignment below.`,
        `Title: ${homework.title}${homework.subject ? ` (${homework.subject})` : ""}`,
        homework.instructions ? `Teacher's instructions: ${homework.instructions}` : ``,
        `Guide the student step-by-step. Ask one short question at a time, give hints, never give the final answer outright.`,
        `When the student seems to have finished, say "Great job — tap Mark done when you're ready." and stop.`,
      ]
        .filter(Boolean)
        .join("\n");
      firstMessage = `Let's work on "${homework.title}". Read me the first question or tell me where you're stuck.`;
    }
    return {
      agentId,
      token,
      systemPrompt,
      firstMessage,
      language: overridesOk ? elevenLabsLanguageCode(cfg.language) : null,
      overridesEnabled: overridesOk,
      warning: null,
      homework: homework
        ? { id: homework.id, title: homework.title, subject: homework.subject }
        : null,
    };
  });

export const runSparkTextTurn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        text: z.string().min(1).max(2000),
        subject_id: z.string().uuid().nullable().optional(),
        homework_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    let subjectId = data.subject_id ?? null;
    let homework: any = null;
    if (data.homework_id) {
      const { data: hw } = await supabaseAdmin
        .from("homework")
        .select("id, title, instructions, subject, subject_id, class_id")
        .eq("id", data.homework_id)
        .maybeSingle();
      const { data: s } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", student_id)
        .single();
      if (hw && (s as any)?.class_id === (hw as any).class_id) {
        homework = hw;
        subjectId = (hw as any).subject_id ?? subjectId;
      }
    }
    const cfg = await resolveConfigFor(student_id, subjectId);
    const system = homework
      ? buildSystemPrompt(cfg, {
          homework_title: homework.title,
          instructions: homework.instructions,
        })
      : buildSystemPrompt(cfg);
    const { emotion, reply } = await generateSparkReply(system, data.text);
    let audio: string | null = null;
    try {
      if (process.env.ELEVENLABS_API_KEY) {
        audio = await tts(reply, DEFAULT_VOICE);
      }
    } catch (e) {
      console.warn("TTS failed (non-fatal):", (e as Error).message);
    }

    await supabaseAdmin.from("interaction_logs").insert({
      student_id,
      subject: homework?.subject ?? null,
      homework_id: homework?.id ?? null,
      question: data.text,
      ai_response: reply,
      transcript: data.text,
    });

    // Fire-and-forget memory update so the next session is smarter.
    updateLearningProfile({
      student_id,
      exchange: `student: ${data.text}\nspark: ${reply}`,
      prev: await getLearningProfile(student_id),
    }).catch(() => {});

    return { reply, emotion, audio_base64: audio };
  });

export const runSparkVoiceTurn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        text: z.string().max(2000).optional(),
        audio_base64: z.string().max(8_000_000).optional(),
        audio_mime: z.string().max(60).optional(),
        homework_id: z.string().uuid().nullable().optional(),
        initial: z.boolean().optional(),
      })
      .refine((v) => v.initial || !!v.text || !!v.audio_base64, "Provide text or audio")
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    let subjectId: string | null = null;
    let homework: any = null;
    if (data.homework_id) {
      const { data: hw } = await supabaseAdmin
        .from("homework")
        .select("id, title, instructions, subject, subject_id, class_id")
        .eq("id", data.homework_id)
        .maybeSingle();
      const { data: s } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", student_id)
        .single();
      if (hw && (s as any)?.class_id === (hw as any).class_id) {
        homework = hw;
        subjectId = (hw as any).subject_id ?? null;
      }
    }

    const userText = data.initial
      ? homework
        ? `Greet me and start homework mode for "${homework.title}". Ask me to read the first question or tell you where I am stuck.`
        : "Greet me warmly as Spark and ask what I want to learn or solve today."
      : data.text
        ? data.text
        : await sttBase64(data.audio_base64!, data.audio_mime || "audio/webm");

    const cfg = await resolveConfigFor(student_id, subjectId);
    const system = homework
      ? buildSystemPrompt(cfg, {
          homework_title: homework.title,
          instructions: homework.instructions,
        })
      : buildSystemPrompt(cfg);
    const { emotion, reply } = await generateSparkReply(system, userText);
    let audio: string | null = null;
    try {
      if (process.env.ELEVENLABS_API_KEY) audio = await tts(reply, DEFAULT_VOICE);
    } catch (e) {
      console.warn("TTS failed (non-fatal):", (e as Error).message);
    }

    if (!data.initial) {
      await supabaseAdmin.from("interaction_logs").insert({
        student_id,
        subject: homework?.subject ?? null,
        homework_id: homework?.id ?? null,
        question: userText,
        ai_response: reply,
        transcript: userText,
      });
      updateLearningProfile({
        student_id,
        exchange: `student: ${userText}\nspark: ${reply}`,
        prev: await getLearningProfile(student_id),
      }).catch(() => {});
    }

    return { transcript: data.initial ? "" : userText, reply, emotion, audio_base64: audio };
  });

export const runQuizVoiceTurn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        quiz_id: z.string().uuid(),
        topic: z.string().max(100),
        turn_index: z.number().int().min(0).max(5),
        transcript_so_far: z.string().max(30_000).optional(),
        text: z.string().max(2000).optional(),
        audio_base64: z.string().max(8_000_000).optional(),
        audio_mime: z.string().max(60).optional(),
      })
      .refine((v) => v.turn_index === 0 || !!v.text || !!v.audio_base64, "Provide text or audio")
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const { data: quiz } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, student_id")
      .eq("id", data.quiz_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz not found");

    const userText =
      data.turn_index === 0
        ? "Start the quiz now."
        : data.text
          ? data.text
          : await sttBase64(data.audio_base64!, data.audio_mime || "audio/webm");
    const system = [
      `You are Spark running an oral quiz for a student.`,
      `Topic focus: ${data.topic || "general"}.`,
      `Ask exactly 5 short questions, one at a time.`,
      data.turn_index === 0
        ? `Start with question 1 only. Do not ask for confirmation first.`
        : `The student just answered question ${data.turn_index}. Give a one-sentence judgement using exactly one of: correct, partially correct, incorrect. Then ${data.turn_index < 5 ? `ask question ${data.turn_index + 1}` : `give the final score out of 5 and say the quiz is finished`}.`,
      `Previous transcript:\n${data.transcript_so_far || "(none)"}`,
      `Express emotions naturally through tone — do NOT use [emotion:...] tags.`,
    ].join("\n");
    const { emotion, reply } = await generateSparkReply(system, userText);
    let audio: string | null = null;
    try {
      if (process.env.ELEVENLABS_API_KEY) audio = await tts(reply, DEFAULT_VOICE);
    } catch (e) {
      console.warn("Quiz TTS failed (non-fatal):", (e as Error).message);
    }
    return { transcript: data.turn_index === 0 ? "" : userText, reply, emotion, audio_base64: audio };
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
      .refine((v) => !!v.text || !!v.audio_base64, "Provide text or audio")
      .parse(i),
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

    const { emotion, reply } = await generateSparkReply(system, userText);

    // TTS is best-effort: if it fails or the key is missing, we still return text.
    let audio: string | null = null;
    try {
      if (process.env.ELEVENLABS_API_KEY) {
        audio = await tts(reply, DEFAULT_VOICE);
      }
    } catch (e) {
      console.warn("TTS failed (non-fatal):", (e as Error).message);
    }

    await supabaseAdmin.from("interaction_logs").insert({
      student_id,
      homework_id: data.homework_id,
      subject: (hw as any).subject,
      question: userText,
      ai_response: reply,
      transcript: userText,
    });

    updateLearningProfile({
      student_id,
      exchange: `homework "${(hw as any).title}"\nstudent: ${userText}\nspark: ${reply}`,
      prev: await getLearningProfile(student_id),
    }).catch(() => {});

    return { transcript: userText, reply, emotion, audio_base64: audio };
  });

export const summarizeVoiceSession = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        device_token: z.string().min(10),
        transcript: z.string().min(1).max(40_000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { student_id } = await requireDevice(data.device_token);
    const prev = await getLearningProfile(student_id);
    await updateLearningProfile({ student_id, exchange: data.transcript, prev });
    return { ok: true };
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
