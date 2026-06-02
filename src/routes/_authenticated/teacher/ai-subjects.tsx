import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { listMySubjects, getSubjectAiConfig, upsertSubjectAiConfig, deleteSubjectAiConfig } from "@/lib/teacher.functions";

const subjectsQO = queryOptions({
  queryKey: ["teacher", "subjects"],
  queryFn: () => listMySubjects(),
});

export const Route = createFileRoute("/_authenticated/teacher/ai-subjects")({
  loader: ({ context }) => context.queryClient.ensureQueryData(subjectsQO),
  component: SubjectAiPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

const DEFAULT_PROMPT = `Teach this subject the way you teach in class. Stay on topic, build on what we covered, and guide the student step by step.`;

type Mode = "guided" | "direct" | "hint_only" | "step_by_step";

function SubjectAiPage() {
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const uniq = Array.from(
    new Map(
      (subjects as any[])
        .filter((r) => r.subjects)
        .map((r) => [r.subjects.id, r.subjects as { id: string; name: string; code: string | null }]),
    ).values(),
  );
  const [activeId, setActiveId] = useState<string>(uniq[0]?.id ?? "");

  return (
    <>
      <PageHeader
        title="AI per subject"
        description="Set how Spark behaves for each subject you teach. This overrides your global default for that subject."
      />
      {uniq.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          You're not assigned to any subject yet. Ask the admin to assign you.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <ul className="flex flex-row gap-1 md:flex-col">
            {uniq.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    activeId === s.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
          {activeId && <SubjectForm subjectId={activeId} key={activeId} />}
        </div>
      )}
    </>
  );
}

function SubjectForm({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const qo = queryOptions({
    queryKey: ["teacher", "ai-config", "subject", subjectId],
    queryFn: () => getSubjectAiConfig({ data: { subject_id: subjectId } }),
  });
  const { data } = useSuspenseQuery(qo);
  const save = useServerFn(upsertSubjectAiConfig);
  const reset = useServerFn(deleteSubjectAiConfig);

  const src = (data.config as any) ?? (data.fallback as any) ?? null;
  const [prompt, setPrompt] = useState(src?.custom_prompt || DEFAULT_PROMPT);
  const [mode, setMode] = useState<Mode>((src?.mode as Mode) || "guided");
  const [complexity, setComplexity] = useState(src?.complexity || "grade_level");
  const [language, setLanguage] = useState(src?.language || "English");
  const [tone, setTone] = useState(src?.tone || "encouraging");
  const [style, setStyle] = useState(src?.teaching_style || "socratic");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = (data.config as any) ?? (data.fallback as any) ?? null;
    setPrompt(s?.custom_prompt || DEFAULT_PROMPT);
    setMode((s?.mode as Mode) || "guided");
    setComplexity(s?.complexity || "grade_level");
    setLanguage(s?.language || "English");
    setTone(s?.tone || "encouraging");
    setStyle(s?.teaching_style || "socratic");
  }, [data]);

  const has = !!data.config;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      await save({
        data: {
          subject_id: subjectId,
          custom_prompt: prompt,
          mode,
          complexity,
          language,
          tone,
          teaching_style: style,
        },
      });
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["teacher", "ai-config", "subject", subjectId] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    if (!confirm("Remove this subject override and fall back to your global config?")) return;
    setBusy(true);
    try {
      await reset({ data: { subject_id: subjectId } });
      qc.invalidateQueries({ queryKey: ["teacher", "ai-config", "subject", subjectId] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground">
        {has ? "Custom subject configuration active." : "Using your global default. Save to create a subject override."}
      </p>
      <div>
        <label className="text-sm font-semibold">Custom prompt</label>
        <textarea
          rows={10}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Mode" value={mode} onChange={(v) => setMode(v as Mode)} options={["guided", "step_by_step", "hint_only", "direct"]} />
        <Select label="Style" value={style} onChange={setStyle} options={["socratic", "explanatory", "practice", "storytelling"]} />
        <Select label="Complexity" value={complexity} onChange={setComplexity} options={["simplified", "grade_level", "challenging"]} />
        <Select label="Tone" value={tone} onChange={setTone} options={["encouraging", "neutral", "playful", "formal"]} />
        <div>
          <label className="text-xs font-medium text-muted-foreground">Language</label>
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}
      <div className="flex gap-2">
        <button
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : has ? "Update" : "Create override"}
        </button>
        {has && (
          <button
            type="button"
            disabled={busy}
            onClick={clearOverride}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent hover:text-destructive disabled:opacity-50"
          >
            Remove override
          </button>
        )}
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}