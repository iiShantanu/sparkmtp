import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell";
import { adminListPending, adminSetApproval } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPending);
  const setFn = useServerFn(adminSetApproval);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "pending"], queryFn: () => listFn() });
  const mut = useMutation({
    mutationFn: (v: { user_id: string; status: "approved" | "rejected" }) =>
      setFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pending"] }),
  });

  return (
    <div>
      <PageHeader
        title="Pending approvals"
        description="Approve or reject teachers and parents who registered from the landing page."
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No pending requests.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Requested</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u: any) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">{(u.roles ?? []).join(", ") || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ user_id: u.id, status: "approved" })}
                      className="mr-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ user_id: u.id, status: "rejected" })}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}