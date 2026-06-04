// Client for the Spark device helper service running locally on the Raspberry Pi
// at http://127.0.0.1:8765. The helper wraps `nmcli` (Wi-Fi) and `bluetoothctl`
// (Bluetooth) so the browser can manage hardware. When the helper is not running
// (e.g. development on a laptop, or the Pi service is down), every call rejects
// with a typed error so the UI can show a friendly "unavailable" state.

const BASE = "http://127.0.0.1:8765";
const TIMEOUT_MS = 4000;

export class DeviceBridgeUnavailable extends Error {
  constructor(msg = "Spark device service is not reachable on this device.") {
    super(msg);
    this.name = "DeviceBridgeUnavailable";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === "AbortError" || /Failed to fetch|NetworkError/i.test(String(e))) {
      throw new DeviceBridgeUnavailable();
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export type WifiNetwork = {
  ssid: string;
  signal: number; // 0-100
  security: string; // "WPA2", "open", etc.
  in_use: boolean;
};
export type WifiStatus = { connected: boolean; ssid: string | null; ip: string | null };

export const deviceBridge = {
  ping: () => call<{ ok: true; version: string }>("/health"),
  wifi: {
    status: () => call<WifiStatus>("/wifi/status"),
    scan: () => call<{ networks: WifiNetwork[] }>("/wifi/scan"),
    connect: (ssid: string, password?: string) =>
      call<{ ok: boolean; error?: string }>("/wifi/connect", {
        method: "POST",
        body: JSON.stringify({ ssid, password }),
      }),
    disconnect: () => call<{ ok: boolean }>("/wifi/disconnect", { method: "POST" }),
  },
  bluetooth: {
    status: () =>
      call<{ powered: boolean; connected: Array<{ mac: string; name: string }> }>("/bt/status"),
    scan: () => call<{ devices: Array<{ mac: string; name: string; paired: boolean }> }>("/bt/scan"),
    pair: (mac: string) => call<{ ok: boolean; error?: string }>("/bt/pair", {
      method: "POST",
      body: JSON.stringify({ mac }),
    }),
    connect: (mac: string) => call<{ ok: boolean; error?: string }>("/bt/connect", {
      method: "POST",
      body: JSON.stringify({ mac }),
    }),
    disconnect: (mac: string) => call<{ ok: boolean }>("/bt/disconnect", {
      method: "POST",
      body: JSON.stringify({ mac }),
    }),
    power: (on: boolean) => call<{ ok: boolean }>("/bt/power", {
      method: "POST",
      body: JSON.stringify({ on }),
    }),
  },
};
