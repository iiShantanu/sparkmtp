import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe(),
});

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me.roles.includes("admin") && me.approvalStatus !== "approved") {
      await supabase.auth.signOut();
      context.queryClient.removeQueries({ queryKey: ["me"] });
      throw redirect({ to: "/login", search: { status: me.approvalStatus } as any });
    }
    return me;
  },
  component: AuthedLayout,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">We couldn't load your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function AuthedLayout() {
  const navigate = useNavigate();
  useSuspenseQuery(meQueryOptions);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !session) {
        navigate({ to: "/login" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return <Outlet />;
}