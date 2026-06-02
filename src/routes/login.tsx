import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Spark" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? (s.status as string) : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMe);
  const { status } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    status === "pending"
      ? "Your account is awaiting admin approval. You'll be able to sign in once approved."
      : status === "rejected"
      ? "Your account request was rejected. Please contact your administrator."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) return setError(error.message);
    const me = await fetchMe();
    if (!me.roles.includes("admin") && me.approvalStatus !== "approved") {
      await supabase.auth.signOut();
      setError(
        me.approvalStatus === "rejected"
          ? "Your account request was rejected. Please contact your administrator."
          : "Your account is awaiting admin approval. You'll be able to sign in once approved.",
      );
      return;
    }
    const target =
      me.primaryRole === "admin"
        ? "/admin"
        : me.primaryRole === "parent"
        ? "/parent"
        : "/teacher";
    navigate({ to: target });
  }

  async function resendVerification() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email address first, then resend the verification email.");
      return;
    }
    setError(null);
    setNotice(null);
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setResending(false);
    if (error) return setError(error.message);
    setNotice("Verification email sent. Open the newest email link, then sign in again.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Spark
        </div>
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={resendVerification}
          disabled={resending}
          className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {resending ? "Sending verification…" : "Resend verification email"}
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to Spark?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  );
}