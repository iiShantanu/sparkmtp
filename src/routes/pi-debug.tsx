import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { deviceBridge, DeviceBridgeUnavailable } from "@/lib/device-bridge";

export const Route = createFileRoute("/pi-debug")({
  component: PiDebugPage,
});

type Snapshot = {
  health?: unknown;
  network?: unknown;
  wifiStatus?: unknown;
  btStatus?: unknown;
  error?: string;
  unavailable?: boolean;
  ranAt: string;
};

function PiDebugPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const out: Snapshot = { ranAt: new Date().toLocaleTimeString() };
    try {
      out.health = await deviceBridge.ping();
      out.network = await deviceBridge.network.status();
      out.wifiStatus = await deviceBridge.wifi.status();
      try {
        out.btStatus = await deviceBridge.bluetooth.status();
      } catch (e) {
        out.btStatus = { error: (e as Error).message };
      }
    } catch (e) {
      if (e instanceof DeviceBridgeUnavailable) out.unavailable = true;
      else out.error = (e as Error).message;
    }
    setSnap(out);
    setBusy(false);
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Pi Debug</h1>
          <button
            onClick={run}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Checking…" : "Refresh"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Calls the local Spark device service at http://127.0.0.1:8765 so you can read the Pi's
          IP address, hostname, gateway, current SSID, and Bluetooth adapter state directly from
          the kiosk screen.
        </p>
        {snap?.unavailable && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm">
            Device service unreachable. Make sure spark-device.service is running on this Pi.
          </div>
        )}
        {snap?.error && <p className="text-sm text-destructive">{snap.error}</p>}
        {snap && !snap.unavailable && (
          <>
            <Section title="Network" data={snap.network} />
            <Section title="Wi-Fi" data={snap.wifiStatus} />
            <Section title="Bluetooth" data={snap.btStatus} />
            <Section title="Health" data={snap.health} />
            <p className="text-xs text-muted-foreground">Last run: {snap.ranAt}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}