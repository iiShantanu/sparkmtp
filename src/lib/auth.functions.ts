import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r) => r.role as string);
    const primary =
      roleList.find((r) => r === "admin") ??
      roleList.find((r) => r === "teacher") ??
      roleList.find((r) => r === "parent") ??
      roleList.find((r) => r === "student") ??
      "parent";
    return {
      userId,
      profile: profile ?? null,
      roles: roleList,
      primaryRole: primary,
      approvalStatus: (profile as any)?.approval_status ?? "approved",
    };
  });