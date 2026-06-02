import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  adminListUsers,
  adminListStudents,
  adminListParentLinks,
  adminLinkParent,
  adminUnlinkParent,
} from "@/lib/admin.functions";

const usersQO = queryOptions({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
const studentsQO = queryOptions({ queryKey: ["admin", "students"], queryFn: () => adminListStudents() });
const linksQO = queryOptions({ queryKey: ["admin", "parentLinks"], queryFn: () => adminListParentLinks() });

export const Route = createFileRoute("/_authenticated/admin/parents")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(usersQO),
      context.queryClient.ensureQueryData(studentsQO),
      context.queryClient.ensureQueryData(linksQO),
    ]),
  component: ParentsPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function ParentsPage() {
  const qc = useQueryClient();
  const { data: users } = useSuspenseQuery(usersQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const { data: links } = useSuspenseQuery(linksQO);
  const link = useServerFn(adminLinkParent);
  const unlink = useServerFn(adminUnlinkParent);
  const parents = users.filter((u: any) => u.roles.includes("parent"));

  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await link({
        data: { parent_user_id: parentId, student_id: studentId, relationship: relationship || undefined },
      });
      setStudentId("");
      setRelationship("");
      qc.invalidateQueries({ queryKey: ["admin", "parentLinks"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Parents" description="Link parent accounts to their children." />
      <form onSubmit={submit} className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_140px_auto]">
        <select
          required
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Parent…</option>
          {parents.map((p: any) => (
            <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
          ))}
        </select>
        <select
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Student…</option>
          {students.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.full_name} {s.classes?.name ? `— ${s.classes.name}` : ""}
            </option>
          ))}
        </select>
        <input
          placeholder="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Link
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {links.length === 0 && <li className="p-4 text-sm text-muted-foreground">No parent links yet.</li>}
        {(links as any[]).map((l) => {
          const parent = parents.find((p: any) => p.id === l.parent_user_id);
          return (
            <li key={l.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">
                  {parent?.full_name ?? l.parent_user_id} → {l.students?.full_name}
                </div>
                {l.relationship && <div className="text-xs text-muted-foreground">{l.relationship}</div>}
              </div>
              <button
                onClick={async () => {
                  await unlink({ data: { id: l.id } });
                  qc.invalidateQueries({ queryKey: ["admin", "parentLinks"] });
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                aria-label="Unlink"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}