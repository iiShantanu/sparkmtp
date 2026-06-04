import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Mic, MicOff, Send, X } from "lucide-react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useServerFn } from "@tanstack/react-start";
import {
  startVoiceConversation,
  summarizeVoiceSession,
} from "@/lib/student-runtime.functions";
import { SparkAvatar, type SparkEmotion } from "@/components/spark-avatar";

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

function VoiceModeInner({
  token,
  autoStart,
  activeHomeworkId,
  homeworkBar,
}: VoiceModeProps) {
  const startVoice = useServerFn(startVoiceConversation);
  const summarize = useServerFn(summarizeVoiceSession);
  const [warning, setWarning] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  const startedRef = useRef(false);
  const lastHomeworkIdRef = useRef<string | null>(activeHomeworkId);

  const appendLine = useCallback((role: string, text: string) => {
    if (!text.trim()) return;
    transcriptRef.current.push({ role, text });
    setTranscript((t) => [...t, { role, text }]);
  }, []);

  const conv = useConversation({
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
        conv.startSession({
          conversationToken: res.token,
          connectionType: "webrtc",
          ...(overrides ? { overrides } : {}),
        } as Parameters<typeof conv.startSession>[0]);
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
    <div className="space-y-4 p-4">
      {homeworkBar}
      <div className="grid place-items-center rounded-2xl border border-border bg-background p-6 text-center">
        <SparkAvatar emotion={liveEmotion} size={180} />
        <div className="mt-4 text-lg font-semibold">{statusText}</div>
        {warning && <p className="mt-3 max-w-md text-sm text-amber-600">{warning}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
                onClick={() => conv.endSession()}
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
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3 text-sm">
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
          const text = textInput.trim();
          if (!text || !connected) return;
          conv.sendUserMessage(text);
          appendLine("you", text);
          setTextInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={connected ? "Or type to Spark…" : "Start the conversation to type"}
          disabled={!connected}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !textInput.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}