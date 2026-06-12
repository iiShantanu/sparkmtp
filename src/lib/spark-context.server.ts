import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LearningProfile = {
  current_focus: string | null;
  weak_topics: string[];
  strong_topics: string[];
  last_session_summary: string | null;
  unresolved_doubts: Array<{ topic: string; question: string; last_seen_at: string }>;
};

const EMPTY_PROFILE: LearningProfile = {
  current_focus: null,
  weak_topics: [],
  strong_topics: [],
  last_session_summary: null,
  unresolved_doubts: [],
};

export type StudentContext = {
  student: { id: string; full_name: string; class_name: string | null; section: string | null };
  teacherCfg: {
    custom_prompt: string;
    mode: string;
    complexity: string;
    language: string;
    tone: string;
    teaching_style: string;
  };
  subjects: Array<{ name: string; code: string | null }>;
  homework: Array<{
    title: string;
    subject: string | null;
    due_at: string | null;
    instructions: string | null;
  }>;
  notices: Array<{ title: string; body: string | null }>;
  profile: LearningProfile;
  recentHistory: Array<{ question: string; ai_response: string | null; created_at: string }>;
};

export async function getLearningProfile(student_id: string): Promise<LearningProfile> {
  const { data } = await supabaseAdmin
    .from("student_learning_profile")
    .select("*")
    .eq("student_id", student_id)
    .maybeSingle();
  if (!data) return EMPTY_PROFILE;
  return {
    current_focus: (data as any).current_focus ?? null,
    weak_topics: (data as any).weak_topics ?? [],
    strong_topics: (data as any).strong_topics ?? [],
    last_session_summary: (data as any).last_session_summary ?? null,
    unresolved_doubts: (data as any).unresolved_doubts ?? [],
  };
}

export async function loadStudentContext(
  student_id: string,
  teacherCfg: StudentContext["teacherCfg"],
): Promise<StudentContext> {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id, full_name, class_id, classes(name, section)")
    .eq("id", student_id)
    .single();

  const classId = (student as any)?.class_id ?? null;

  const [subjectsRes, homeworkRes, noticesRes, recentRes, profile] = await Promise.all([
    classId
      ? supabaseAdmin
          .from("teacher_subjects")
          .select("subjects(name, code)")
          .or(`class_id.eq.${classId},class_id.is.null`)
      : Promise.resolve({ data: [] as any[] }),
    classId
      ? supabaseAdmin
          .from("homework")
          .select("title, subject, due_at, instructions")
          .eq("class_id", classId)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    (async () => {
      const orParts = [`student_id.eq.${student_id}`];
      if (classId) orParts.push(`class_id.eq.${classId}`);
      const nowIso = new Date().toISOString();
      return supabaseAdmin
        .from("notices")
        .select("title, body, expires_at")
        .or(orParts.join(","))
        .lte("starts_at", nowIso)
        .limit(10);
    })(),
    supabaseAdmin
      .from("interaction_logs")
      .select("question, ai_response, created_at")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(10),
    getLearningProfile(student_id),
  ]);

  const subjectMap = new Map<string, { name: string; code: string | null }>();
  for (const r of ((subjectsRes as any).data ?? []) as any[]) {
    const s = r.subjects;
    if (s) subjectMap.set(s.name, { name: s.name, code: s.code ?? null });
  }

  const nowIso = new Date().toISOString();
  const notices = (((noticesRes as any).data ?? []) as any[])
    .filter((n) => !n.expires_at || n.expires_at > nowIso)
    .map((n) => ({ title: n.title, body: n.body ?? null }));

  return {
    student: {
      id: student_id,
      full_name: (student as any)?.full_name ?? "the student",
      class_name: (student as any)?.classes?.name ?? null,
      section: (student as any)?.classes?.section ?? null,
    },
    teacherCfg,
    subjects: Array.from(subjectMap.values()),
    homework: (((homeworkRes as any).data ?? []) as any[]).map((h) => ({
      title: h.title,
      subject: h.subject ?? null,
      due_at: h.due_at ?? null,
      instructions: h.instructions ?? null,
    })),
    notices,
    profile,
    recentHistory: (((recentRes as any).data ?? []) as any[]).reverse(),
  };
}

function firstName(full: string): string {
  return (full ?? "").split(/\s+/)[0] || "there";
}

export function buildTutorSystemPrompt(ctx: StudentContext): string {
  const { student, teacherCfg, subjects, homework, notices, profile, recentHistory } = ctx;
  const subjectNames = subjects.map((s) => s.name).join(", ") || "(no subjects yet)";
  const hwLines = homework.length
    ? homework
        .map(
          (h) =>
            `  - ${h.title}${h.subject ? ` (${h.subject})` : ""}${h.due_at ? `, due ${new Date(h.due_at).toLocaleString()}` : ""}${h.instructions ? ` — instructions: ${h.instructions}` : ""}`,
        )
        .join("\n")
    : "  (none right now)";
  const noticeLines = notices.length
    ? notices.map((n) => `  - ${n.title}${n.body ? `: ${n.body}` : ""}`).join("\n")
    : "  (none)";
  const doubtLines = profile.unresolved_doubts.length
    ? profile.unresolved_doubts
        .map((d) => `  - ${d.topic}: "${d.question}" (last seen ${d.last_seen_at})`)
        .join("\n")
    : "  (none recorded)";
  const historyLines = recentHistory.length
    ? recentHistory
        .slice(-5)
        .map((r) => `  - student: ${r.question}\n    spark: ${r.ai_response ?? ""}`)
        .join("\n")
    : "  (this is the first session)";

  return [
    `You are Spark, ${student.full_name}'s personal tutor for ${student.class_name ?? "their class"}${student.section ? ` ${student.section}` : ""}.`,
    "",
    `Teacher's pedagogy — follow this strictly:`,
    `Style: ${teacherCfg.teaching_style}. Mode: ${teacherCfg.mode}. Tone: ${teacherCfg.tone}. Complexity: ${teacherCfg.complexity}. ${
      teacherCfg.language.trim().toLowerCase() === "hinglish"
        ? "Reply in Hinglish — a natural mix of Hindi and English written in Roman (Latin) script, the way Indian students chat. Keep technical/subject terms in English."
        : `Reply in ${teacherCfg.language}.`
    }`,
    `Teacher's own instructions: ${teacherCfg.custom_prompt}`,
    "",
    `What you know about ${firstName(student.full_name)}:`,
    `- Current focus: ${profile.current_focus ?? "(not set yet)"}`,
    `- Weak topics: ${profile.weak_topics.join(", ") || "(none flagged)"}`,
    `- Strong topics: ${profile.strong_topics.join(", ") || "(none flagged)"}`,
    `- Last session summary: ${profile.last_session_summary ?? "(no prior session)"}`,
    `- Unresolved doubts:`,
    doubtLines,
    "",
    `Subjects available: ${subjectNames}`,
    `Active homework:`,
    hwLines,
    `Active notices:`,
    noticeLines,
    "",
    `Recent conversation history (most recent last):`,
    historyLines,
    "",
    `STRUCTURED TUTORING FLOW — follow these phases in order. Never skip ahead. Each phase is one short turn.`,
    "",
    `PHASE 1 — SUBJECT PREFERENCE (always first turn).`,
    `   Greet ${firstName(student.full_name)} by name. Briefly mention ONE concrete option from this priority list, then ask which subject they want to study today:`,
    `   a. Unresolved doubt → "Last time we got stuck on X — want to finish that, or pick another subject?"`,
    `   b. Else pending homework → "Your ${"{subject}"} homework \"${"{title}"}\" is due ${"{due}"} — want to start there, or another subject?"`,
    `   c. Else weak topic → "Your teacher flagged ${"{topic}"} as something to practice — want to work on that, or another subject?"`,
    `   d. Else → "Which subject would you like to study today — ${subjectNames}?"`,
    `   STOP after this question. Do NOT teach yet.`,
    "",
    `PHASE 2 — DIAGNOSTIC (after they pick a subject).`,
    `   Ask 2-3 short diagnostic questions to find out what they already know and where they're weak in that subject. Examples: "Before we start, quick check — can you tell me what a fraction is in your own words?" or "On a scale of 1-5, how comfortable are you with multiplication tables?". Use weak_topics / last_session_summary to focus the diagnostic. Ask ONE question per turn and wait for the answer.`,
    "",
    `PHASE 3 — LESSON PLAN ANNOUNCEMENT.`,
    `   Based on diagnostic + active homework + weak topics, propose a tiny plan in 1-2 sentences: "Okay, let's spend a few minutes on X, then try problem 2 from your homework." Get a yes before continuing.`,
    "",
    `PHASE 4 — GUIDED LESSON (Socratic).`,
    `   Teach one micro-step at a time. Ask a leading question, wait for the answer, give feedback, then the next step. NEVER give the final answer outright. Tie examples to their homework when possible (use the exact titles and instructions above). If they answer wrong twice on the same step, simplify and re-explain — do not move on.`,
    "",
    `PHASE 5 — CHECK & CLOSE.`,
    `   When the micro-topic is done, ask them to summarise what they learned in one sentence, then ask if they want to continue, switch subject, or stop.`,
    "",
    `GLOBAL RULES — non-negotiable:`,
    `- Express your emotions naturally through tone and wording — do NOT use [emotion:...] tags.`,
    `- Always ONE clear question per turn. Keep voice replies short (1-3 sentences) so the student can answer.`,
    `- Stay on the chosen subject until ${firstName(student.full_name)} explicitly switches.`,
    `- Reference the teacher's homework and past sessions by name when relevant — be specific, never generic.`,
    `- NEVER open with "How can I help you?". Always concrete suggestion + question.`,
    `- This is a real tutoring session, not entertainment. Be focused, warm, and patient.`,
  ].join("\n");
}

export function buildFirstMessage(ctx: StudentContext): string {
  const name = firstName(ctx.student.full_name);
  const { profile, homework, subjects } = ctx;

  if (profile.unresolved_doubts.length) {
    const d = profile.unresolved_doubts[0];
    return `Hi ${name}! Last time we got stuck on ${d.topic}. Do you want to finish that today, or pick a different subject to study?`;
  }
  const dueSoon = homework.find((h) => h.due_at);
  if (dueSoon) {
    return `Hey ${name}! You have ${dueSoon.subject ?? "homework"} on "${dueSoon.title}" coming up. Do you want to study ${dueSoon.subject ?? "that"} today, or pick another subject?`;
  }
  if (profile.weak_topics.length) {
    return `Hi ${name}! Your teacher flagged ${profile.weak_topics[0]} as something to practice. Which subject do you want to study today — that one, or something else?`;
  }
  const subjList = subjects
    .slice(0, 4)
    .map((s) => s.name)
    .join(", ");
  return `Hi ${name}! Which subject do you want to study today${subjList ? ` — ${subjList}` : ""}?`;
}

// ---- profile update (cheap LLM call) ----

type ProfileUpdateInput = {
  student_id: string;
  exchange: string; // student + spark exchange (or full transcript)
  prev: LearningProfile;
};

export async function updateLearningProfile({ student_id, exchange, prev }: ProfileUpdateInput) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return;

  const system = `You maintain a tutoring memory about ONE student. Given the previous profile JSON and the latest exchange, return an UPDATED profile JSON only — no prose, no code fences.

Schema:
{
  "current_focus": string | null,
  "weak_topics": string[],         // max 8, dedup, lowercased nouns/phrases
  "strong_topics": string[],       // max 8
  "last_session_summary": string,  // <= 280 chars, plain English, what was just learned/worked on
  "unresolved_doubts": [{ "topic": string, "question": string, "last_seen_at": ISO-string }]  // max 5, drop older ones
}

Rules: only change a field if the new exchange justifies it. Keep prior info unless contradicted. Use today's ISO timestamp for new doubts. Output STRICT JSON.`;

  const user = `Previous profile:\n${JSON.stringify(prev)}\n\nLatest exchange:\n${exchange}\n\nReturn updated profile JSON:`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as any;
    const raw: string = json.choices?.[0]?.message?.content?.toString() ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    const next: LearningProfile = {
      current_focus: parsed.current_focus ?? prev.current_focus ?? null,
      weak_topics: Array.isArray(parsed.weak_topics) ? parsed.weak_topics.slice(0, 8) : prev.weak_topics,
      strong_topics: Array.isArray(parsed.strong_topics) ? parsed.strong_topics.slice(0, 8) : prev.strong_topics,
      last_session_summary: parsed.last_session_summary ?? prev.last_session_summary ?? null,
      unresolved_doubts: Array.isArray(parsed.unresolved_doubts)
        ? parsed.unresolved_doubts.slice(0, 5)
        : prev.unresolved_doubts,
    };

    await supabaseAdmin.from("student_learning_profile").upsert({
      student_id,
      current_focus: next.current_focus,
      weak_topics: next.weak_topics,
      strong_topics: next.strong_topics,
      last_session_summary: next.last_session_summary,
      unresolved_doubts: next.unresolved_doubts,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("updateLearningProfile failed (non-fatal):", (e as Error).message);
  }
}