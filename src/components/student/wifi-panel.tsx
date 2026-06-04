import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi, X } from "lucide-react";
import { deviceBridge, DeviceBridgeUnavailable, type WifiNetwork, type WifiStatus } from "@/lib/device-bridge";

export function WifiPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pwTarget, setPwTarget] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  async function scan() {
    setBusy(true);
    setErr(null);
    try {
      const [s, n] = await Promise.all([deviceBridge.wifi.status(), deviceBridge.wifi.scan()]);
      setStatus(s);
      setNetworks(n.networks);
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

  async function connect(ssid: string, password?: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await deviceBridge.wifi.connect(ssid, password);
      if (!res.ok) setErr(res.error ?? "Connection failed");
      setPwTarget(null);
      setPw("");
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
            <Wifi className="h-5 w-5" /> Wi-Fi
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
            Wi-Fi controls need the Spark device service running on the Raspberry Pi.
            This only works on the kiosk device, not the browser preview.
          </div>
        ) : (
          <>
            {status && (
              <div className="mb-3 rounded-lg bg-accent/50 p-3 text-xs">
                {status.connected ? (
                  <>
                    <div className="font-semibold">Connected to {status.ssid}</div>
                    <div className="text-muted-foreground">{status.ip}</div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Not connected</div>
                )}
              </div>
            )}
            {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {networks.map((n) => (
                <li key={n.ssid} className="rounded-md hover:bg-accent">
                  {pwTarget === n.ssid ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        connect(n.ssid, pw);
                      }}
                      className="flex items-center gap-2 p-2"
                    >
                      <input
                        autoFocus
                        type="password"
                        placeholder={`Password for ${n.ssid}`}
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      <button className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">Connect</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => (n.security === "open" ? connect(n.ssid) : setPwTarget(n.ssid))}
                      className="flex w-full items-center justify-between p-2 text-left text-sm"
                    >
                      <span className="truncate">
                        {n.ssid} {n.in_use && <span className="text-xs text-primary">· connected</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {n.security !== "open" ? "🔒 " : ""}
                        {n.signal}%
                      </span>
                    </button>
                  )}
                </li>
              ))}
              {networks.length === 0 && !busy && (
                <li className="p-4 text-center text-xs text-muted-foreground">No networks found.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
