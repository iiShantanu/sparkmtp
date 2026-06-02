import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { createNotice, deleteNotice, listMyNotices } from "@/lib/teacher-notices.functions";
import { listStudents, listMySubjects, listClasses } from "@/lib/teacher.functions";

const noticesQO = queryOptions({ queryKey: ["teacher", "notices"], queryFn: () => listMyNotices() });
const studentsQO = queryOptions({ queryKey: ["teacher", "students"], queryFn: () => listStudents() });
const subjectsQO = queryOptions({ queryKey: ["teacher", "subjects"], queryFn: () => listMySubjects() });
const classesQO = queryOptions({ queryKey: ["teacher", "classes"], queryFn: () => listClasses() });

export const Route = createFileRoute("/_authenticated/teacher/notices")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(noticesQO),
      context.queryClient.ensureQueryData(studentsQO),
      context.queryClient.ensureQueryData(subjectsQO),
      context.queryClient.ensureQueryData(classesQO),
    ]),
  component: NoticesPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function NoticesPage() {
  const qc = useQueryClient();
  const { data: notices } = useSuspenseQuery(noticesQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const create = useServerFn(createNotice);
  const del = useServerFn(deleteNotice);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"reminder" | "notice" | "homework_due">("notice");
  const [target, setTarget] = useState<"student" | "class" | "subject">("class");
  const [targetId, setTargetId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!targetId) return setErr("Pick a target");
    try {
      await create({
        data: {
          title,
          body: body || undefined,
          kind,
          subject_id: target === "subject" ? targetId : null,
          class_id: target === "class" ? targetId : null,
          student_id: target === "student" ? targetId : null,
        },
      });
      setTitle("");
      setBody("");
      setTargetId("");
      qc.invalidateQueries({ queryKey: ["teacher", "notices"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const options =
    target === "student"
      ? (students as any[]).map((s) => ({ id: s.id, label: s.full_name }))
      : target === "class"
        ? (classes as any[]).map((c) => ({
            id: c.id,
            label: `${c.name}${c.section ? ` · ${c.section}` : ""}`,
          }))
        : Array.from(
            new Map(
              (subjects as any[])
                .filter((r: any) => r.subjects)
                .map((r: any) => [r.subjects.id, { id: r.subjects.id, label: r.subjects.name }]),
            ).values(),
          );

  return (
    <>
      <PageHeader
        title="Reminders & notices"
        description="What you write here pops up on the student tablet."
      />
      <form onSubmit={submit} className="mb-6 grid gap-2 rounded-xl border border-border bg-card p-4">
        <input
          required
          placeholder="Title (e.g. Math homework due tomorrow)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Details (optional)"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="notice">Notice</option>
            <option value="reminder">Reminder</option>
            <option value="homework_due">Homework due</option>
          </select>
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as any);
              setTargetId("");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="class">A class</option>
            <option value="subject">A subject</option>
            <option value="student">A single student</option>
          </select>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Pick…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Send
        </button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(notices as any[]).length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No notices yet.</li>
        )}
        {(notices as any[]).map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 p-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{n.kind}</div>
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>}
            </div>
            <button
              onClick={async () => {
                await del({ data: { id: n.id } });
                qc.invalidateQueries({ queryKey: ["teacher", "notices"] });
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}