import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  deleteStudentAiConfig,
  getStudentAiConfig,
  upsertStudentAiConfig,
} from "@/lib/teacher.functions";
import { teacherSetGoal } from "@/lib/student-extras.functions";

type Mode = "guided" | "direct" | "hint_only" | "step_by_step";

const DEFAULT_PROMPT = `You are Spark, a kind classroom AI tutor.
Tailor explanations to this specific student. Encourage, go step by step, and never give the final answer outright — guide them to discover it.`;

const qoFor = (studentId: string) =>
  queryOptions({
    queryKey: ["teacher", "ai-config", "student", studentId],
    queryFn: () => getStudentAiConfig({ data: { student_id: studentId } }),
  });

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId/ai")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qoFor(params.studentId)),
  component: StudentAiConfigPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Student not found.</p>,
});

function StudentAiConfigPage() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const qo = qoFor(studentId);
  const { data } = useSuspenseQuery(qo);
  const save = useServerFn(upsertStudentAiConfig);
  const reset = useServerFn(deleteStudentAiConfig);

  const source = data.config ?? data.fallback ?? null;
  const [prompt, setPrompt] = useState(source?.custom_prompt || DEFAULT_PROMPT);
  const [mode, setMode] = useState<Mode>((source?.mode as Mode) || "guided");
  const [complexity, setComplexity] = useState(source?.complexity || "grade_level");
  const [language, setLanguage] = useState(source?.language || "English");
  const [tone, setTone] = useState(source?.tone || "encouraging");
  const [style, setStyle] = useState(source?.teaching_style || "socratic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const src = data.config ?? data.fallback ?? null;
    setPrompt(src?.custom_prompt || DEFAULT_PROMPT);
    setMode((src?.mode as Mode) || "guided");
    setComplexity(src?.complexity || "grade_level");
    setLanguage(src?.language || "English");
    setTone(src?.tone || "encouraging");
    setStyle(src?.teaching_style || "socratic");
  }, [data]);

  const hasOverride = !!data.config;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      await save({
        data: {
          student_id: studentId,
          custom_prompt: prompt,
          mode,
          complexity,
          language,
          tone,
          teaching_style: style,
        },
      });
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["teacher", "ai-config", "student", studentId] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    if (!confirm("Remove this student's custom AI config and fall back to your default?")) return;
    setSaving(true);
    setErr(null);
    try {
      await reset({ data: { student_id: studentId } });
      qc.invalidateQueries({ queryKey: ["teacher", "ai-config", "student", studentId] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-2">
        <Link
          to="/teacher/students"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to students
        </Link>
      </div>
      <PageHeader
        title={`AI for ${data.student.full_name}`}
        description={
          hasOverride
            ? "This student has a custom AI configuration."
            : "Using your default configuration. Save to create a per-student override."
        }
      />
      <TodaysGoalCard studentId={studentId} />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-sm font-semibold">Custom prompt</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent as the AI's system instruction whenever this student starts a session.
          </p>
          <textarea
            rows={14}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-3 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
          />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <Field label="Teaching mode">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="guided">Guided</option>
              <option value="step_by_step">Step by step</option>
              <option value="hint_only">Hints only</option>
              <option value="direct">Direct answers</option>
            </select>
          </Field>
          <Field label="Teaching style">
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="socratic">Socratic</option>
              <option value="explanatory">Explanatory</option>
              <option value="practice">Practice-first</option>
              <option value="storytelling">Storytelling</option>
            </select>
          </Field>
          <Field label="Complexity">
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="simplified">Simplified</option>
              <option value="grade_level">Grade level</option>
              <option value="challenging">Challenging</option>
            </select>
          </Field>
          <Field label="Tone">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="encouraging">Encouraging</option>
              <option value="neutral">Neutral</option>
              <option value="playful">Playful</option>
              <option value="formal">Formal</option>
            </select>
          </Field>
          <Field label="Language">
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          {err && <p className="text-sm text-destructive">{err}</p>}
          {saved && <p className="text-sm text-success">Saved.</p>}
          <button
            disabled={saving}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : hasOverride ? "Update override" : "Create override"}
          </button>
          {hasOverride && (
            <button
              type="button"
              onClick={clearOverride}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove override
            </button>
          )}
        </div>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}