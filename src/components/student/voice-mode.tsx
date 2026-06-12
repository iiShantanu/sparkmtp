import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Mic, MicOff, X } from "lucide-react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useServerFn } from "@tanstack/react-start";
import { startVoiceConversation, summarizeVoiceSession } from "@/lib/student-runtime.functions";
import { SparkAvatar, type SparkEmotion } from "@/components/spark-avatar";
import {
  sparkBus,
  notesStore,
  todosStore,
  type PanelName,
} from "@/lib/spark-controls";
import {
  voiceFindAndSendMessage,
  voiceListRecentMessages,
} from "@/lib/student-messages.functions";
import { deviceBridge, DeviceBridgeUnavailable } from "@/lib/device-bridge";

export type VoiceModeProps = {
  token: string;
  autoStart?: boolean;
  onClose: () => void;
  activeHomeworkId: string | null;
  homeworkBar: ReactNode;
};

export default function VoiceMode(props: VoiceModeProps) {
  return (
    <ConversationProvider>
      <VoiceModeInner {...props} />
    </ConversationProvider>
  );
}

function VoiceModeInner({ token, autoStart, activeHomeworkId, homeworkBar }: VoiceModeProps) {
  const startVoice = useServerFn(startVoiceConversation);
  const summarize = useServerFn(summarizeVoiceSession);
  const sendMsg = useServerFn(voiceFindAndSendMessage);
  const listMsgs = useServerFn(voiceListRecentMessages);
  const [warning, setWarning] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  const startedRef = useRef(false);
  const userEndingRef = useRef(false);
  const lastHomeworkIdRef = useRef<string | null>(activeHomeworkId);

  const appendLine = useCallback((role: string, text: string) => {
    if (!text.trim()) return;
    transcriptRef.current.push({ role, text });
    setTranscript((t) => [...t, { role, text }]);
  }, []);

  // ----- Client tool handlers -----
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const clientTools = useRef<Record<string, (params: any) => Promise<string> | string>>({
    // Panel control
    open_panel: ({ name }: { name: PanelName }) => {
      sparkBus.emit({ kind: "panel:open", name });
      return `Opened ${name}.`;
    },
    close_panel: () => {
      sparkBus.emit({ kind: "panel:close" });
      return "Closed.";
    },

    // Messages
    send_message: async ({ teacher, body }: { teacher: string; body: string }) => {
      sparkBus.emit({ kind: "panel:open", name: "messages" });
      try {
        const res = await sendMsg({
          data: { device_token: tokenRef.current, teacher_query: teacher, body },
        });
        if (!res.ok) return res.error || "Could not send.";
        return `Sent to ${res.to}.`;
      } catch (e) {
        return `Send failed: ${(e as Error).message}`;
      }
    },
    list_recent_messages: async ({
      teacher,
      limit,
    }: { teacher?: string; limit?: number } = {}) => {
      sparkBus.emit({ kind: "panel:open", name: "messages" });
      try {
        const res = await listMsgs({
          data: {
            device_token: tokenRef.current,
            ...(teacher ? { teacher_query: teacher } : {}),
            ...(limit ? { limit } : {}),
          },
        });
        if (!res.ok) return res.error || "No messages.";
        if (res.items.length === 0) return "No messages yet.";
        return res.items
          .map((m) => `${m.from}: ${m.body}`)
          .join(" | ");
      } catch (e) {
        return `Could not load messages: ${(e as Error).message}`;
      }
    },

    // Notes
    add_note: ({ text }: { text: string }) => {
      if (!text?.trim()) return "I need note text.";
      notesStore.add(text);
      sparkBus.emit({ kind: "panel:open", name: "notes" });
      return "Saved.";
    },
    list_notes: ({ limit }: { limit?: number } = {}) => {
      sparkBus.emit({ kind: "panel:open", name: "notes" });
      const n = notesStore.list().slice(0, limit ?? 5);
      if (n.length === 0) return "You have no notes.";
      return n.map((x, i) => `${i + 1}. ${x.text}`).join(" | ");
    },
    delete_note: ({ match }: { match: string }) => {
      const m = (match || "").trim().toLowerCase();
      const removed = !m || m === "last" ? notesStore.removeLast() : notesStore.removeMatch(match);
      sparkBus.emit({ kind: "panel:open", name: "notes" });
      return removed ? "Deleted." : "No matching note.";
    },

    // Todos
    add_todo: ({ text }: { text: string }) => {
      if (!text?.trim()) return "I need a task.";
      todosStore.add(text);
      sparkBus.emit({ kind: "panel:open", name: "todo" });
      return "Added.";
    },
    list_todos: ({ filter }: { filter?: "all" | "open" | "done" } = {}) => {
      sparkBus.emit({ kind: "panel:open", name: "todo" });
      const all = todosStore.list();
      const filtered =
        filter === "all"
          ? all
          : filter === "done"
            ? all.filter((t) => t.done)
            : all.filter((t) => !t.done);
      if (filtered.length === 0) return "Nothing on your list.";
      return filtered.map((t, i) => `${i + 1}. ${t.text}${t.done ? " (done)" : ""}`).join(" | ");
    },
    complete_todo: ({ match }: { match: string }) => {
      const t = todosStore.completeMatch(match);
      sparkBus.emit({ kind: "panel:open", name: "todo" });
      return t ? `Marked "${t.text}" done.` : "I couldn't find that task.";
    },

    // Music
    play_music: ({ category, track }: { category?: string; track?: string } = {}) => {
      sparkBus.emit({ kind: "panel:open", name: "music" });
      sparkBus.emit({
        kind: "music",
        action: "play",
        ...(category ? { category: category as any } : {}),
        ...(track ? { track } : {}),
      });
      return category ? `Playing ${category}.` : "Playing music.";
    },
    pause_music: () => {
      sparkBus.emit({ kind: "music", action: "pause" });
      return "Paused.";
    },
    resume_music: () => {
      sparkBus.emit({ kind: "music", action: "resume" });
      return "Resumed.";
    },
    next_track: () => {
      sparkBus.emit({ kind: "music", action: "next" });
      return "Next.";
    },
    previous_track: () => {
      sparkBus.emit({ kind: "music", action: "prev" });
      return "Back.";
    },

    // Pomodoro
    start_pomodoro: ({ minutes }: { minutes?: number } = {}) => {
      sparkBus.emit({ kind: "panel:open", name: "pomodoro" });
      sparkBus.emit({ kind: "pomodoro", action: "start", minutes: minutes ?? 25 });
      return `Starting a ${minutes ?? 25} minute focus session.`;
    },
    pause_pomodoro: () => {
      sparkBus.emit({ kind: "pomodoro", action: "pause" });
      return "Paused.";
    },
    resume_pomodoro: () => {
      sparkBus.emit({ kind: "pomodoro", action: "resume" });
      return "Resumed.";
    },
    reset_pomodoro: () => {
      sparkBus.emit({ kind: "pomodoro", action: "reset" });
      return "Reset.";
    },

    // Wi-Fi
    wifi_scan: async () => {
      sparkBus.emit({ kind: "panel:open", name: "wifi" });
      try {
        const r = await deviceBridge.wifi.scan();
        if (r.networks.length === 0) return "No networks found.";
        return `Found: ${r.networks
          .slice(0, 8)
          .map((n) => n.ssid)
          .join(", ")}.`;
      } catch (e) {
        if (e instanceof DeviceBridgeUnavailable)
          return "Wi-Fi needs the Spark device — not available in preview.";
        return `Scan failed: ${(e as Error).message}`;
      }
    },
    wifi_connect: async ({ ssid, password }: { ssid: string; password?: string }) => {
      sparkBus.emit({ kind: "panel:open", name: "wifi" });
      try {
        const r = await deviceBridge.wifi.connect(ssid, password);
        return r.ok ? `Connected to ${ssid}.` : `Failed: ${r.error || "unknown error"}`;
      } catch (e) {
        if (e instanceof DeviceBridgeUnavailable)
          return "Wi-Fi needs the Spark device — not available in preview.";
        return `Connect failed: ${(e as Error).message}`;
      }
    },

    // Bluetooth
    bluetooth_scan: async () => {
      sparkBus.emit({ kind: "panel:open", name: "bt" });
      try {
        const r = await deviceBridge.bluetooth.scan();
        if (r.devices.length === 0) return "No devices found.";
        return `Found: ${r.devices
          .slice(0, 8)
          .map((d) => d.name || d.mac)
          .join(", ")}.`;
      } catch (e) {
        if (e instanceof DeviceBridgeUnavailable)
          return "Bluetooth needs the Spark device — not available in preview.";
        return `Scan failed: ${(e as Error).message}`;
      }
    },
    bluetooth_pair: async ({ device }: { device: string }) => {
      sparkBus.emit({ kind: "panel:open", name: "bt" });
      try {
        const scan = await deviceBridge.bluetooth.scan();
        const q = device.toLowerCase();
        const match = scan.devices.find((d) => (d.name || "").toLowerCase().includes(q));
        if (!match) return `No device matching "${device}".`;
        const r = await deviceBridge.bluetooth.pair(match.mac);
        return r.ok ? `Paired with ${match.name || match.mac}.` : `Failed: ${r.error || "unknown"}`;
      } catch (e) {
        if (e instanceof DeviceBridgeUnavailable)
          return "Bluetooth needs the Spark device — not available in preview.";
        return `Pair failed: ${(e as Error).message}`;
      }
    },
  });

  const conv = useConversation({
    clientTools: clientTools.current,
    onMessage: (msg: { source?: string; message?: string }) => {
      const text = (msg?.message ?? "").trim();
      if (!text) return;
      const role = msg?.source === "user" ? "you" : "spark";
      appendLine(role, text);
    },
    onError: (err: unknown) => {
      const message =
        typeof err === "string"
          ? err
          : (err as { message?: string })?.message || "Voice connection error";
      setWarning(message);
    },
    onDisconnect: (details?: { reason?: string; message?: string }) => {
      if (userEndingRef.current) return;
      if (details?.reason === "error") {
        setWarning(details.message || "Spark voice disconnected. Please try again.");
      }
    },
  });

  const begin = useCallback(
    async (homeworkId: string | null) => {
      setWarning(null);
      setStarting(true);
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        }
        const res = await startVoice({
          data: { device_token: token, homework_id: homeworkId },
        });
        if (res.warning) {
          setWarning(res.warning);
          return;
        }
        if (!res.token) {
          setWarning("Voice agent is not configured.");
          return;
        }
        userEndingRef.current = false;
        const overrides: { agent: Record<string, unknown> } | undefined =
          res.overridesEnabled && res.systemPrompt && res.firstMessage
            ? {
                agent: {
                  prompt: { prompt: res.systemPrompt },
                  firstMessage: res.firstMessage,
                  ...(res.language ? { language: res.language } : {}),
                },
              }
            : undefined;
        await Promise.resolve(
          conv.startSession({
            conversationToken: res.token,
            connectionType: "webrtc",
            ...(overrides ? { overrides } : {}),
          } as Parameters<typeof conv.startSession>[0]),
        );
      } catch (e) {
        setWarning((e as Error).message || "Could not start voice");
      } finally {
        setStarting(false);
      }
    },
    [conv, startVoice, token],
  );

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      lastHomeworkIdRef.current = activeHomeworkId;
      begin(activeHomeworkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newId = activeHomeworkId;
    if (!startedRef.current) {
      lastHomeworkIdRef.current = newId;
      return;
    }
    if (lastHomeworkIdRef.current === newId) return;
    lastHomeworkIdRef.current = newId;
    (async () => {
      try {
        userEndingRef.current = true;
        conv.endSession();
      } catch {
        /* ignore */
      }
      await begin(newId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHomeworkId]);

  const summarizeRef = useRef<(lines: string) => void>(() => {});
  useEffect(() => {
    summarizeRef.current = (lines: string) => {
      summarize({ data: { device_token: token, transcript: lines } }).catch(() => {});
    };
  }, [summarize, token]);

  useEffect(() => {
    return () => {
      try {
        userEndingRef.current = true;
        conv.endSession();
      } catch {
        /* ignore */
      }
      const lines = transcriptRef.current.map((m) => `${m.role}: ${m.text}`).join("\n");
      if (lines.trim().length > 0) summarizeRef.current?.(lines);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = conv.status === "connected";
  const connecting = !connected && (starting || conv.status === "connecting");
  const liveEmotion: SparkEmotion = warning
    ? "error"
    : conv.isSpeaking
      ? "speaking"
      : connected
        ? "listening"
        : connecting
          ? "thinking"
          : "friendly";

  const statusText = warning
    ? `Error: ${warning}`
    : connecting
      ? "Connecting to Spark…"
      : conv.isSpeaking
        ? "Spark is speaking…"
        : connected
          ? conv.isMuted
            ? "Mic muted — tap Unmute to speak"
            : "Listening… just start speaking"
          : "Tap Talk to Spark to start a live conversation.";

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      {homeworkBar}
      <div className="flex flex-col items-center justify-center text-center">
        <SparkAvatar emotion={liveEmotion} size={200} />
        <div className="mt-3 text-base font-semibold">{statusText}</div>
        {warning && <p className="mt-2 max-w-md text-sm text-amber-600">{warning}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {connected ? (
            <>
              <button
                onClick={() => conv.setMuted(!conv.isMuted)}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                {conv.isMuted ? (
                  <>
                    <Mic className="h-4 w-4" /> Unmute
                  </>
                ) : (
                  <>
                    <MicOff className="h-4 w-4" /> Mute
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  userEndingRef.current = true;
                  conv.endSession();
                }}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <X className="h-4 w-4" /> End conversation
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                startedRef.current = true;
                begin(activeHomeworkId);
              }}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {warning ? "Try again" : "Talk to Spark"}
            </button>
          )}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3 text-sm">
          {transcript.map((m, i) => (
            <div key={i}>
              <span className="font-semibold capitalize">{m.role}:</span> {m.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
