import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { createPairingCode, deleteDevice, listDevices } from "@/lib/device.functions";

export const devicesQO = queryOptions({
  queryKey: ["devices"],
  queryFn: () => listDevices(),
});

export function DevicesManager({ studentsQO }: { studentsQO: any }) {
  const qc = useQueryClient();
  const { data: devices } = useSuspenseQuery(devicesQO);
  const { data: students } = useSuspenseQuery(studentsQO);
  const create = useServerFn(createPairingCode);
  const del = useServerFn(deleteDevice);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!studentId) return setErr("Pick a student");
    try {
      const res = await create({
        data: { student_id: studentId, name: name || "Classroom tablet" },
      });
      setLastCode(res.code);
      setName("");
      qc.invalidateQueries({ queryKey: ["devices"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <select
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select student…</option>
          {(students as any[]).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <input
          placeholder="Device label (e.g. Tablet A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Generate pairing code
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
      {lastCode && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pairing code (one-time)
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="font-mono text-3xl tracking-[0.4em]">{lastCode}</div>
            <button
              onClick={() => navigator.clipboard.writeText(lastCode)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Enter this on the tablet at <code>/device-pair</code>. Code is single-use.
          </p>
        </div>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(devices as any[]).length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No devices yet.</li>
        )}
        {(devices as any[]).map((d) => (
          <li key={d.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{d.name || "Tablet"}</div>
              <div className="text-xs text-muted-foreground">
                {d.student_name}
                {" · "}
                {d.claimed ? "Paired" : "Awaiting pairing"}
                {d.last_seen_at &&
                  ` · last seen ${new Date(d.last_seen_at).toLocaleString()}`}
                {d.pairing_code && ` · code ${d.pairing_code}`}
              </div>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Remove this device?")) return;
                await del({ data: { id: d.id } });
                qc.invalidateQueries({ queryKey: ["devices"] });
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}