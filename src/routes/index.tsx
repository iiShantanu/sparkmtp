import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Sparkles, GraduationCap, Users, Cpu } from "lucide-react";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      const me = await getMe();
      const target =
        me.primaryRole === "admin"
          ? "/admin"
          : me.primaryRole === "parent"
          ? "/parent"
          : "/teacher";
      throw redirect({ to: target });
    } catch (e) {
      if ((e as any)?.isRedirect) throw e;
    }
  },
  head: () => ({
    meta: [
      { title: "Spark — Teacher-Guided AI Learning" },
      { name: "description", content: "Spark is a teacher-guided AI learning ecosystem for schools, students, and parents." },
      { property: "og:title", content: "Spark — Teacher-Guided AI Learning" },
      { property: "og:description", content: "Spark is a teacher-guided AI learning ecosystem for schools, students, and parents." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            Spark
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
              Sign in
            </Link>
            <Link to="/signup" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Teacher-guided AI for K-12
          </p>
          <h1 className="text-5xl font-semibold tracking-tight">
            A learning ecosystem your school actually controls.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Spark connects teachers, students, and parents through a single platform — with a
            classroom-ready AI tutor that follows the teacher's instructions, not the other way
            around.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Register as teacher or parent
            </Link>
            <Link to="/login" className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted">
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            New teacher and parent accounts require admin approval before sign-in is enabled.
          </p>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: GraduationCap, title: "Teachers in control", body: "Set the AI's tone, language, and depth. Assign homework. See exactly what each student asked." },
            { icon: Users, title: "Parents in the loop", body: "Weekly progress, strong and weak subjects, and direct teacher notes — without the noise." },
            { icon: Cpu, title: "Built for the classroom device", body: "Pair a Raspberry Pi learning device in seconds and stream activity back to the dashboard live." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
