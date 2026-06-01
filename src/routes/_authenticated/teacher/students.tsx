import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import {
  createClass,
  createStudent,
  listClasses,
  listStudents,
} from "@/lib/teacher.functions";

const classesQO = queryOptions({ queryKey: ["teacher", "classes"], queryFn: () => listClasses() });
const studentsQO = queryOptions({ queryKey: ["teacher", "students"], queryFn: () => listStudents() });

export const Route = createFileRoute("/_authenticated/teacher/students")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(classesQO),
      context.queryClient.ensureQueryData(studentsQO),
    ]),
  component: StudentsPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function StudentsPage() {
  const qc = useQueryClient();
  const { data: classes } = useSuspenseQuery(classesQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const createCls = useServerFn(createClass);
  const createStu = useServerFn(createStudent);

  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [studentName, setStudentName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [roll, setRoll] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await createCls({ data: { name: className, section: section || undefined } });
      setClassName("");
      setSection("");
      qc.invalidateQueries({ queryKey: ["teacher"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!classId) return setErr("Select a class");
    try {
      await createStu({
        data: { full_name: studentName, class_id: classId, roll_number: roll || undefined },
      });
      setStudentName("");
      setRoll("");
      qc.invalidateQueries({ queryKey: ["teacher"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Students & classes" description="Manage classrooms and student roster" />
      {err && <p className="mb-4 text-sm text-destructive">{err}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Classes</h2>
          <form onSubmit={addClass} className="mt-3 flex flex-wrap gap-2">
            <input
              required
              placeholder="Class name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Add
            </button>
          </form>
          <ul className="mt-4 space-y-2">
            {classes.length === 0 && (
              <li className="text-sm text-muted-foreground">No classes yet.</li>
            )}
            {classes.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.section ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Students</h2>
          <form onSubmit={addStudent} className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                required
                placeholder="Full name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="Roll #"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `· ${c.section}` : ""}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Add
              </button>
            </div>
          </form>
          <ul className="mt-4 divide-y divide-border">
            {students.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No students yet.</li>
            )}
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(s.classes as unknown as { name: string }).name}
                  </div>
                </div>
                {s.roll_number && (
                  <span className="text-xs text-muted-foreground">#{s.roll_number}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}