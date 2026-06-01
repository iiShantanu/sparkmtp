import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    const target =
      me.primaryRole === "admin"
        ? "/teacher"
        : me.primaryRole === "teacher"
          ? "/teacher"
          : me.primaryRole === "parent"
            ? "/parent"
            : "/teacher";
    throw redirect({ to: target });
  },
});