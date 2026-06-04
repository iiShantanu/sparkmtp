import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bluetooth,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock as ClockIcon,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Music as MusicIcon,
  Send,
  Sparkles,
  Timer,
  Wifi,
  X,
} from "lucide-react";
import {
  getStudentSession,
  runHomeworkTurn,
  runSparkTextTurn,
  startVoiceConversation,
  ackNotice,
  summarizeVoiceSession,
} from "@/lib/student-runtime.functions";
import {
  getOrCreateTodayGoal,
  markGoalDone,
  getStreak,
  startQuizSession,
  finishQuiz,
  markHomeworkDone,
} from "@/lib/student-extras.functions";
import { deviceHeartbeat } from "@/lib/device.functions";
import { SparkAvatar, type SparkEmotion } from "@/components/spark-avatar";
import { Clock } from "@/components/student/clock";
import { Pomodoro } from "@/components/student/pomodoro";
import { MusicPlayer } from "@/components/student/music-player";
import { WifiPanel } from "@/components/student/wifi-panel";
import { BluetoothPanel } from "@/components/student/bluetooth-panel";
import { useOnline } from "@/hooks/use-online";

const DISMISSED_KEY = "spark_dismissed_notices";
function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

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

type Homework = {
  id: string;
  title: string;
  subject: string | null;
  instructions?: string | null;
  due_at?: string | null;
};

type StudentSession = {
  student?: {
    full_name?: string | null;
    classes?: { name?: string | null; section?: string | null } | null;
  } | null;
  homework: Homework[];
  notices: Notice[];
};

type DailyGoal = {
  id: string;
  title: string;
  source: "auto" | "teacher";
  completed_at: string | null;
};

type Streak = {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};

type VoiceMessage = {
  type?: string;
  user_transcription_event?: { user_transcript?: string };
  agent_response_event?: { agent_response?: string };
};

type Overlay = null | "voice" | "chat" | "quiz";
type Tool = null | "music" | "pomodoro" | "wifi" | "bt";

function StudentTablet() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const online = useOnline();
  const fetchSession = useServerFn(getStudentSession);
  const heartbeat = useServerFn(deviceHeartbeat);
  const ack = useServerFn(ackNotice);
  const fetchGoal = useServerFn(getOrCreateTodayGoal);
  const completeGoal = useServerFn(markGoalDone);
  const fetchStreak = useServerFn(getStreak);
  const completeHomework = useServerFn(markHomeworkDone);

  const [session, setSession] = useState<StudentSession | null>(null);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, last_active_date: null });
  const [err, setErr] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [activeHomework, setActiveHomework] = useState<Homework | null>(null);
  const [chatSeed, setChatSeed] = useState<string>("");
  const [noticesOpen, setNoticesOpen] = useState(false);
  const dismissedRef = useRef<Set<string>>(loadDismissed());
  const [, forceRender] = useState(0);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("spark_device_token") : null;
    if (!t) {
      navigate({ to: "/device-pair" });
      return;
    }
    setToken(t);
  }, [navigate]);

  const refresh = useCallback(
    async (t: string) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const data = await fetchSession({ data: { device_token: t } });
        setSession(data as StudentSession);
        // best-effort goal + streak
        fetchGoal({ data: { device_token: t } }).then((g) => setGoal(g as DailyGoal)).catch(() => {});
        fetchStreak({ data: { device_token: t } }).then((s) => setStreak(s as Streak)).catch(() => {});
      } catch (e) {
        const msg = (e as Error).message;
        setErr(msg);
        if (/device not paired|missing device token/i.test(msg)) {
          localStorage.removeItem("spark_device_token");
          navigate({ to: "/device-pair" });
        }
      }
    },
    [fetchSession, fetchGoal, fetchStreak, navigate],
  );

  useEffect(() => {
    if (!token) return;
    if (online) refresh(token);
    const interval = setInterval(() => {
      if (!navigator.onLine) return;
      refresh(token);
      heartbeat({ data: { device_token: token } }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [token, online, refresh, heartbeat]);

  if (!token) return null;
  if (err && !session && online) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <p className="text-sm text-destructive">{err}</p>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        {online ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium">You're offline.</p>
            <p className="text-xs text-muted-foreground">
              Connect to Wi-Fi to load your homework. Music, Pomodoro, and the clock still work
              offline.
            </p>
          </div>
        )}
      </main>
    );
  }

  const student = session.student;
  const notices: Notice[] = session.notices ?? [];
  const unseenCount = notices.filter((n) => !dismissedRef.current.has(n.id)).length;

  async function dismiss(id: string) {
    dismissedRef.current.add(id);
    saveDismissed(dismissedRef.current);
    forceRender((x) => x + 1);
    try {
      await ack({ data: { device_token: token!, notice_id: id } });
    } catch (e) {
      console.warn("Notice acknowledgement failed:", (e as Error).message);
    }
  }

  async function onMarkGoalDone() {
    if (!goal || goal.completed_at) return;
    try {
      await completeGoal({ data: { device_token: token!, goal_id: goal.id } });
      setGoal({ ...goal, completed_at: new Date().toISOString() });
      const s = await fetchStreak({ data: { device_token: token! } });
      setStreak(s as Streak);
    } catch (e) {
      console.warn("mark goal done failed:", (e as Error).message);
    }
  }

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
        <div className="flex items-center gap-3">
          <Clock />
          {!online && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Offline
            </span>
          )}
          {streak.current_streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-xs font-semibold text-orange-600">
              <Flame className="h-3 w-3" /> {streak.current_streak}
            </span>
          )}
          <button onClick={() => setTool("wifi")} className="rounded-full border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Wi-Fi">
            <Wifi className="h-4 w-4" />
          </button>
          <button onClick={() => setTool("bt")} className="rounded-full border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Bluetooth">
            <Bluetooth className="h-4 w-4" />
          </button>
          <button
            onClick={() => setNoticesOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open notices"
          >
            <Bell className="h-4 w-4" />
            {notices.length}
            {unseenCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unseenCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Daily goal banner */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Today's goal {goal?.source === "teacher" && <span className="ml-1 text-primary">· set by teacher</span>}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {goal?.title ?? (online ? "Loading…" : "Goal will load when online.")}
              </div>
            </div>
            {goal && (
              <button
                onClick={onMarkGoalDone}
                disabled={!!goal.completed_at || !online}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {goal.completed_at ? "Done" : "Mark done"}
              </button>
            )}
          </div>
        </section>

        {/* Talk + Chat CTAs */}
        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOverlay("voice")}
            disabled={!online}
            className="group flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-sm hover:from-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SparkAvatar emotion="friendly" size={84} showLabel={false} />
            <div className="text-base font-semibold">🎙 Talk to Spark</div>
            <div className="text-xs opacity-90">
              {online ? "Tap and start speaking" : "Needs Wi-Fi"}
            </div>
          </button>
          <button
            onClick={() => {
              setChatSeed("");
              setOverlay("chat");
            }}
            disabled={!online}
            className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-primary/40 bg-card p-5 text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid h-[84px] w-[84px] place-items-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-8 w-8" />
            </span>
            <div className="text-base font-semibold">💬 Chat with Spark</div>
            <div className="text-xs text-muted-foreground">
              {online ? "Type your question" : "Needs Wi-Fi"}
            </div>
          </button>
        </section>

        {/* Smart reminders */}
        <SmartReminders
          session={session}
          onChatTopic={(seed) => {
            setChatSeed(seed);
            setOverlay("chat");
          }}
          onOpenHomework={(h) => {
            setActiveHomework(h);
            setOverlay("voice");
          }}
        />

        {/* Tools row */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tools
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <ToolTile icon={<Brain className="h-5 w-5" />} label="Quiz" onClick={() => setOverlay("quiz")} disabled={!online} />
            <ToolTile icon={<MusicIcon className="h-5 w-5" />} label="Music" onClick={() => setTool("music")} />
            <ToolTile icon={<Timer className="h-5 w-5" />} label="Pomodoro" onClick={() => setTool("pomodoro")} />
            <ToolTile icon={<ClockIcon className="h-5 w-5" />} label="Timer" onClick={() => setTool("pomodoro")} />
            <ToolTile icon={<Wifi className="h-5 w-5" />} label="Wi-Fi" onClick={() => setTool("wifi")} />
          </div>
        </section>

        {/* Homework */}
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
              {session.homework.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => {
                      setActiveHomework(h);
                      setOverlay("voice");
                    }}
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
      </main>

      {/* Overlays */}
      {overlay === "voice" && (
        <OverlayShell
          title={activeHomework ? `Homework · ${activeHomework.title}` : "Talk to Spark"}
          onClose={() => {
            setOverlay(null);
            setActiveHomework(null);
          }}
        >
          <VoiceMode
            token={token}
            autoStart
            onClose={() => {
              setOverlay(null);
              setActiveHomework(null);
            }}
            homeworkOptions={session.homework}
            activeHomework={activeHomework}
            onPickHomework={setActiveHomework}
            onMarkHomeworkDone={async () => {
              if (!activeHomework) return;
              try {
                await completeHomework({
                  data: { device_token: token!, homework_id: activeHomework.id },
                });
                const s = await fetchStreak({ data: { device_token: token! } });
                setStreak(s as Streak);
                setActiveHomework(null);
              } catch (e) {
                console.warn("mark homework done failed:", (e as Error).message);
              }
            }}
          />
        </OverlayShell>
      )}
      {overlay === "chat" && (
        <OverlayShell
          title={activeHomework ? `Homework · ${activeHomework.title}` : "Chat with Spark"}
          onClose={() => {
            setOverlay(null);
            setActiveHomework(null);
          }}
        >
          <ChatMode
            token={token}
            seed={chatSeed}
            homeworkOptions={session.homework}
            activeHomework={activeHomework}
            onPickHomework={setActiveHomework}
            onMarkHomeworkDone={async () => {
              if (!activeHomework) return;
              try {
                await completeHomework({
                  data: { device_token: token!, homework_id: activeHomework.id },
                });
                const s = await fetchStreak({ data: { device_token: token! } });
                setStreak(s as Streak);
                setActiveHomework(null);
              } catch (e) {
                console.warn("mark homework done failed:", (e as Error).message);
              }
            }}
          />
        </OverlayShell>
      )}
      {overlay === "quiz" && (
        <OverlayShell title="Quiz with Spark" onClose={() => setOverlay(null)}>
          <QuizMode token={token} onClose={() => setOverlay(null)} />
        </OverlayShell>
      )}

      {noticesOpen && (
        <NoticesPanel
          notices={notices}
          dismissed={dismissedRef.current}
          onDismiss={dismiss}
          onClose={() => setNoticesOpen(false)}
        />
      )}

      {tool === "music" && <MusicPlayer onClose={() => setTool(null)} />}
      {tool === "pomodoro" && <Pomodoro onClose={() => setTool(null)} token={token} />}
      {tool === "wifi" && <WifiPanel onClose={() => setTool(null)} />}
      {tool === "bt" && <BluetoothPanel onClose={() => setTool(null)} />}
    </div>
  );
}

function OverlayShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ToolTile({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm font-medium transition hover:border-primary hover:bg-accent disabled:opacity-50"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      {label}
    </button>
  );
}

function SmartReminders({
  session,
  onChatTopic,
  onOpenHomework,
}: {
  session: StudentSession;
  onChatTopic: (seed: string) => void;
  onOpenHomework: (h: Homework) => void;
}) {
  const chips = useMemo(() => {
    const out: Array<{
      key: string;
      tone: "red" | "amber" | "blue";
      label: string;
      action: () => void;
    }> = [];
    const now = Date.now();
    for (const h of session.homework) {
      if (!h.due_at) continue;
      const due = new Date(h.due_at).getTime();
      const hoursLeft = (due - now) / 3_600_000;
      if (hoursLeft <= 24 && hoursLeft >= -2) {
        out.push({
          key: `hw-${h.id}`,
          tone: hoursLeft < 0 ? "red" : "amber",
          label: `📚 ${h.title} ${hoursLeft < 0 ? "overdue" : "due today"}`,
          action: () => onOpenHomework(h),
        });
      }
    }
    for (const n of session.notices) {
      if (n.kind !== "exam") continue;
      const start = new Date(n.starts_at).getTime();
      const hoursAway = (start - now) / 3_600_000;
      if (hoursAway > -1 && hoursAway < 48) {
        out.push({
          key: `notice-${n.id}`,
          tone: "red",
          label: `📝 ${n.title}${hoursAway < 24 ? " soon" : ""}`,
          action: () => onChatTopic(`Help me prepare for ${n.title}.`),
        });
      }
    }
    return out.slice(0, 6);
  }, [session, onChatTopic, onOpenHomework]);

  if (chips.length === 0) return null;
  return (
    <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.action}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
            c.tone === "red"
              ? "border-red-500/40 bg-red-500/10 text-red-600"
              : c.tone === "amber"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                : "border-blue-500/40 bg-blue-500/10 text-blue-600"
          }`}
        >
          {c.label}
        </button>
      ))}
    </section>
  );
}

// =====================================================================
// Voice mode (auto-starts on mount when autoStart=true)
// =====================================================================
function VoiceMode({
  token,
  autoStart,
  onClose,
  homeworkOptions,
  activeHomework,
  onPickHomework,
  onMarkHomeworkDone,
}: {
  token: string;
  autoStart?: boolean;
  onClose: () => void;
  homeworkOptions: Homework[];
  activeHomework: Homework | null;
  onPickHomework: (h: Homework | null) => void;
  onMarkHomeworkDone: () => void | Promise<void>;
}) {
  return (
    <ConversationProvider>
      <VoiceModeContent
        token={token}
        autoStart={autoStart}
        onClose={onClose}
        homeworkOptions={homeworkOptions}
        activeHomework={activeHomework}
        onPickHomework={onPickHomework}
        onMarkHomeworkDone={onMarkHomeworkDone}
      />
    </ConversationProvider>
  );
}

function VoiceModeContent({
  token,
  autoStart,
  onClose: _onClose,
  homeworkOptions,
  activeHomework,
  onPickHomework,
  onMarkHomeworkDone,
}: {
  token: string;
  autoStart?: boolean;
  onClose: () => void;
  homeworkOptions: Homework[];
  activeHomework: Homework | null;
  onPickHomework: (h: Homework | null) => void;
  onMarkHomeworkDone: () => void | Promise<void>;
}) {
  const start = useServerFn(startVoiceConversation);
  const textTurn = useServerFn(runSparkTextTurn);
  const summarize = useServerFn(summarizeVoiceSession);
  const [status, setStatus] = useState<string>("Idle");
  const [warning, setWarning] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [agentEmotion, setAgentEmotion] = useState<SparkEmotion>("friendly");
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  const startedRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => setStatus("Connected"),
    onDisconnect: () => {
      setStatus("Idle");
      const lines = transcriptRef.current.map((m) => `${m.role}: ${m.text}`).join("\n");
      if (lines.trim().length > 0) {
        summarize({ data: { device_token: token, transcript: lines } }).catch(() => {});
      }
      transcriptRef.current = [];
    },
    onError: (e: unknown) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`),
    onMessage: (message: unknown) => {
      const m = message as VoiceMessage;
      if (m?.type === "user_transcript") {
        const text = m.user_transcription_event?.user_transcript ?? "";
        transcriptRef.current.push({ role: "student", text });
        setTranscript((t) => [...t, { role: "you", text }]);
      }
      if (m?.type === "agent_response") {
        const raw = m.agent_response_event?.agent_response ?? "";
        const match = raw.match(/^\s*\[emotion:([a-z]+)\]\s*/i);
        if (match) setAgentEmotion(match[1].toLowerCase() as SparkEmotion);
        const clean = raw.replace(/^\s*\[emotion:[a-z]+\]\s*/i, "");
        transcriptRef.current.push({ role: "spark", text: clean });
        setTranscript((t) => [...t, { role: "spark", text: clean }]);
      }
    },
  });

  const begin = useCallback(async () => {
    setStatus("Requesting microphone…");
    setWarning(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await start({
        data: {
          device_token: token,
          homework_id: activeHomework?.id ?? null,
        },
      });
      if (!res.token || !res.agentId) {
        setWarning(res.warning ?? "Voice agent is not configured yet.");
        setStatus("Idle");
        return;
      }
      setStatus("Connecting…");
      const payload: Record<string, unknown> = {
        conversationToken: res.token,
        connectionType: "webrtc",
      };
      if (res.systemPrompt || res.firstMessage || res.language) {
        payload.overrides = {
          agent: {
            ...(res.systemPrompt ? { prompt: { prompt: res.systemPrompt } } : {}),
            ...(res.firstMessage ? { firstMessage: res.firstMessage } : {}),
            ...(res.language ? { language: res.language } : {}),
          },
        };
      }
      try {
        await conversation.startSession(payload as any);
      } catch (e) {
        if (payload.overrides) {
          console.warn("startSession with overrides failed, retrying plain:", (e as Error).message);
          delete payload.overrides;
          await conversation.startSession(payload as any);
        } else {
          throw e;
        }
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      setStatus(`Error: ${msg}`);
      setWarning(`Could not start: ${msg}`);
    }
  }, [conversation, start, token, activeHomework]);

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      begin();
    }
  }, [autoStart, begin]);

  async function sendTextTurn() {
    const text = textInput.trim();
    if (!text || textBusy) return;
    setTextInput("");
    setTextBusy(true);
    setWarning(null);
    setAgentEmotion("thinking");
    setTranscript((t) => [...t, { role: "you", text }]);
    try {
      const res = await textTurn({
        data: {
          device_token: token,
          text,
          homework_id: activeHomework?.id ?? null,
        },
      });
      setAgentEmotion((res.emotion as SparkEmotion) ?? "friendly");
      setTranscript((t) => [...t, { role: "spark", text: res.reply }]);
      if (res.audio_base64) {
        setAgentEmotion("speaking");
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio_base64}`);
        audio.onended = () => setAgentEmotion((res.emotion as SparkEmotion) ?? "friendly");
        audio.play().catch(() => setAgentEmotion((res.emotion as SparkEmotion) ?? "friendly"));
      }
    } catch (e) {
      setAgentEmotion("error");
      setWarning((e as Error).message);
    } finally {
      setTextBusy(false);
    }
  }

  const connected = conversation.status === "connected";
  const liveEmotion: SparkEmotion = textBusy
    ? "thinking"
    : !connected
      ? "idle"
      : conversation.isSpeaking
        ? "speaking"
        : status.startsWith("Error")
          ? "error"
          : agentEmotion === "friendly"
            ? "listening"
            : agentEmotion;

  return (
    <div className="space-y-4 p-4">
      <HomeworkPickerBar
        homeworkOptions={homeworkOptions}
        activeHomework={activeHomework}
        onPickHomework={onPickHomework}
        onMarkHomeworkDone={onMarkHomeworkDone}
      />
      <div className="grid place-items-center rounded-2xl border border-border bg-background p-6 text-center">
        <SparkAvatar emotion={liveEmotion} size={180} />
        <div className="mt-4 text-lg font-semibold">
          {connected
            ? conversation.isSpeaking
              ? "Spark is speaking…"
              : "Listening…"
            : status === "Idle"
              ? "Tap Start to talk"
              : status}
        </div>
        {warning && <p className="mt-3 max-w-md text-sm text-amber-600">{warning}</p>}
        <div className="mt-4 flex gap-3">
          {!connected ? (
            <button
              onClick={begin}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="h-4 w-4" /> Start
            </button>
          ) : (
            <button
              onClick={() => conversation.endSession()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm hover:bg-accent"
            >
              <MicOff className="h-4 w-4" /> End
            </button>
          )}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
          {transcript.map((m, i) => (
            <div key={i}>
              <span className="font-semibold capitalize">{m.role}:</span> {m.text}
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendTextTurn();
        }}
        className="flex gap-2"
      >
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Or type to Spark…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={textBusy || !textInput.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {textBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// Chat mode (text-only)
// =====================================================================
function ChatMode({ token, seed }: { token: string; seed: string }) {
  const turn = useServerFn(runSparkTextTurn);
  const [input, setInput] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "you" | "spark"; text: string; emotion?: SparkEmotion }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setErr(null);
    setMessages((m) => [...m, { role: "you", text }]);
    try {
      const res = await turn({ data: { device_token: token, text } });
      setMessages((m) => [...m, { role: "spark", text: res.reply, emotion: res.emotion as SparkEmotion }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Ask Spark anything — about your homework, a topic you're stuck on, or what to study next.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "you" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <SparkAvatar emotion={m.emotion ?? "friendly"} size={32} showLabel={false} />
              <div className="max-w-[85%] whitespace-pre-wrap text-sm text-foreground">{m.text}</div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Spark is thinking…
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Type your question…"
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// Quiz mode — reuses ElevenLabs voice with a quiz-specific system prompt.
// =====================================================================
function QuizMode({ token, onClose }: { token: string; onClose: () => void }) {
  const startQuiz = useServerFn(startQuizSession);
  const finish = useServerFn(finishQuiz);
  const startVoice = useServerFn(startVoiceConversation);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  return (
    <ConversationProvider>
      <QuizModeInner
        token={token}
        quizId={quizId}
        topic={topic}
        started={started}
        err={err}
        onStart={async () => {
          setErr(null);
          try {
            const s = await startQuiz({ data: { device_token: token } });
            setQuizId(s.quiz_id ?? null);
            setTopic(s.topic);
            setStarted(true);
            return s;
          } catch (e) {
            setErr((e as Error).message);
            return null;
          }
        }}
        startVoice={async () => startVoice({ data: { device_token: token } })}
        finishQuiz={async (score: number, total: number, transcript: string) => {
          if (!quizId) return;
          await finish({ data: { device_token: token, quiz_id: quizId, score, total, transcript } });
        }}
        onClose={onClose}
      />
    </ConversationProvider>
  );
}

type QuizStartResult = { systemPrompt: string; firstMessage: string; topic: string } | null;
type VoiceStartResult = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof startVoiceConversation>>>>;

function QuizModeInner({
  token: _token,
  quizId,
  topic,
  started,
  err,
  onStart,
  startVoice,
  finishQuiz,
  onClose,
}: {
  token: string;
  quizId: string | null;
  topic: string;
  started: boolean;
  err: string | null;
  onStart: () => Promise<QuizStartResult>;
  startVoice: () => Promise<VoiceStartResult>;
  finishQuiz: (score: number, total: number, transcript: string) => Promise<void>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>("Idle");
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  const [emotion, setEmotion] = useState<SparkEmotion>("friendly");

  const conversation = useConversation({
    onConnect: () => setStatus("Quiz in progress…"),
    onDisconnect: () => {
      setStatus("Quiz ended");
      const text = transcriptRef.current.map((m) => `${m.role}: ${m.text}`).join("\n");
      // crude scoring: count "correct" mentions in spark replies (max total).
      const sparkLines = transcriptRef.current.filter((m) => m.role === "spark").map((m) => m.text.toLowerCase());
      const correct = sparkLines.filter((l) => /\bcorrect\b/.test(l) && !/incorrect|not correct/.test(l)).length;
      finishQuiz(Math.min(correct, 5), 5, text).catch(() => {});
    },
    onError: (e: unknown) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`),
    onMessage: (message: unknown) => {
      const m = message as VoiceMessage;
      if (m?.type === "user_transcript") {
        const text = m.user_transcription_event?.user_transcript ?? "";
        transcriptRef.current.push({ role: "student", text });
        setTranscript((t) => [...t, { role: "you", text }]);
      }
      if (m?.type === "agent_response") {
        const raw = m.agent_response_event?.agent_response ?? "";
        const match = raw.match(/^\s*\[emotion:([a-z]+)\]\s*/i);
        if (match) setEmotion(match[1].toLowerCase() as SparkEmotion);
        const clean = raw.replace(/^\s*\[emotion:[a-z]+\]\s*/i, "");
        transcriptRef.current.push({ role: "spark", text: clean });
        setTranscript((t) => [...t, { role: "spark", text: clean }]);
      }
    },
  });

  async function begin() {
    setStatus("Setting up quiz…");
    try {
      const s = await onStart();
      if (!s) return;
      const v = await startVoice();
      if (!v.token || !v.agentId) {
        setStatus(v.warning ?? "Voice agent not configured.");
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const payload: Record<string, unknown> = {
        conversationToken: v.token,
        connectionType: "webrtc",
        overrides: {
          agent: {
            prompt: { prompt: s.systemPrompt },
            firstMessage: s.firstMessage,
            ...(v.language ? { language: v.language } : {}),
          },
        },
      };
      try {
        await conversation.startSession(payload as any);
      } catch (e) {
        console.warn("Quiz start with overrides failed, retrying plain:", (e as Error).message);
        delete payload.overrides;
        await conversation.startSession(payload as any);
      }
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  const connected = conversation.status === "connected";

  return (
    <div className="space-y-4 p-4">
      <div className="grid place-items-center rounded-2xl border border-border bg-background p-6 text-center">
        <SparkAvatar emotion={connected ? (conversation.isSpeaking ? "speaking" : emotion) : "idle"} size={180} />
        <div className="mt-3 text-sm font-semibold">
          {started ? `Quiz topic: ${topic}` : "Ready for a quick 5-question quiz?"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{status}</div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <div className="mt-4 flex gap-3">
          {!connected ? (
            <button
              onClick={begin}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Brain className="h-4 w-4" /> Start quiz
            </button>
          ) : (
            <button
              onClick={() => conversation.endSession()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm hover:bg-accent"
            >
              End quiz
            </button>
          )}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
          {transcript.map((m, i) => (
            <div key={i}>
              <span className="font-semibold capitalize">{m.role}:</span> {m.text}
            </div>
          ))}
        </div>
      )}
      <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
        Close
      </button>
    </div>
  );
}

// =====================================================================
// Homework mode (unchanged behaviour, rendered inside an overlay)
// =====================================================================
function HomeworkMode({ token, homework }: { token: string; homework: Homework }) {
  const run = useServerFn(runHomeworkTurn);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [turns, setTurns] = useState<Array<{ role: "you" | "spark"; text: string }>>([]);
  const [emotion, setEmotion] = useState<SparkEmotion>("friendly");

  useEffect(() => {
    if (!err) return;
    setEmotion("error");
    const t = setTimeout(() => setEmotion("friendly"), 3000);
    return () => clearTimeout(t);
  }, [err]);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setErr(null);
    setEmotion("thinking");
    setTurns((t) => [...t, { role: "you", text }]);
    try {
      const res = await run({ data: { device_token: token, homework_id: homework.id, text } });
      setTurns((t) => [...t, { role: "spark", text: res.reply }]);
      setEmotion(((res.emotion as SparkEmotion) ?? "friendly"));
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
    <div className="space-y-4 p-4">
      <div className="flex justify-center"><SparkAvatar emotion={busy ? "thinking" : emotion} size={120} /></div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{homework.subject}</div>
        <h3 className="text-base font-semibold">{homework.title}</h3>
        {homework.instructions && <p className="mt-2 text-sm text-muted-foreground">{homework.instructions}</p>}
      </div>
      <div className="min-h-[160px] space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
        {turns.length === 0 && (
          <p className="text-muted-foreground">Ask Spark anything — Spark will guide you, not just hand answers.</p>
        )}
        {turns.map((m, i) => (
          <div key={i} className={m.role === "you" ? "text-foreground" : "text-primary"}>
            <span className="font-semibold capitalize">{m.role}:</span> {m.text}
          </div>
        ))}
        {busy && <div className="text-muted-foreground">Spark is thinking…</div>}
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

function NoticesPanel({
  notices,
  dismissed,
  onDismiss,
  onClose,
}: {
  notices: Notice[];
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6 shadow-xl animate-slide-in-right"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="h-5 w-5" /> Notices
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notices yet.</p>
        ) : (
          <ul className="space-y-3">
            {notices.map((n) => {
              const seen = dismissed.has(n.id);
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border p-4 ${
                    seen ? "border-border bg-background" : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {n.kind.replace("_", " ")}
                  </div>
                  <div className="mt-1 font-semibold">{n.title}</div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(n.starts_at).toLocaleString()}</span>
                    {!seen && (
                      <button
                        onClick={() => onDismiss(n.id)}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Mark seen
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
