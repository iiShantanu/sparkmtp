import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { adminListClasses, adminCreateClass, adminDeleteClass } from "@/lib/admin.functions";

const classesQO = queryOptions({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });

export const Route = createFileRoute("/_authenticated/admin/classes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQO),
  component: ClassesPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function ClassesPage() {
  const qc = useQueryClient();
  const { data: classes } = useSuspenseQuery(classesQO);
  const create = useServerFn(adminCreateClass);
  const del = useServerFn(adminDeleteClass);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create({ data: { name, section: section || undefined } });
      setName("");
      setSection("");
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Classes" description="Create classes and sections." />
      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
        <input
          required
          placeholder="Class name (e.g. Grade 5)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add class
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {classes.length === 0 && <li className="p-4 text-sm text-muted-foreground">No classes yet.</li>}
        {classes.map((c: any) => (
          <li key={c.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{c.name}</div>
              {c.section && <div className="text-xs text-muted-foreground">Section {c.section}</div>}
            </div>
            <button
              onClick={async () => {
                await del({ data: { id: c.id } });
                qc.invalidateQueries({ queryKey: ["admin", "classes"] });
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