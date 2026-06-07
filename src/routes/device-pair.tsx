import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { SparkLogo } from "@/components/spark-logo";
import { devicePair } from "@/lib/device.functions";
import { VirtualKeyboard } from "@/components/student/virtual-keyboard";

export const Route = createFileRoute("/device-pair")({
  head: () => ({ meta: [{ title: "Pair Spark Tablet" }] }),
  component: DevicePairPage,
});

function DevicePairPage() {
  const navigate = useNavigate();
  const pair = useServerFn(devicePair);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("spark_device_token")) {
      navigate({ to: "/student" });
    }
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await pair({ data: { code: code.trim().toUpperCase() } });
      localStorage.setItem("spark_device_token", res.device_token);
      navigate({ to: "/student" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <SparkLogo size="md" />
          <div>
            <h1 className="text-xl font-semibold">Pair this tablet</h1>
            <p className="text-sm text-muted-foreground">
              Ask your teacher for a 6-character code.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] uppercase"
            maxLength={8}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            disabled={busy || code.length < 4}
            className="w-full rounded-md bg-primary px-3 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Pairing…" : "Pair tablet"}
          </button>
        </form>
      </div>
      <VirtualKeyboard />
    </main>
  );
}