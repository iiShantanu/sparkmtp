import { useEffect, useState } from "react";
import { X, Trash2, Plus, Check } from "lucide-react";
import { sparkBus, todosStore } from "@/lib/spark-controls";

type Todo = { id: string; text: string; done: boolean; created_at: string };

export function TodoPanel({ onClose }: { onClose: () => void }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTodos(todosStore.list());
    return sparkBus.subscribe((ev) => {
      if (ev.kind === "store:changed" && ev.key === "todos") {
        setTodos(todosStore.list());
      }
    });
  }, []);

  function add() {
    const text = draft.trim();
    if (!text) return;
    todosStore.add(text);
    setDraft("");
  }
  function toggle(id: string) {
    todosStore.set(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }
  function remove(id: string) {
    todosStore.set(todos.filter((t) => t.id !== id));
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
          <h2 className="text-lg font-semibold">To-Do</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2 border-b border-border p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add a task…"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base"
          />
          <button
            onClick={add}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-4 py-2 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" /> Add
          </button>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {todos.length === 0 && (
            <li className="p-6 text-center text-base text-muted-foreground">No tasks yet.</li>
          )}
          {todos.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-4">
              <button
                onClick={() => toggle(t.id)}
                aria-label={t.done ? "Mark not done" : "Mark done"}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                  t.done ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {t.done && <Check className="h-5 w-5" />}
              </button>
              <span
                className={`flex-1 text-base ${
                  t.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {t.text}
              </span>
              <button
                onClick={() => remove(t.id)}
                aria-label="Delete task"
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