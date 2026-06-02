import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { meQueryOptions } from "@/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  const { data: me } = useSuspenseQuery(meQueryOptions);
  const nav = [
    { to: "/teacher", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/teacher/students", label: "Students", icon: <Users className="h-4 w-4" /> },
    { to: "/teacher/homework", label: "Homework", icon: <BookOpen className="h-4 w-4" /> },
  ];
  if (me.roles.includes("admin")) {
    nav.push({ to: "/admin", label: "Admin panel", icon: <Shield className="h-4 w-4" /> });
  }
  return (
    <AppShell
      title="Teacher"
      user={{
        name: me.profile?.full_name ?? "Teacher",
        email: me.profile?.email ?? "",
        role: me.primaryRole,
      }}
      nav={nav}
    >
      <Outlet />
    </AppShell>
  );
}