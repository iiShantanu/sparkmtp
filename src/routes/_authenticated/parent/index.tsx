import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { getParentOverview } from "@/lib/parent.functions";

const overviewQO = queryOptions({
  queryKey: ["parent", "overview"],
  queryFn: () => getParentOverview(),
});

export const Route = createFileRoute("/_authenticated/parent/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: ParentOverview,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function ParentOverview() {
  const { data } = useSuspenseQuery(overviewQO);
  return (
    <>
      <PageHeader title="Your children" description="Recent learning activity from Spark" />
      {data.children.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No children linked yet. Ask your school admin to connect your account to your child's profile.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.children.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="text-base font-semibold">{c.full_name}</div>
              <div className="text-xs text-muted-foreground">{c.relationship ?? "Child"}</div>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border">
          {data.recentLogs.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No activity yet.</li>
          )}
          {data.recentLogs.map((l) => (
            <li key={l.id} className="flex items-start gap-3 py-3 text-sm">
              {l.needs_intervention && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 font-medium">{l.question}</div>
                <div className="text-xs text-muted-foreground">
                  {l.subject ?? "General"} · {new Date(l.created_at).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}