import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import {
  listStudentMessages,
  listStudentTeachers,
  sendStudentMessage,
} from "@/lib/student-messages.functions";

type Teacher = {
  teacher_id: string;
  subject: string | null;
  full_name: string;
  avatar_url: string | null;
  unread: number;
};

type Msg = {
  id: string;
  sender_role: "student" | "teacher";
  body: string;
  created_at: string;
  read_at: string | null;
};

export function MessagesPanel({ token }: { token: string }) {
  const listTeachers = useServerFn(listStudentTeachers);
  const listMessages = useServerFn(listStudentMessages);
  const sendMessage = useServerFn(sendStudentMessage);

  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [active, setActive] = useState<Teacher | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listTeachers({ data: { device_token: token } })
      .then((rows) => setTeachers(rows as Teacher[]))
      .catch((e) => setErr((e as Error).message));
  }, [listTeachers, token]);

  useEffect(() => {
    if (!active) return;
    setMessages([]);
    listMessages({ data: { device_token: token, teacher_id: active.teacher_id } })
      .then((rows) => setMessages(rows as Msg[]))
      .catch((e) => setErr((e as Error).message));
  }, [active, listMessages, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || !active || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const inserted = await sendMessage({
        data: { device_token: token, teacher_id: active.teacher_id, body: text },
      });
      setMessages((m) => [...m, inserted as Msg]);
      setDraft("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Pick a teacher to message. They'll reply from their dashboard.
        </p>
        {err && <p className="text-sm text-amber-600">{err}</p>}
        {!teachers ? (
          <p className="text-sm text-muted-foreground">Loading teachers…</p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teachers are linked to your class yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {teachers.map((t) => (
              <li key={t.teacher_id}>
                <button
                  onClick={() => setActive(t)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.subject ?? "Teacher"}
                    </div>
                  </div>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {t.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => setActive(null)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{active.full_name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {active.subject ?? "Teacher"}
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Say hi or ask a doubt. Your teacher will see it on their dashboard.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_role === "student"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.body}
                <div className="mt-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {err && <p className="px-3 pb-1 text-xs text-amber-600">{err}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}