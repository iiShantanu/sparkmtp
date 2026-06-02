import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, GraduationCap, UserCog, Mail, Library, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { meQueryOptions } from "@/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me.roles.includes("admin")) {
      throw redirect({ to: me.primaryRole === "teacher" ? "/teacher" : "/parent" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { data: me } = useSuspenseQuery(meQueryOptions);
  return (
    <AppShell
      title="Admin"
      user={{
        name: me.profile?.full_name ?? "Admin",
        email: me.profile?.email ?? "",
        role: me.primaryRole,
      }}
      nav={[
        { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: "/admin/approvals", label: "Approvals", icon: <UserCheck className="h-4 w-4" /> },
        { to: "/admin/users", label: "Users", icon: <UserCog className="h-4 w-4" /> },
        { to: "/admin/invitations", label: "Invitations", icon: <Mail className="h-4 w-4" /> },
        { to: "/admin/subjects", label: "Subjects", icon: <Library className="h-4 w-4" /> },
        { to: "/admin/classes", label: "Classes", icon: <BookOpen className="h-4 w-4" /> },
        { to: "/admin/students", label: "Students", icon: <GraduationCap className="h-4 w-4" /> },
        { to: "/admin/parents", label: "Parents", icon: <Users className="h-4 w-4" /> },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}