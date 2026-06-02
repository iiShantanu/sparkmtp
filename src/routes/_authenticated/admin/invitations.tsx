import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  adminListInvitations,
  adminCreateInvitation,
  adminRevokeInvitation,
  listSubjects,
  adminListClasses,
  adminListStudents,
} from "@/lib/admin.functions";

const invitesQO = queryOptions({ queryKey: ["admin", "invitations"], queryFn: () => adminListInvitations() });
const subjectsQO = queryOptions({ queryKey: ["admin", "subjects"], queryFn: () => listSubjects() });
const classesQO = queryOptions({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });
const studentsQO = queryOptions({ queryKey: ["admin", "students"], queryFn: () => adminListStudents() });

export const Route = createFileRoute("/_authenticated/admin/invitations")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(invitesQO),
      context.queryClient.ensureQueryData(subjectsQO),
      context.queryClient.ensureQueryData(classesQO),
      context.queryClient.ensureQueryData(studentsQO),
    ]),
  component: InvitationsPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function InvitationsPage() {
  const qc = useQueryClient();
  const { data: invites } = useSuspenseQuery(invitesQO);
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const { data: classes } = useSuspenseQuery(classesQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const create = useServerFn(adminCreateInvitation);
  const revoke = useServerFn(adminRevokeInvitation);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "parent">("teacher");
  const [teacherAssignments, setTeacherAssignments] = useState<{ subject_id: string; class_id?: string }[]>([]);
  const [pickSubject, setPickSubject] = useState("");
  const [pickClass, setPickClass] = useState("");
  const [parentStudents, setParentStudents] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function origin() {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create({
        data: {
          email,
          role,
          subjects: role === "teacher" ? teacherAssignments : undefined,
          students: role === "parent" ? parentStudents : undefined,
        },
      });
      setEmail("");
      setTeacherAssignments([]);
      setParentStudents([]);
      qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Invitations" description="Send signup links with the right role pre-set." />
      <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === "teacher" && (
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Subject assignments (optional)
            </div>
            <ul className="mb-2 space-y-1">
              {teacherAssignments.map((a, i) => {
                const sub = subjects.find((s: any) => s.id === a.subject_id);
                const cls = a.class_id ? classes.find((c: any) => c.id === a.class_id) : null;
                return (
                  <li key={i} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-sm">
                    <span>
                      {sub?.name} — {cls ? `${cls.name}${cls.section ? " · " + cls.section : ""}` : "all classes"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTeacherAssignments((arr) => arr.filter((_, j) => j !== i))}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <select
                value={pickSubject}
                onChange={(e) => setPickSubject(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Subject…</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={pickClass}
                onChange={(e) => setPickClass(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `· ${c.section}` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!pickSubject) return;
                  setTeacherAssignments((arr) => [...arr, { subject_id: pickSubject, class_id: pickClass || undefined }]);
                  setPickSubject("");
                  setPickClass("");
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {role === "parent" && (
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Linked students (optional)
            </div>
            <select
              multiple
              value={parentStudents}
              onChange={(e) =>
                setParentStudents(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="h-32 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {students.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} {s.classes?.name ? `— ${s.classes.name}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Hold ⌘/Ctrl to select multiple.</p>
          </div>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Generate invite link
        </button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {invites.length === 0 && <li className="p-4 text-sm text-muted-foreground">No invites yet.</li>}
        {invites.map((i: any) => {
          const url = `${origin()}/signup?invite=${i.token}`;
          const accepted = !!i.accepted_at;
          return (
            <li key={i.id} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {i.email}{" "}
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      {i.role}
                    </span>
                    {accepted && (
                      <span className="ml-2 text-xs text-success">accepted</span>
                    )}
                  </div>
                  {!accepted && (
                    <div className="mt-1 flex items-center gap-2">
                      <code className="block min-w-0 flex-1 truncate rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                        {url}
                      </code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(url)}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                        aria-label="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await revoke({ data: { id: i.id } });
                    qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Revoke"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}