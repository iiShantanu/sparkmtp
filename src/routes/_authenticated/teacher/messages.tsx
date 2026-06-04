import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  listTeacherConversation,
  listTeacherInbox,
  sendTeacherMessage,
} from "@/lib/student-messages.functions";

export const Route = createFileRoute("/_authenticated/teacher/messages")({
  component: TeacherMessagesPage,
});

type InboxItem = {
  student_id: string;
  full_name: string;
  avatar_url: string | null;
  class_label: string | null;
  last: { body: string; created_at: string; sender_role: string } | null;
  unread: number;
};

type Msg = {
  id: string;
  sender_role: "student" | "teacher";
  body: string;
  created_at: string;
  read_at: string | null;
};

function TeacherMessagesPage() {
  const inboxFn = useServerFn(listTeacherInbox);
  const convoFn = useServerFn(listTeacherConversation);
  const sendFn = useServerFn(sendTeacherMessage);
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: ["teacher", "messages", "inbox"],
    queryFn: () => inboxFn() as Promise<InboxItem[]>,
    refetchInterval: 15_000,
  });

  const [active, setActive] = useState<InboxItem | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const convo = useQuery({
    queryKey: ["teacher", "messages", "convo", active?.student_id ?? null],
    queryFn: () =>
      convoFn({ data: { student_id: active!.student_id } }) as Promise<Msg[]>,
    enabled: !!active,
    refetchInterval: active ? 10_000 : false,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo.data?.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !active || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sendFn({ data: { student_id: active.student_id, body } });
      setDraft("");
      await convo.refetch();
      queryClient.invalidateQueries({ queryKey: ["teacher", "messages", "inbox"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Messages" description="Conversations with your students" />
      <div className="grid h-[70vh] grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        <aside className="overflow-y-auto rounded-xl border border-border bg-card">
          {inbox.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          )}
          {inbox.error && (
            <p className="p-4 text-sm text-destructive">
              {(inbox.error as Error).message}
            </p>
          )}
          {inbox.data && inbox.data.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No students yet.</p>
          )}
          <ul className="divide-y divide-border">
            {(inbox.data ?? []).map((s) => (
              <li key={s.student_id}>
                <button
                  onClick={() => setActive(s)}
                  className={`flex w-full items-center gap-3 p-3 text-left hover:bg-accent ${
                    active?.student_id === s.student_id ? "bg-accent" : ""
                  }`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">
                        {s.full_name}
                      </div>
                      {s.unread > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          {s.unread}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.last
                        ? `${s.last.sender_role === "teacher" ? "You: " : ""}${s.last.body}`
                        : (s.class_label ?? "No messages yet")}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {!active ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
              Pick a student to view the conversation.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <button
                  onClick={() => setActive(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{active.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {active.class_label ?? "Student"}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {convo.isLoading && (
                  <p className="text-center text-sm text-muted-foreground">Loading…</p>
                )}
                {(convo.data ?? []).length === 0 && !convo.isLoading && (
                  <p className="text-center text-sm text-muted-foreground">
                    No messages yet. Say hello!
                  </p>
                )}
                {(convo.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_role === "teacher" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender_role === "teacher"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.body}
                      <div className="mt-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
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
                  placeholder="Reply to your student…"
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
            </>
          )}
        </section>
      </div>
    </>
  );
}