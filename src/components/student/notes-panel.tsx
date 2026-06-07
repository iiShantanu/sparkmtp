import { useEffect, useState } from "react";
import { X, Trash2, Plus } from "lucide-react";

type Note = { id: string; text: string; created_at: string };
const KEY = "spark_notes_v1";

function load(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function save(n: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(n));
  } catch {}
}

export function NotesPanel({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => setNotes(load()), []);

  function add() {
    const text = draft.trim();
    if (!text) return;
    const next = [{ id: crypto.randomUUID(), text, created_at: new Date().toISOString() }, ...notes];
    setNotes(next);
    save(next);
    setDraft("");
  }
  function remove(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    save(next);
  }

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
          <h2 className="text-lg font-semibold">Notes</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2 border-b border-border p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-base"
          />
          <button
            onClick={add}
            className="inline-flex shrink-0 items-center gap-1 self-stretch rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" /> Add
          </button>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {notes.length === 0 && (
            <li className="p-6 text-center text-base text-muted-foreground">No notes yet.</li>
          )}
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-base">{n.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => remove(n.id)}
                aria-label="Delete note"
                className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}