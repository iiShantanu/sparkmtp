import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2, Pause, Play, RotateCcw, X } from "lucide-react";
import { logStudySession } from "@/lib/student-extras.functions";
import { sparkBus } from "@/lib/spark-controls";

type Mode = "pomodoro" | "timer" | "session" | "stopwatch";
const PRESETS = { pomodoro: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
const SESSION_KINDS = [
  { id: "reading", label: "Reading", minutes: 15 },
  { id: "homework", label: "Homework", minutes: 30 },
  { id: "revision", label: "Revision", minutes: 20 },
];

const STORE_KEY = "spark_pomodoro_state";

type PersistedState = {
  mode: Mode;
  endsAt: number | null; // epoch ms
  elapsedAt: number | null; // epoch ms when stopwatch started
  customMin: number;
  sessionKind: string;
  plannedSeconds: number;
  pausedRemaining?: number | null; // seconds left when paused
};

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}
function persist(s: Partial<PersistedState>) {
  try {
    const cur = loadPersisted();
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...cur, ...s }));
  } catch {}
}

function fmt(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function Pomodoro({ onClose, token }: { onClose: () => void; token?: string | null }) {
  const logSession = useServerFn(logStudySession);
  const persisted = loadPersisted();
  const [mode, setMode] = useState<Mode>((persisted.mode as Mode) ?? "pomodoro");
  const [remaining, setRemaining] = useState(PRESETS.pomodoro);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState(persisted.customMin ?? 10);
  const [sessionKind, setSessionKind] = useState<string>(persisted.sessionKind ?? "reading");
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const plannedRef = useRef<number>(persisted.plannedSeconds ?? PRESETS.pomodoro);

  // Voice bus: start / pause / resume / reset.
  useEffect(() => {
    return sparkBus.subscribe((ev) => {
      if (ev.kind !== "pomodoro") return;
      if (ev.action === "start") {
        const secs = Math.max(1, Math.round((ev.minutes ?? 25) * 60));
        setMode("pomodoro");
        setRemaining(secs);
        plannedRef.current = secs;
        setRunning(true);
        persist({
          mode: "pomodoro",
          plannedSeconds: secs,
          endsAt: Date.now() + secs * 1000,
          elapsedAt: null,
        });
      } else if (ev.action === "pause") {
        setRunning(false);
        persist({ endsAt: null, elapsedAt: null });
      } else if (ev.action === "resume") {
        setRunning(true);
        if (mode === "stopwatch") persist({ elapsedAt: Date.now() - elapsed * 1000 });
        else persist({ endsAt: Date.now() + remaining * 1000 });
      } else if (ev.action === "reset") {
        setRunning(false);
        if (mode === "stopwatch") setElapsed(0);
        else setRemaining(plannedRef.current);
        persist({ endsAt: null, elapsedAt: null });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, remaining, elapsed]);

  // Restore in-flight countdown across reload
  useEffect(() => {
    if (persisted.endsAt && persisted.endsAt > Date.now()) {
      setRemaining(Math.round((persisted.endsAt - Date.now()) / 1000));
      setRunning(true);
    } else if (persisted.pausedRemaining && persisted.pausedRemaining > 0) {
      setRemaining(persisted.pausedRemaining);
      setRunning(false);
    } else if (persisted.elapsedAt && persisted.mode === "stopwatch") {
      setElapsed(Math.round((Date.now() - persisted.elapsedAt) / 1000));
      setRunning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      if (mode === "stopwatch") {
        setElapsed((e) => e + 1);
      } else {
        setRemaining((r) => {
          if (r <= 1) {
            handleComplete();
            return 0;
          }
          return r - 1;
        });
      }
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  function handleComplete() {
    setRunning(false);
    persist({ endsAt: null, elapsedAt: null });
    if (mode === "pomodoro") speak("Nice work! Time for a short break.");
    else if (mode === "session") {
      const kind = SESSION_KINDS.find((s) => s.id === sessionKind);
      speak(`${kind?.label ?? "Session"} done. Great focus!`);
      if (token) {
        logSession({
          data: {
            device_token: token,
            kind: kind?.id ?? "session",
            planned_minutes: Math.round(plannedRef.current / 60),
            actual_minutes: Math.round(plannedRef.current / 60),
          },
        }).catch(() => {});
      }
    } else speak("Timer finished.");
  }

  function pick(m: Mode, seconds?: number, opts?: { kind?: string }) {
    setRunning(false);
    setMode(m);
    persist({ mode: m, endsAt: null, elapsedAt: null });
    if (m === "stopwatch") {
      setElapsed(0);
    } else {
      const total = seconds ?? PRESETS.pomodoro;
      setRemaining(total);
      plannedRef.current = total;
      persist({ plannedSeconds: total });
    }
    if (opts?.kind) {
      setSessionKind(opts.kind);
      persist({ sessionKind: opts.kind });
    }
  }

  function toggle() {
    if (running) {
      setRunning(false);
      persist({ endsAt: null, elapsedAt: null, pausedRemaining: mode === "stopwatch" ? null : remaining });
    } else {
      setRunning(true);
      if (mode === "stopwatch") {
        persist({ elapsedAt: Date.now() - elapsed * 1000 });
      } else {
        persist({ endsAt: Date.now() + remaining * 1000, pausedRemaining: null });
      }
    }
  }

  const display = mode === "stopwatch" ? fmt(elapsed) : fmt(remaining);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 grid grid-cols-4 gap-2">
          {(["pomodoro", "timer", "session", "stopwatch"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() =>
                pick(
                  m,
                  m === "pomodoro"
                    ? PRESETS.pomodoro
                    : m === "session"
                      ? (SESSION_KINDS.find((s) => s.id === sessionKind)?.minutes ?? 15) * 60
                      : customMin * 60,
                )
              }
              className={`rounded-md px-1 py-1.5 text-[11px] font-medium capitalize ${
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
            <button onClick={() => pick("pomodoro", PRESETS.pomodoro)} className="rounded-md bg-accent px-3 py-1.5">25 focus</button>
            <button onClick={() => pick("pomodoro", PRESETS.shortBreak)} className="rounded-md bg-accent px-3 py-1.5">5 break</button>
            <button onClick={() => pick("pomodoro", PRESETS.longBreak)} className="rounded-md bg-accent px-3 py-1.5">15 long</button>
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
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setCustomMin(v);
                persist({ customMin: v });
              }}
              className="w-20 rounded-md border border-input bg-background px-2 py-1"
            />
            <button onClick={() => pick("timer", customMin * 60)} className="rounded-md bg-accent px-3 py-1.5 text-xs">Set</button>
          </div>
        )}
        {mode === "session" && (
          <div className="mb-4 flex flex-wrap justify-center gap-2 text-xs">
            {SESSION_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => pick("session", k.minutes * 60, { kind: k.id })}
                className={`rounded-md px-3 py-1.5 ${
                  sessionKind === k.id ? "bg-primary text-primary-foreground" : "bg-accent"
                }`}
              >
                {k.label} · {k.minutes}m
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              persist({ endsAt: null, elapsedAt: null });
              if (mode === "stopwatch") setElapsed(0);
              else
                setRemaining(
                  mode === "pomodoro"
                    ? PRESETS.pomodoro
                    : mode === "session"
                      ? (SESSION_KINDS.find((s) => s.id === sessionKind)?.minutes ?? 15) * 60
                      : customMin * 60,
                );
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
    </div>
  );
}

// ----- Floating mini Pomodoro -----
// Shows whenever a pomodoro/timer/session countdown is running OR paused mid-session.
// Reads persisted state directly so it survives modal close.
export function PomodoroFloating({ onExpand }: { onExpand: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(id);
  }, []);

  const p = loadPersisted();
  const isStopwatch = p.mode === "stopwatch";
  const running = isStopwatch ? !!p.elapsedAt : !!p.endsAt && (p.endsAt ?? 0) > Date.now();
  const paused = !running && !!p.pausedRemaining && (p.pausedRemaining ?? 0) > 0;
  const visible = running || paused;
  if (!visible) return null;

  const seconds = isStopwatch
    ? Math.round((Date.now() - (p.elapsedAt ?? Date.now())) / 1000)
    : running
      ? Math.round(((p.endsAt ?? Date.now()) - Date.now()) / 1000)
      : (p.pausedRemaining ?? 0);

  function pauseResume() {
    const cur = loadPersisted();
    if (running) {
      if (isStopwatch) {
        persist({ elapsedAt: null });
      } else {
        const remaining = Math.max(0, Math.round(((cur.endsAt ?? Date.now()) - Date.now()) / 1000));
        persist({ endsAt: null, pausedRemaining: remaining });
      }
    } else {
      if (isStopwatch) {
        persist({ elapsedAt: Date.now() });
      } else {
        const remaining = cur.pausedRemaining ?? 0;
        persist({ endsAt: Date.now() + remaining * 1000, pausedRemaining: null });
      }
    }
    tick((x) => x + 1);
    // Notify any mounted Pomodoro modal too.
    sparkBus.emit({ kind: "pomodoro", action: running ? "pause" : "resume" });
  }

  function stop() {
    persist({ endsAt: null, elapsedAt: null, pausedRemaining: null });
    sparkBus.emit({ kind: "pomodoro", action: "reset" });
    tick((x) => x + 1);
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <button
        onClick={onExpand}
        className="flex items-center gap-2"
        aria-label="Open Pomodoro"
      >
        <span className="text-base font-bold tabular-nums">{fmt(seconds)}</span>
      </button>
      <button
        onClick={pauseResume}
        aria-label={running ? "Pause" : "Resume"}
        className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onExpand}
        aria-label="Expand"
        className="grid h-7 w-7 place-items-center rounded-full bg-accent text-foreground hover:bg-accent/80"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={stop}
        aria-label="Stop"
        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
