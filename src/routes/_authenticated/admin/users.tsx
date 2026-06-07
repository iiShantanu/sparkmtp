import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  adminListUsers,
  adminListTeacherAssignments,
  adminAssignTeacherSubject,
  adminUnassignTeacherSubject,
  listSubjects,
  adminListClasses,
} from "@/lib/admin.functions";

export const usersQO = queryOptions({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
export const subjectsQO = queryOptions({ queryKey: ["admin", "subjects"], queryFn: () => listSubjects() });
export const classesQO = queryOptions({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });
export const assignmentsQO = queryOptions({
  queryKey: ["admin", "teacherAssignments"],
  queryFn: () => adminListTeacherAssignments(),
});

export const Route = createFileRoute("/_authenticated/admin/users")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(usersQO),
      context.queryClient.ensureQueryData(subjectsQO),
      context.queryClient.ensureQueryData(classesQO),
      context.queryClient.ensureQueryData(assignmentsQO),
    ]),
  component: UsersPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function UsersPage() {
  const qc = useQueryClient();
  const { data: users } = useSuspenseQuery(usersQO);
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const { data: assignments } = useSuspenseQuery(assignmentsQO);
  const assign = useServerFn(adminAssignTeacherSubject);
  const unassign = useServerFn(adminUnassignTeacherSubject);

  const [openTeacher, setOpenTeacher] = useState<string | null>(null);
  const [pickSubject, setPickSubject] = useState("");
  const [pickClass, setPickClass] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const teachers = users.filter((u: any) => u.roles.includes("teacher"));
  const admins = users.filter((u: any) => u.roles.includes("admin"));
  const parents = users.filter((u: any) => u.roles.includes("parent"));

  function assignmentsFor(teacherId: string) {
    return (assignments as any[]).filter((a) => a.teacher_id === teacherId);
  }

  async function addAssignment(teacherId: string) {
    if (!pickSubject) return;
    setErr(null);
    try {
      await assign({
        data: {
          teacher_id: teacherId,
          subject_id: pickSubject,
          class_id: pickClass || undefined,
        },
      });
      setPickSubject("");
      setPickClass("");
      qc.invalidateQueries({ queryKey: ["admin", "teacherAssignments"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Users" description="All teachers, parents, and admins." />
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}

      <h2 className="mb-2 mt-4 text-sm font-semibold">Teachers ({teachers.length})</h2>
      <ul className="space-y-2">
        {teachers.length === 0 && (
          <li className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No teachers yet. Invite one from the Invitations page.
          </li>
        )}
        {teachers.map((t: any) => {
          const my = assignmentsFor(t.id);
          const open = openTeacher === t.id;
          return (
            <li key={t.id} className="rounded-xl border border-border bg-card">
              <button
                onClick={() => setOpenTeacher(open ? null : t.id)}
                className="flex w-full items-center justify-between p-3 text-left text-sm"
              >
                <div>
                  <div className="font-medium">{t.full_name}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </div>
                <span className="text-xs text-muted-foreground">{my.length} subject{my.length === 1 ? "" : "s"}</span>
              </button>
              {open && (
                <div className="border-t border-border p-3">
                  <ul className="mb-3 space-y-1">
                    {my.map((a: any) => (
                      <li key={a.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-sm">
                        <span>
                          {a.subjects?.name}
                          {a.classes
                            ? ` — ${a.classes.name}${a.classes.section ? " · " + a.classes.section : ""}`
                            : " — all classes"}
                        </span>
                        <button
                          onClick={async () => {
                            await unassign({ data: { id: a.id } });
                            qc.invalidateQueries({ queryKey: ["admin", "teacherAssignments"] });
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Unassign"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    {my.length === 0 && (
                      <li className="text-xs text-muted-foreground">No subjects assigned yet.</li>
                    )}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={pickSubject}
                      onChange={(e) => setPickSubject(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Subject…</option>
                      {subjects.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      value={pickClass}
                      onChange={(e) => setPickClass(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">All classes</option>
                      {classes.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `· ${c.section}` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => addAssignment(t.id)}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Parents ({parents.length})</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {parents.length === 0 && <li className="p-4 text-sm text-muted-foreground">No parents yet.</li>}
        {parents.map((p: any) => (
          <li key={p.id} className="p-3 text-sm">
            <div className="font-medium">{p.full_name}</div>
            <div className="text-xs text-muted-foreground">{p.email}</div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Admins ({admins.length})</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {admins.map((a: any) => (
          <li key={a.id} className="p-3 text-sm">
            <div className="font-medium">{a.full_name}</div>
            <div className="text-xs text-muted-foreground">{a.email}</div>
          </li>
        ))}
      </ul>
    </>
  );
}