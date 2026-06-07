import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell";
import { listClasses, listStudents } from "@/lib/teacher.functions";

export const classesQO = queryOptions({ queryKey: ["teacher", "classes"], queryFn: () => listClasses() });
export const studentsQO = queryOptions({ queryKey: ["teacher", "students"], queryFn: () => listStudents() });

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
  const { data: classes } = useSuspenseQuery(classesQO);
  const { data: students } = useSuspenseQuery(studentsQO);

  return (
    <>
      <PageHeader
        title="My students"
        description="Students in the classes you teach. Ask an admin to add new classes or enroll students."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">My classes</h2>
          <ul className="mt-3 space-y-2">
            {classes.length === 0 && (
              <li className="text-sm text-muted-foreground">No classes assigned yet.</li>
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
          <ul className="mt-3 divide-y divide-border">
            {students.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No students in your classes yet.</li>
            )}
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(s.classes as unknown as { name: string } | null)?.name ?? ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.roll_number && (
                    <span className="text-xs text-muted-foreground">#{s.roll_number}</span>
                  )}
                  <Link
                    to="/teacher/students/$studentId/ai"
                    params={{ studentId: s.id }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <Brain className="h-3 w-3" /> AI
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}