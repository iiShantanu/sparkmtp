import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell";
import { DevicesManager, devicesQO } from "@/components/devices-manager";
import { listStudents } from "@/lib/teacher.functions";

const studentsQO = queryOptions({
  queryKey: ["teacher", "students"],
  queryFn: () => listStudents(),
});

export const Route = createFileRoute("/_authenticated/teacher/devices")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(devicesQO),
      context.queryClient.ensureQueryData(studentsQO),
    ]),
  component: TeacherDevicesPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function TeacherDevicesPage() {
  return (
    <>
      <PageHeader title="Devices" description="Pair a tablet with a student in your class." />
      <DevicesManager studentsQO={studentsQO} />
    </>
  );
}