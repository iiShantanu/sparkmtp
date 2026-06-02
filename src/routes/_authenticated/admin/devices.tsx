import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell";
import { DevicesManager, devicesQO } from "@/components/devices-manager";
import { adminListStudents } from "@/lib/admin.functions";

const studentsQO = queryOptions({
  queryKey: ["admin", "students"],
  queryFn: () => adminListStudents(),
});

export const Route = createFileRoute("/_authenticated/admin/devices")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(devicesQO),
      context.queryClient.ensureQueryData(studentsQO),
    ]),
  component: AdminDevicesPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function AdminDevicesPage() {
  return (
    <>
      <PageHeader
        title="Devices"
        description="Pair a Raspberry Pi (or any browser) with a student. Each device gets a one-time code."
      />
      <DevicesManager studentsQO={studentsQO} />
    </>
  );
}