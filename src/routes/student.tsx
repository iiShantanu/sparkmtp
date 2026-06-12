import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bluetooth,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Music as MusicIcon,
  NotebookPen,
  ListChecks,
  Send,
  Sparkles,
  Timer,
  Wifi,
  X,
} from "lucide-react";
import {
  getStudentSession,
  runHomeworkTurn,
  runQuizVoiceTurn,
  runSparkTextTurn,
  ackNotice,
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
import { PomodoroFloating } from "@/components/student/pomodoro";
import { MusicPlayer } from "@/components/student/music-player";
import { WifiPanel } from "@/components/student/wifi-panel";
import { BluetoothPanel } from "@/components/student/bluetooth-panel";
import { MessagesPanel } from "@/components/student/messages-panel";
import { NotesPanel } from "@/components/student/notes-panel";
import { TodoPanel } from "@/components/student/todo-panel";
import { useOnline } from "@/hooks/use-online";
import { VirtualKeyboard } from "@/components/student/virtual-keyboard";
import { sparkBus, type PanelName } from "@/lib/spark-controls";

const VoiceMode = lazy(() => import("@/components/student/voice-mode"));

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
  ssr: false,
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

type Overlay = null | "voice" | "chat" | "quiz" | "messages";
type Tool = null | "music" | "pomodoro" | "wifi" | "bt" | "notes" | "todo";

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

  // Spark voice tools dispatch panel-open events through sparkBus.
  useEffect(() => {
    const overlayPanels: PanelName[] = ["messages"];
    const toolPanels: Record<Exclude<PanelName, "messages">, Tool> = {
      notes: "notes",
      todo: "todo",
      music: "music",
      pomodoro: "pomodoro",
      wifi: "wifi",
      bt: "bt",
    };
    return sparkBus.subscribe((ev) => {
      if (ev.kind === "panel:open") {
        if (overlayPanels.includes(ev.name)) {
          setOverlay(ev.name as Overlay);
        } else {
          setTool(toolPanels[ev.name as Exclude<PanelName, "messages">]);
          // If voice/chat overlay is up, dismiss it so the tool panel is visible.
          setOverlay((cur) => (cur === "voice" || cur === "chat" ? null : cur));
        }
      } else if (ev.kind === "panel:close") {
        setOverlay(null);
        setTool(null);
      }
    });
  }, []);

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
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold leading-tight">Hi, {student?.full_name?.split(" ")[0]}</div>
          {(student?.classes?.name || streak.current_streak > 0 || !online) && (
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              {student?.classes?.name && (
                <span>
                  {student.classes.name}
                  {student.classes.section ? ` · ${student.classes.section}` : ""}
                </span>
              )}
              {streak.current_streak > 0 && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-orange-600">
                  <Flame className="h-3.5 w-3.5" /> {streak.current_streak}
                </span>
              )}
              {!online && (
                <span className="font-semibold uppercase text-amber-600">Offline</span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Clock />
          <button
            onClick={() => setNoticesOpen(true)}
            className="relative grid h-11 w-11 place-items-center rounded-full border border-border text-foreground hover:bg-accent"
            aria-label="Open notices"
          >
            <Bell className="h-5 w-5" />
            {unseenCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                {unseenCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <PanelScroller
        sparkPanel={
          <SparkPanel
            token={token!}
            online={online}
            goal={goal}
            onMarkGoalDone={onMarkGoalDone}
            chatSeed={chatSeed}
            setChatSeed={setChatSeed}
            openChat={() => setOverlay("chat")}
          />
        }
        toolsPanel={
          <ToolsPanel
            online={online}
            homework={session.homework}
            openQuiz={() => setOverlay("quiz")}
            openMessages={() => setOverlay("messages")}
            openMusic={() => setTool("music")}
            openPomodoro={() => setTool("pomodoro")}
            openWifi={() => setTool("wifi")}
            openBluetooth={() => setTool("bt")}
            openNotes={() => setTool("notes")}
            openTodo={() => setTool("todo")}
            openNotices={() => setNoticesOpen(true)}
            openHomework={(h) => {
              setActiveHomework(h);
              setOverlay("voice");
            }}
          />
        }
      />

      {/* Overlays */}
      {overlay === "voice" && (
        <OverlayShell
          title={activeHomework ? `Homework · ${activeHomework.title}` : "Talk to Spark"}
          onClose={() => {
            setOverlay(null);
            setActiveHomework(null);
          }}
        >
          <ClientOnly fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading voice…</div>}>
            <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading voice…</div>}>
              <VoiceMode
                token={token}
                autoStart
                onClose={() => {
                  setOverlay(null);
                  setActiveHomework(null);
                }}
                activeHomeworkId={activeHomework?.id ?? null}
                homeworkBar={
                  <HomeworkPickerBar
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
                }
              />
            </Suspense>
          </ClientOnly>
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
      {overlay === "messages" && (
        <OverlayShell title="Messages" onClose={() => setOverlay(null)}>
          <MessagesPanel token={token!} />
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
      {tool === "notes" && <NotesPanel onClose={() => setTool(null)} />}
      {tool === "todo" && <TodoPanel onClose={() => setTool(null)} />}
      {tool !== "pomodoro" && (
        <PomodoroFloating onExpand={() => setTool("pomodoro")} />
      )}
      <VirtualKeyboard />
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
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-6"
      style={{ bottom: "var(--osk-height, 0px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        style={{ maxHeight: "calc(95vh - var(--osk-height, 0px))" }}
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

// =====================================================================
// Horizontal panel scroller — two snap panels: Spark and Tools
// =====================================================================
function PanelScroller({
  sparkPanel,
  toolsPanel,
}: {
  sparkPanel: React.ReactNode;
  toolsPanel: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const i = Math.round(el.scrollLeft / w);
      setIndex(i);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") scrollTo(1);
      else if (e.key === "ArrowLeft") scrollTo(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollTo]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollerRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <section className="h-full w-full shrink-0 snap-center overflow-y-auto">
          {sparkPanel}
        </section>
        <section className="h-full w-full shrink-0 snap-center overflow-y-auto">
          {toolsPanel}
        </section>
      </div>
      {index === 0 && (
        <button
          onClick={() => scrollTo(1)}
          aria-label="Tools"
          className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground sm:inline-flex"
        >
          Tools <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {index === 1 && (
        <button
          onClick={() => scrollTo(0)}
          aria-label="Spark"
          className="absolute left-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground sm:inline-flex"
        >
          <ChevronLeft className="h-4 w-4" /> Spark
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {[0, 1].map((i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={i === 0 ? "Show Spark" : "Show tools"}
            className={`pointer-events-auto h-2 rounded-full transition-all ${
              index === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Panel 1 — Spark hero (single Talk button + inline chat composer)
// =====================================================================
function SparkPanel({
  token,
  online,
  goal,
  onMarkGoalDone,
  chatSeed,
  setChatSeed,
  openChat,
}: {
  token: string;
  online: boolean;
  goal: DailyGoal | null;
  onMarkGoalDone: () => void | Promise<void>;
  chatSeed: string;
  setChatSeed: (s: string) => void;
  openChat: () => void;
}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [offlineWarn, setOfflineWarn] = useState(false);

  const startVoice = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOfflineWarn(true);
      return;
    }
    setOfflineWarn(false);
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      /* VoiceMode will surface the error */
    }
    setVoiceActive(true);
  }, []);

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-3 pt-3 pb-16">
      {goal && !goal.completed_at && (
        <button
          onClick={onMarkGoalDone}
          disabled={!online}
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left disabled:opacity-60"
        >
          <span className="truncate text-base font-semibold">🎯 {goal.title}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" /> Done
          </span>
        </button>
      )}

      {/* Hero — fixed area so chat box & tools don't shift when voice mounts */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {!voiceActive ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-6">
            <SparkAvatar emotion="friendly" size={200} showLabel={false} />
            <button
              onClick={startVoice}
              className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
            >
              <Mic className="h-7 w-7" /> Talk to Spark
            </button>
            {(offlineWarn || !online) && (
              <div className="mx-2 max-w-sm rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-3 text-center text-base font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Please connect to the internet to talk to Spark.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full min-h-0 flex-col">
            <ClientOnly fallback={<div className="p-6 text-center text-base text-muted-foreground">Loading voice…</div>}>
              <Suspense fallback={<div className="p-6 text-center text-base text-muted-foreground">Loading voice…</div>}>
                <VoiceMode
                  token={token}
                  autoStart
                  onClose={() => setVoiceActive(false)}
                  activeHomeworkId={null}
                  homeworkBar={null}
                />
              </Suspense>
            </ClientOnly>
          </div>
        )}
      </div>

      {/* Chat composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          openChat();
        }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"
      >
        <input
          value={chatSeed}
          onChange={(e) => setChatSeed(e.target.value)}
          placeholder={online ? "Chat with Spark…" : "Needs Wi-Fi"}
          disabled={!online}
          className="flex-1 bg-transparent px-3 py-3 text-base outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!online}
          aria-label="Open chat"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// Panel 2 — Tools grid
// =====================================================================
function ToolsPanel({
  online,
  homework,
  openQuiz,
  openMessages,
  openMusic,
  openPomodoro,
  openWifi,
  openBluetooth,
  openNotices,
  openHomework,
  openNotes,
  openTodo,
}: {
  online: boolean;
  homework: Homework[];
  openQuiz: () => void;
  openMessages: () => void;
  openMusic: () => void;
  openPomodoro: () => void;
  openWifi: () => void;
  openBluetooth: () => void;
  openNotices: () => void;
  openHomework: (h: Homework) => void;
  openNotes: () => void;
  openTodo: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-4 pb-20">
      <div>
        <h2 className="px-1 text-2xl font-bold">Tools</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <ToolTile icon={<Brain className="h-12 w-12" />} label="Quiz" onClick={openQuiz} disabled={!online} />
          <ToolTile icon={<MessageSquare className="h-12 w-12" />} label="Messages" onClick={openMessages} disabled={!online} />
          <ToolTile icon={<NotebookPen className="h-12 w-12" />} label="Notes" onClick={openNotes} />
          <ToolTile icon={<ListChecks className="h-12 w-12" />} label="To-Do" onClick={openTodo} />
          <ToolTile icon={<MusicIcon className="h-12 w-12" />} label="Music" onClick={openMusic} />
          <ToolTile icon={<Timer className="h-12 w-12" />} label="Pomodoro" onClick={openPomodoro} />
          <ToolTile icon={<Wifi className="h-12 w-12" />} label="Wi-Fi" onClick={openWifi} />
          <ToolTile icon={<Bluetooth className="h-12 w-12" />} label="Bluetooth" onClick={openBluetooth} />
        </div>
      </div>

      <div>
        <h2 className="px-1 text-2xl font-bold">Homework</h2>
        {homework.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-lg text-muted-foreground">
            Nothing for today 🎉
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {homework.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => openHomework(h)}
                  className="w-full rounded-2xl border border-border bg-card p-5 text-left transition active:scale-[0.98] hover:border-primary"
                >
                  {h.subject && (
                    <div className="text-base font-semibold uppercase tracking-wide text-primary">
                      {h.subject}
                    </div>
                  )}
                  <div className="mt-1 text-lg font-semibold leading-tight">{h.title}</div>
                  {h.due_at && (
                    <div className="mt-2 text-base text-muted-foreground">
                      Due {new Date(h.due_at).toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HomeworkPickerBar({
  homeworkOptions,
  activeHomework,
  onPickHomework,
  onMarkHomeworkDone,
}: {
  homeworkOptions: Homework[];
  activeHomework: Homework | null;
  onPickHomework: (h: Homework | null) => void;
  onMarkHomeworkDone: () => void | Promise<void>;
}) {
  if (activeHomework) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
        <BookOpen className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Homework Mode{activeHomework.subject ? ` · ${activeHomework.subject}` : ""}
          </div>
          <div className="truncate font-semibold">{activeHomework.title}</div>
        </div>
        <button
          onClick={() => onMarkHomeworkDone()}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark done
        </button>
        <button
          onClick={() => onPickHomework(null)}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Change
        </button>
      </div>
    );
  }
  if (homeworkOptions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm">
      <BookOpen className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Work on homework:</span>
      <select
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value;
          const found = homeworkOptions.find((h) => h.id === id) ?? null;
          if (found) onPickHomework(found);
        }}
        className="flex-1 min-w-[10rem] rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="">Pick an assignment…</option>
        {homeworkOptions.map((h) => (
          <option key={h.id} value={h.id}>
            {h.subject ? `${h.subject} — ` : ""}
            {h.title}
          </option>
        ))}
      </select>
    </div>
  );
}

type RecorderState = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] };
type RecordedAudio = { base64: string; mime: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read recording"));
    reader.readAsDataURL(blob);
  });
}

function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const utterance = new SpeechSynthesisUtterance(text.replace(/^\s*\[emotion:[a-z]+\]\s*/i, ""));
    utterance.rate = 0.96;
    utterance.pitch = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playSparkAudio(audioBase64: string | null | undefined, text: string) {
  if (audioBase64) {
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    const played = await new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
    if (played) return;
  }
  await speakWithBrowser(text);
}

async function startBrowserRecording(ref: React.MutableRefObject<RecorderState | null>) {
  if (typeof MediaRecorder === "undefined") throw new Error("Voice recording is not supported in this browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  ref.current = { recorder, stream, chunks };
  recorder.start();
}

async function stopBrowserRecording(ref: React.MutableRefObject<RecorderState | null>): Promise<RecordedAudio> {
  const current = ref.current;
  if (!current) throw new Error("No recording is active.");
  const { recorder, stream, chunks } = current;
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  ref.current = null;
  const mime = recorder.mimeType || "audio/webm";
  return { base64: await blobToBase64(new Blob(chunks, { type: mime })), mime };
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
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card p-4 text-lg font-semibold transition active:scale-95 hover:border-primary hover:bg-accent disabled:opacity-50"
    >
      <span className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
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
// Chat mode (text-only)
// =====================================================================
function ChatMode({
  token,
  seed,
  homeworkOptions,
  activeHomework,
  onPickHomework,
  onMarkHomeworkDone,
}: {
  token: string;
  seed: string;
  homeworkOptions: Homework[];
  activeHomework: Homework | null;
  onPickHomework: (h: Homework | null) => void;
  onMarkHomeworkDone: () => void | Promise<void>;
}) {
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
      const res = await turn({
        data: { device_token: token, text, homework_id: activeHomework?.id ?? null },
      });
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
      <div className="border-b border-border p-3">
        <HomeworkPickerBar
          homeworkOptions={homeworkOptions}
          activeHomework={activeHomework}
          onPickHomework={onPickHomework}
          onMarkHomeworkDone={onMarkHomeworkDone}
        />
      </div>
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {activeHomework
              ? `Ask Spark for help with "${activeHomework.title}". Spark will guide you step-by-step.`
              : "Ask Spark anything — about your homework, a topic you're stuck on, or what to study next."}
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
// Quiz mode — stable voice turns: Spark speaks, student records, Spark responds.
// =====================================================================
function QuizMode({ token, onClose }: { token: string; onClose: () => void }) {
  const startQuiz = useServerFn(startQuizSession);
  const finish = useServerFn(finishQuiz);
  const quizTurn = useServerFn(runQuizVoiceTurn);
  const recorderRef = useRef<RecorderState | null>(null);
  const activeRef = useRef(true);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  const [emotion, setEmotion] = useState<SparkEmotion>("friendly");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [questionNo, setQuestionNo] = useState(1);

  const appendLine = useCallback((role: string, text: string) => {
    if (!text.trim()) return;
    transcriptRef.current.push({ role, text });
    setTranscript((t) => [...t, { role: role === "student" ? "you" : role, text }]);
  }, []);

  const finishAttempt = useCallback(
    async (id: string) => {
      const text = transcriptRef.current.map((m) => `${m.role}: ${m.text}`).join("\n");
      const sparkLines = transcriptRef.current.filter((m) => m.role === "spark").map((m) => m.text.toLowerCase());
      const correct = sparkLines.filter((l) => /\bcorrect\b/.test(l) && !/incorrect|not correct/.test(l)).length;
      await finish({ data: { device_token: token, quiz_id: id, score: Math.min(correct, 5), total: 5, transcript: text } });
      setFinished(true);
      setRecording(false);
      setStatus("Quiz finished");
    },
    [finish, token],
  );

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      window.speechSynthesis?.cancel();
      const current = recorderRef.current;
      if (current) {
        current.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
      }
    };
  }, []);

  async function begin() {
    setStatus("Setting up quiz…");
    setErr(null);
    setBusy(true);
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
      permission.getTracks().forEach((track) => track.stop());
      const s = await startQuiz({ data: { device_token: token } });
      if (!s.quiz_id) throw new Error("Could not create quiz.");
      setQuizId(s.quiz_id);
      setTopic(s.topic);
      setStarted(true);
      setFinished(false);
      setTranscript([]);
      transcriptRef.current = [];
      setQuestionNo(1);
      const res = await quizTurn({
        data: { device_token: token, quiz_id: s.quiz_id, topic: s.topic, turn_index: 0 },
      });
      appendLine("spark", res.reply);
      setEmotion("speaking");
      setStatus("Spark is asking question 1…");
      await playSparkAudio(res.audio_base64, res.reply);
      if (!activeRef.current) return;
      await startBrowserRecording(recorderRef);
      setRecording(true);
      setEmotion("listening");
      setStatus("Answer question 1, then tap Done answering");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
      setErr((e as Error).message);
      setEmotion("error");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!quizId || busy || !recording) return;
    setBusy(true);
    setRecording(false);
    setEmotion("thinking");
    setStatus("Spark is checking your answer…");
    try {
      const audio = await stopBrowserRecording(recorderRef);
      const res = await quizTurn({
        data: {
          device_token: token,
          quiz_id: quizId,
          topic,
          turn_index: questionNo,
          transcript_so_far: transcriptRef.current.map((m) => `${m.role}: ${m.text}`).join("\n"),
          audio_base64: audio.base64,
          audio_mime: audio.mime,
        },
      });
      appendLine("student", res.transcript || "(voice answer)");
      appendLine("spark", res.reply);
      setEmotion("speaking");
      await playSparkAudio(res.audio_base64, res.reply);
      if (!activeRef.current) return;
      if (questionNo >= 5) {
        await finishAttempt(quizId);
      } else {
        const next = questionNo + 1;
        setQuestionNo(next);
        await startBrowserRecording(recorderRef);
        setRecording(true);
        setEmotion("listening");
        setStatus(`Answer question ${next}, then tap Done answering`);
      }
    } catch (e) {
      setErr((e as Error).message);
      setStatus(`Error: ${(e as Error).message}`);
      setEmotion("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid place-items-center rounded-2xl border border-border bg-background p-6 text-center">
        <SparkAvatar
          emotion={emotion === "speaking" ? "speaking" : busy ? "thinking" : recording ? "listening" : finished ? "happy" : emotion}
          size={180}
        />
        <div className="mt-3 text-sm font-semibold">
          {started ? `Quiz topic: ${topic}` : "Ready for a quick 5-question quiz?"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{status}</div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <div className="mt-4 flex gap-3">
          {recording ? (
            <button
              onClick={submitAnswer}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <MicOff className="h-4 w-4" /> Done answering
            </button>
          ) : !finished ? (
            <button
              onClick={begin}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {started ? "Restart quiz" : "Start quiz"}
            </button>
          ) : (
            <button onClick={begin} className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm hover:bg-accent">
              <Brain className="h-4 w-4" /> New quiz
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
