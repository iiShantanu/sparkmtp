// Client-side control bus and storage helpers used by ElevenLabs voice tools.
// Voice tool handlers emit events here; panels subscribe so voice commands
// open the right UI and reflect state changes immediately.

export type PanelName =
  | "messages"
  | "notes"
  | "todo"
  | "music"
  | "pomodoro"
  | "wifi"
  | "bt";

export type MusicCategory = "lofi" | "focus" | "chill" | "classical" | "nature";

export type SparkEvent =
  | { kind: "panel:open"; name: PanelName }
  | { kind: "panel:close" }
  | { kind: "overlay:close" }
  | {
      kind: "message:sent";
      teacherId: string;
      message: {
        id: string;
        sender_role: "student" | "teacher";
        body: string;
        created_at: string;
        read_at: string | null;
      };
    }
  | {
      kind: "music";
      action: "play" | "pause" | "resume" | "next" | "prev" | "stop";
      category?: MusicCategory;
      track?: string;
    }
  | {
      kind: "pomodoro";
      action: "start" | "pause" | "resume" | "reset";
      minutes?: number;
    }
  | { kind: "store:changed"; key: "notes" | "todos" };

type Listener = (e: SparkEvent) => void;

const listeners = new Set<Listener>();
// Music/Pomodoro events that arrive before the panel mounts get queued for ~5s,
// so "play lofi" can open the player AND start it in the same turn.
const pending: { ev: SparkEvent; expires: number }[] = [];

function flushPending(l: Listener) {
  const now = Date.now();
  for (let i = pending.length - 1; i >= 0; i--) {
    const item = pending[i];
    if (item.expires < now) {
      pending.splice(i, 1);
      continue;
    }
    try {
      l(item.ev);
    } catch {
      /* ignore */
    }
  }
}

export const sparkBus = {
  emit(ev: SparkEvent) {
    const deliverable = listeners.size > 0;
    if (!deliverable && (ev.kind === "music" || ev.kind === "pomodoro")) {
      pending.push({ ev, expires: Date.now() + 5000 });
    }
    listeners.forEach((l) => {
      try {
        l(ev);
      } catch {
        /* ignore */
      }
    });
  },
  subscribe(l: Listener) {
    listeners.add(l);
    flushPending(l);
    return () => {
      listeners.delete(l);
    };
  },
};

const POMODORO_KEY = "spark_pomodoro_state";

type StoredPomodoro = {
  mode?: "pomodoro" | "timer" | "session" | "stopwatch";
  endsAt?: number | null;
  elapsedAt?: number | null;
  customMin?: number;
  sessionKind?: string;
  plannedSeconds?: number;
  pausedRemaining?: number | null;
};

function readPomodoro(): StoredPomodoro {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(POMODORO_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePomodoro(value: StoredPomodoro) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POMODORO_KEY, JSON.stringify({ ...readPomodoro(), ...value }));
  } catch {
    /* ignore */
  }
}

export const pomodoroStore = {
  start(minutes = 25) {
    const seconds = Math.max(1, Math.round(minutes * 60));
    writePomodoro({
      mode: "pomodoro",
      plannedSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
      elapsedAt: null,
      pausedRemaining: null,
    });
  },
  pause() {
    const cur = readPomodoro();
    if (cur.endsAt && cur.endsAt > Date.now()) {
      writePomodoro({
        endsAt: null,
        elapsedAt: null,
        pausedRemaining: Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000)),
      });
    }
  },
  resume() {
    const cur = readPomodoro();
    const remaining = cur.pausedRemaining ?? 0;
    if (remaining > 0) {
      writePomodoro({ endsAt: Date.now() + remaining * 1000, pausedRemaining: null });
    }
  },
  reset() {
    writePomodoro({ endsAt: null, elapsedAt: null, pausedRemaining: null });
  },
};

// ---------- localStorage stores ----------

const NOTES_KEY = "spark_notes_v1";
const TODOS_KEY = "spark_todos_v1";

export type Note = { id: string; text: string; created_at: string };
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const notesStore = {
  list(): Note[] {
    return readJSON<Note[]>(NOTES_KEY, []);
  },
  add(text: string): Note {
    const note: Note = {
      id: crypto.randomUUID(),
      text: text.trim(),
      created_at: new Date().toISOString(),
    };
    const next = [note, ...this.list()];
    writeJSON(NOTES_KEY, next);
    sparkBus.emit({ kind: "store:changed", key: "notes" });
    return note;
  },
  removeLast(): Note | null {
    const cur = this.list();
    if (cur.length === 0) return null;
    const removed = cur[0];
    writeJSON(NOTES_KEY, cur.slice(1));
    sparkBus.emit({ kind: "store:changed", key: "notes" });
    return removed;
  },
  removeMatch(query: string): Note | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const cur = this.list();
    const idx = cur.findIndex((n) => n.text.toLowerCase().includes(q));
    if (idx < 0) return null;
    const removed = cur[idx];
    const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    writeJSON(NOTES_KEY, next);
    sparkBus.emit({ kind: "store:changed", key: "notes" });
    return removed;
  },
  set(value: Note[]) {
    writeJSON(NOTES_KEY, value);
    sparkBus.emit({ kind: "store:changed", key: "notes" });
  },
};

export const todosStore = {
  list(): Todo[] {
    return readJSON<Todo[]>(TODOS_KEY, []);
  },
  add(text: string): Todo {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      created_at: new Date().toISOString(),
    };
    const next = [todo, ...this.list()];
    writeJSON(TODOS_KEY, next);
    sparkBus.emit({ kind: "store:changed", key: "todos" });
    return todo;
  },
  completeMatch(query: string): Todo | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const cur = this.list();
    const idx = cur.findIndex(
      (t) => !t.done && t.text.toLowerCase().includes(q),
    );
    if (idx < 0) return null;
    const updated: Todo = { ...cur[idx], done: true };
    const next = [...cur];
    next[idx] = updated;
    writeJSON(TODOS_KEY, next);
    sparkBus.emit({ kind: "store:changed", key: "todos" });
    return updated;
  },
  removeMatch(query: string): Todo | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const cur = this.list();
    const idx = cur.findIndex((t) => t.text.toLowerCase().includes(q));
    if (idx < 0) return null;
    const removed = cur[idx];
    const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    writeJSON(TODOS_KEY, next);
    sparkBus.emit({ kind: "store:changed", key: "todos" });
    return removed;
  },
  set(value: Todo[]) {
    writeJSON(TODOS_KEY, value);
    sparkBus.emit({ kind: "store:changed", key: "todos" });
  },
};