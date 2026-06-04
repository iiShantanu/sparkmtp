import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

type Mode = "pomodoro" | "timer" | "stopwatch";
const PRESETS = { pomodoro: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };

function fmt(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function Pomodoro({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [remaining, setRemaining] = useState(PRESETS.pomodoro);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      if (mode === "stopwatch") setElapsed((e) => e + 1);
      else
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            try {
              new Audio(
                "data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YSAAAAAA",
              ).play().catch(() => {});
            } catch {}
            return 0;
          }
          return r - 1;
        });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running, mode]);

  function pick(m: Mode, seconds?: number) {
    setRunning(false);
    setMode(m);
    if (m === "stopwatch") setElapsed(0);
    else setRemaining(seconds ?? PRESETS.pomodoro);
  }

  const display = mode === "stopwatch" ? fmt(elapsed) : fmt(remaining);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex gap-2">
          {(["pomodoro", "timer", "stopwatch"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => pick(m, m === "pomodoro" ? PRESETS.pomodoro : customMin * 60)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="my-8 text-center text-6xl font-bold tabular-nums">{display}</div>
        {mode === "pomodoro" && (
          <div className="mb-4 flex justify-center gap-2 text-xs">
            <button
              onClick={() => pick("pomodoro", PRESETS.pomodoro)}
              className="rounded-md bg-accent px-3 py-1.5"
            >
              25 focus
            </button>
            <button
              onClick={() => pick("pomodoro", PRESETS.shortBreak)}
              className="rounded-md bg-accent px-3 py-1.5"
            >
              5 break
            </button>
            <button
              onClick={() => pick("pomodoro", PRESETS.longBreak)}
              className="rounded-md bg-accent px-3 py-1.5"
            >
              15 long
            </button>
          </div>
        )}
        {mode === "timer" && (
          <div className="mb-4 flex items-center justify-center gap-2 text-sm">
            <label>Minutes:</label>
            <input
              type="number"
              min={1}
              max={180}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value) || 1)}
              className="w-20 rounded-md border border-input bg-background px-2 py-1"
            />
            <button
              onClick={() => pick("timer", customMin * 60)}
              className="rounded-md bg-accent px-3 py-1.5 text-xs"
            >
              Set
            </button>
          </div>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              if (mode === "stopwatch") setElapsed(0);
              else setRemaining(mode === "pomodoro" ? PRESETS.pomodoro : customMin * 60);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
