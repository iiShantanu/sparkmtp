import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell";
import {
  adminListUsers,
  adminListClasses,
  adminListStudents,
  listSubjects,
  adminListInvitations,
} from "@/lib/admin.functions";

export const usersQO = queryOptions({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
export const classesQO = queryOptions({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });
export const studentsQO = queryOptions({ queryKey: ["admin", "students"], queryFn: () => adminListStudents() });
export const subjectsQO = queryOptions({ queryKey: ["admin", "subjects"], queryFn: () => listSubjects() });
export const invitesQO = queryOptions({ queryKey: ["admin", "invitations"], queryFn: () => adminListInvitations() });

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(usersQO),
      context.queryClient.ensureQueryData(classesQO),
      context.queryClient.ensureQueryData(studentsQO),
      context.queryClient.ensureQueryData(subjectsQO),
      context.queryClient.ensureQueryData(invitesQO),
    ]),
  component: AdminOverview,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function AdminOverview() {
  const { data: users } = useSuspenseQuery(usersQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const { data: invites } = useSuspenseQuery(invitesQO);

  const teachers = users.filter((u: any) => u.roles.includes("teacher")).length;
  const parents = users.filter((u: any) => u.roles.includes("parent")).length;
  const pendingInvites = invites.filter((i: any) => !i.accepted_at).length;

  const stats = [
    { label: "Teachers", value: teachers },
    { label: "Parents", value: parents },
    { label: "Subjects", value: subjects.length },
    { label: "Classes", value: classes.length },
    { label: "Students", value: students.length },
    { label: "Pending invites", value: pendingInvites },
  ];

  return (
    <>
      <PageHeader title="Admin overview" description="Manage the whole platform." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-2 text-3xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}