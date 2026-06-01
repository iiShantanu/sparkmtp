import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  createHomework,
  deleteHomework,
  listClasses,
  listHomework,
} from "@/lib/teacher.functions";

const homeworkQO = queryOptions({ queryKey: ["teacher", "homework"], queryFn: () => listHomework() });
const classesQO = queryOptions({ queryKey: ["teacher", "classes"], queryFn: () => listClasses() });

export const Route = createFileRoute("/_authenticated/teacher/homework")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(homeworkQO),
      context.queryClient.ensureQueryData(classesQO),
    ]),
  component: HomeworkPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function HomeworkPage() {
  const qc = useQueryClient();
  const { data: homework } = useSuspenseQuery(homeworkQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const create = useServerFn(createHomework);
  const del = useServerFn(deleteHomework);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [classId, setClassId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [voice, setVoice] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create({
        data: {
          title,
          subject,
          difficulty,
          class_id: classId || undefined,
          instructions: instructions || undefined,
          due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
          voice_enabled: voice,
        },
      });
      setTitle("");
      setSubject("");
      setInstructions("");
      setDueAt("");
      qc.invalidateQueries({ queryKey: ["teacher", "homework"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(id: string) {
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["teacher", "homework"] });
  }

  return (
    <>
      <PageHeader title="Homework" description="Create and manage assignments" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">New homework</h2>
          <input
            required
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              required
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">No class (all students)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section ? `· ${c.section}` : ""}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Instructions"
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
            Voice-enabled
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Publish homework
          </button>
        </form>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">All homework</h2>
          <ul className="mt-3 divide-y divide-border">
            {homework.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No homework yet.</li>
            )}
            {homework.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.subject} · {h.difficulty}
                    {h.due_at ? ` · due ${new Date(h.due_at).toLocaleDateString()}` : ""}
                  </div>
                  {h.instructions && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{h.instructions}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(h.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}