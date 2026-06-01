import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { meQueryOptions } from "@/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/parent")({
  component: ParentLayout,
});

function ParentLayout() {
  const { data: me } = useSuspenseQuery(meQueryOptions);
  return (
    <AppShell
      title="Parent"
      user={{
        name: me.profile?.full_name ?? "Parent",
        email: me.profile?.email ?? "",
        role: me.primaryRole,
      }}
      nav={[
        { to: "/parent", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}