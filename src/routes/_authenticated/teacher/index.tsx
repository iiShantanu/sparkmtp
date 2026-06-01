import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Users, BookOpen, GraduationCap, Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { getTeacherOverview } from "@/lib/teacher.functions";

const overviewQO = queryOptions({
  queryKey: ["teacher", "overview"],
  queryFn: () => getTeacherOverview(),
});

export const Route = createFileRoute("/_authenticated/teacher/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: TeacherOverview,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Could not load overview: {error.message}</p>
  ),
});

function TeacherOverview() {
  const { data } = useSuspenseQuery(overviewQO);
  const stats = [
    { label: "Classes", value: data.classes.length, icon: GraduationCap },
    { label: "Students", value: data.students.length, icon: Users },
    { label: "Homework", value: data.homework.length, icon: BookOpen },
    { label: "Active today", value: 0, icon: Activity },
  ];
  return (
    <>
      <PageHeader title="Overview" description="Snapshot of your classes and activity" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Recent homework</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.homework.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No homework yet.</li>
            )}
            {data.homework.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.subject} · {h.difficulty}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {h.due_at ? new Date(h.due_at).toLocaleDateString() : "No due date"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Your classes</h2>
          <ul className="mt-3 space-y-2">
            {data.classes.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No classes yet. Create one from the Students page.
              </li>
            )}
            {data.classes.map((c) => (
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
      </div>
    </>
  );
}