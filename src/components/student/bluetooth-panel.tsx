import { useEffect, useState } from "react";
import { Bluetooth, Loader2, RefreshCw, X } from "lucide-react";
import { deviceBridge, DeviceBridgeUnavailable } from "@/lib/device-bridge";

type BtDevice = { mac: string; name: string; paired: boolean };

export function BluetoothPanel({ onClose }: { onClose: () => void }) {
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [powered, setPowered] = useState(false);

  async function scan() {
    setBusy(true);
    setErr(null);
    try {
      const s = await deviceBridge.bluetooth.status();
      setPowered(s.powered);
      const r = await deviceBridge.bluetooth.scan();
      setDevices(r.devices);
      setUnavailable(false);
    } catch (e) {
      if (e instanceof DeviceBridgeUnavailable) setUnavailable(true);
      else setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    scan();
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await scan();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bluetooth className="h-5 w-5" /> Bluetooth
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={scan} disabled={busy || unavailable} className="rounded-md p-1.5 hover:bg-accent">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button onClick={onClose}><X className="h-5 w-5" /></button>
          </div>
        </div>

        {unavailable ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Bluetooth needs the Spark device service running on the Raspberry Pi.
            This only works on the kiosk device, not the browser preview.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between rounded-lg bg-accent/50 p-3 text-xs">
              <span>Adapter: {powered ? "On" : "Off"}</span>
              <button
                onClick={() => act(() => deviceBridge.bluetooth.power(!powered))}
                className="rounded-md bg-primary px-2 py-1 text-primary-foreground"
              >
                {powered ? "Turn off" : "Turn on"}
              </button>
            </div>
            {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {devices.map((d) => (
                <li key={d.mac} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">
                  <div className="min-w-0 flex-1 truncate text-sm">
                    {d.name || d.mac}{" "}
                    {d.paired && <span className="text-xs text-primary">· paired</span>}
                  </div>
                  <div className="flex gap-1">
                    {!d.paired && (
                      <button onClick={() => act(() => deviceBridge.bluetooth.pair(d.mac))} className="rounded-md bg-accent px-2 py-1 text-xs">
                        Pair
                      </button>
                    )}
                    <button onClick={() => act(() => deviceBridge.bluetooth.connect(d.mac))} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
                      Connect
                    </button>
                  </div>
                </li>
              ))}
              {devices.length === 0 && !busy && (
                <li className="p-4 text-center text-xs text-muted-foreground">No devices found yet.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
