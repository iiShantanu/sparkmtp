import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  adminListStudents,
  adminCreateStudent,
  adminDeleteStudent,
  adminListClasses,
} from "@/lib/admin.functions";

export const studentsQO = queryOptions({ queryKey: ["admin", "students"], queryFn: () => adminListStudents() });
export const classesQO = queryOptions({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });

export const Route = createFileRoute("/_authenticated/admin/students")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(studentsQO),
      context.queryClient.ensureQueryData(classesQO),
    ]),
  component: StudentsPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function StudentsPage() {
  const qc = useQueryClient();
  const { data: students } = useSuspenseQuery(studentsQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const create = useServerFn(adminCreateStudent);
  const del = useServerFn(adminDeleteStudent);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [roll, setRoll] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!classId) return setErr("Pick a class");
    try {
      await create({ data: { full_name: name, class_id: classId, roll_number: roll || undefined } });
      setName("");
      setRoll("");
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Students" description="Enroll students into classes." />
      <form onSubmit={submit} className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_120px_auto]">
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          required
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select class…</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.section ? `· ${c.section}` : ""}
            </option>
          ))}
        </select>
        <input
          placeholder="Roll #"
          value={roll}
          onChange={(e) => setRoll(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add student
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {students.length === 0 && <li className="p-4 text-sm text-muted-foreground">No students yet.</li>}
        {students.map((s: any) => (
          <li key={s.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{s.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {s.classes?.name}
                {s.classes?.section ? ` · ${s.classes.section}` : ""}
                {s.roll_number ? ` · #${s.roll_number}` : ""}
              </div>
            </div>
            <button
              onClick={async () => {
                await del({ data: { id: s.id } });
                qc.invalidateQueries({ queryKey: ["admin", "students"] });
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