import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { listSubjects, createSubject, deleteSubject } from "@/lib/admin.functions";

const subjectsQO = queryOptions({ queryKey: ["admin", "subjects"], queryFn: () => listSubjects() });

export const Route = createFileRoute("/_authenticated/admin/subjects")({
  loader: ({ context }) => context.queryClient.ensureQueryData(subjectsQO),
  component: SubjectsPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function SubjectsPage() {
  const qc = useQueryClient();
  const { data: subjects } = useSuspenseQuery(subjectsQO);
  const create = useServerFn(createSubject);
  const del = useServerFn(deleteSubject);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create({ data: { name, code: code || undefined } });
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["admin", "subjects"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Subjects" description="Global subject catalog." />
      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
        <input
          required
          placeholder="Subject name (e.g. Mathematics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add subject
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {subjects.length === 0 && <li className="p-4 text-sm text-muted-foreground">No subjects yet.</li>}
        {subjects.map((s: any) => (
          <li key={s.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{s.name}</div>
              {s.code && <div className="text-xs text-muted-foreground">{s.code}</div>}
            </div>
            <button
              onClick={async () => {
                await del({ data: { id: s.id } });
                qc.invalidateQueries({ queryKey: ["admin", "subjects"] });
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