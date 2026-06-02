import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, Loader2, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import {
  getStudentSession,
  runHomeworkTurn,
  startVoiceConversation,
  ackNotice,
} from "@/lib/student-runtime.functions";
import { deviceHeartbeat } from "@/lib/device.functions";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Spark · Student" }] }),
  component: StudentTablet,
});

type Notice = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  starts_at: string;
  expires_at: string | null;
};

function StudentTablet() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const fetchSession = useServerFn(getStudentSession);
  const heartbeat = useServerFn(deviceHeartbeat);

  const [session, setSession] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "voice" | "homework">("home");
  const [activeHomework, setActiveHomework] = useState<any | null>(null);
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("spark_device_token") : null;
    if (!t) {
      navigate({ to: "/device-pair" });
      return;
    }
    setToken(t);
  }, [navigate]);

  async function refresh(t: string) {
    try {
      const data = await fetchSession({ data: { device_token: t } });
      setSession(data);
      const fresh = (data.notices ?? []).find(
        (n: Notice) => !dismissedRef.current.has(n.id),
      );
      if (fresh && !activeNotice) setActiveNotice(fresh);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      if (/paired|token/i.test(msg)) {
        localStorage.removeItem("spark_device_token");
        navigate({ to: "/device-pair" });
      }
    }
  }

  useEffect(() => {
    if (!token) return;
    refresh(token);
    const interval = setInterval(() => {
      refresh(token);
      heartbeat({ data: { device_token: token } }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;
  if (err && !session) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <p className="text-sm text-destructive">{err}</p>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const student = session.student;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">Hi, {student?.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {student?.classes?.name}
              {student?.classes?.section ? ` · ${student.classes.section}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          {session.notices.length} notice{session.notices.length === 1 ? "" : "s"}
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {view === "home" && (
          <Home
            session={session}
            onTalk={() => setView("voice")}
            onHomework={(h) => {
              setActiveHomework(h);
              setView("homework");
            }}
          />
        )}
        {view === "voice" && (
          <VoiceMode token={token} onBack={() => setView("home")} />
        )}
        {view === "homework" && activeHomework && (
          <HomeworkMode
            token={token}
            homework={activeHomework}
            onBack={() => setView("home")}
          />
        )}
      </main>

      {activeNotice && (
        <NoticeModal
          notice={activeNotice}
          onClose={async () => {
            dismissedRef.current.add(activeNotice.id);
            try {
              await (await import("@/lib/student-runtime.functions"))
                .ackNotice({ data: { device_token: token, notice_id: activeNotice.id } });
            } catch {}
            setActiveNotice(null);
          }}
        />
      )}
    </div>
  );
}

function Home({
  session,
  onTalk,
  onHomework,
}: {
  session: any;
  onTalk: () => void;
  onHomework: (h: any) => void;
}) {
  return (
    <div className="space-y-6">
      <button
        onClick={onTalk}
        className="group flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-6 text-left text-primary-foreground shadow-sm hover:from-primary/90"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/15">
          <Mic className="h-6 w-6" />
        </span>
        <div>
          <div className="text-lg font-semibold">Talk to Spark</div>
          <div className="text-sm opacity-90">
            Ask anything. Spark will help you understand it step by step.
          </div>
        </div>
      </button>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BookOpen className="h-4 w-4" /> Today's homework
        </h2>
        {session.homework.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing assigned right now. 🎉
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {session.homework.map((h: any) => (
              <li key={h.id}>
                <button
                  onClick={() => onHomework(h)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary"
                >
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {h.subject}
                  </div>
                  <div className="mt-1 text-base font-semibold">{h.title}</div>
                  {h.due_at && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Due {new Date(h.due_at).toLocaleString()}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function VoiceMode({ token, onBack }: { token: string; onBack: () => void }) {
  const start = useServerFn(startVoiceConversation);
  const [status, setStatus] = useState<string>("Idle");
  const [warning, setWarning] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);

  const conversation = useConversation({
    onConnect: () => setStatus("Connected"),
    onDisconnect: () => setStatus("Idle"),
    onError: (e: any) => setStatus(`Error: ${e?.message ?? e}`),
    onMessage: (m: any) => {
      if (m?.type === "user_transcript")
        setTranscript((t) => [...t, { role: "you", text: m.user_transcription_event?.user_transcript ?? "" }]);
      if (m?.type === "agent_response")
        setTranscript((t) => [...t, { role: "spark", text: m.agent_response_event?.agent_response ?? "" }]);
    },
  });

  async function begin() {
    setStatus("Requesting microphone…");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await start({ data: { device_token: token } });
      if (!res.token || !res.agentId) {
        setWarning(res.warning ?? "Voice agent is not configured yet.");
        setStatus("Idle");
        return;
      }
      setStatus("Connecting…");
      await conversation.startSession({
        conversationToken: res.token,
        connectionType: "webrtc",
      });
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  const connected = conversation.status === "connected";

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      <div className="grid place-items-center rounded-3xl border border-border bg-card p-10 text-center">
        <div
          className={`grid h-28 w-28 place-items-center rounded-full transition ${
            connected
              ? conversation.isSpeaking
                ? "bg-primary/20 ring-8 ring-primary/30"
                : "bg-primary/10 ring-4 ring-primary/20"
              : "bg-muted"
          }`}
        >
          {connected ? (
            <Mic className="h-10 w-10 text-primary" />
          ) : (
            <MicOff className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="mt-6 text-xl font-semibold">
          {connected ? (conversation.isSpeaking ? "Spark is speaking…" : "Listening…") : "Tap to talk"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{status}</div>
        {warning && <p className="mt-4 max-w-md text-sm text-amber-600">{warning}</p>}
        <div className="mt-6 flex gap-3">
          {!connected ? (
            <button
              onClick={begin}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start
            </button>
          ) : (
            <button
              onClick={() => conversation.endSession()}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:bg-accent"
            >
              End
            </button>
          )}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {transcript.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="font-semibold capitalize">{m.role}:</span> {m.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkMode({
  token,
  homework,
  onBack,
}: {
  token: string;
  homework: any;
  onBack: () => void;
}) {
  const run = useServerFn(runHomeworkTurn);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [turns, setTurns] = useState<Array<{ role: "you" | "spark"; text: string }>>([]);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setErr(null);
    setTurns((t) => [...t, { role: "you", text }]);
    try {
      const res = await run({
        data: { device_token: token, homework_id: homework.id, text },
      });
      setTurns((t) => [...t, { role: "spark", text: res.reply }]);
      if (res.audio_base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio_base64}`);
        audio.play().catch(() => {});
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{homework.subject}</div>
        <h2 className="text-lg font-semibold">{homework.title}</h2>
        {homework.instructions && (
          <p className="mt-2 text-sm text-muted-foreground">{homework.instructions}</p>
        )}
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-card p-4 min-h-[180px]">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask Spark anything about this homework. Spark will help you work it out — not just hand you answers.
          </p>
        )}
        {turns.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${m.role === "you" ? "text-foreground" : "text-primary"}`}
          >
            <span className="font-semibold capitalize">{m.role}:</span> {m.text}
          </div>
        ))}
        {busy && <div className="text-sm text-muted-foreground">Spark is thinking…</div>}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}

function NoticeModal({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Bell className="h-4 w-4" /> {notice.kind.replace("_", " ")}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-lg font-semibold">{notice.title}</h3>
        {notice.body && <p className="mt-2 text-sm text-muted-foreground">{notice.body}</p>}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}