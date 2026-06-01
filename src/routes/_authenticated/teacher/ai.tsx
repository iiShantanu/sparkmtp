import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { getMyAiConfig, upsertMyAiConfig } from "@/lib/teacher.functions";

const aiQO = queryOptions({ queryKey: ["teacher", "ai-config"], queryFn: () => getMyAiConfig() });

export const Route = createFileRoute("/_authenticated/teacher/ai")({
  loader: ({ context }) => context.queryClient.ensureQueryData(aiQO),
  component: AiConfigPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

const DEFAULT_PROMPT = `You are Spark, a kind classroom AI tutor.
Always encourage the student, explain step by step, and never give the final answer outright — guide them to discover it.`;

type Mode = "guided" | "direct" | "hint_only" | "step_by_step";

function AiConfigPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(aiQO);
  const save = useServerFn(upsertMyAiConfig);

  const [prompt, setPrompt] = useState(data?.custom_prompt || DEFAULT_PROMPT);
  const [mode, setMode] = useState<Mode>((data?.mode as Mode) || "guided");
  const [complexity, setComplexity] = useState(data?.complexity || "grade_level");
  const [language, setLanguage] = useState(data?.language || "English");
  const [tone, setTone] = useState(data?.tone || "encouraging");
  const [style, setStyle] = useState(data?.teaching_style || "socratic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setPrompt(data.custom_prompt || DEFAULT_PROMPT);
      setMode((data.mode as Mode) || "guided");
      setComplexity(data.complexity || "grade_level");
      setLanguage(data.language || "English");
      setTone(data.tone || "encouraging");
      setStyle(data.teaching_style || "socratic");
    }
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      await save({
        data: { custom_prompt: prompt, mode, complexity, language, tone, teaching_style: style },
      });
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["teacher", "ai-config"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI configuration"
        description="Define how Spark's tutor behaves for your students"
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-sm font-semibold">Custom prompt</label>
          <p className="mt-1 text-xs text-muted-foreground">
            This is sent as the AI's system instruction on every student session.
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
            {saving ? "Saving…" : "Save configuration"}
          </button>
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