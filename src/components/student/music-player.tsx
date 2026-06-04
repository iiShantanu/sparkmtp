import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Plus, SkipBack, SkipForward, Trash2, X } from "lucide-react";
import { musicStore, type Track } from "@/lib/music-store";

export function MusicPlayer({ onClose }: { onClose: () => void }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [idx, setIdx] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function refresh() {
    setTracks(await musicStore.list());
  }
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (idx < 0 || idx >= tracks.length) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(tracks[idx].blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [idx, tracks]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.play().catch(() => setPlaying(false));
    else audioRef.current.pause();
  }, [playing, url]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      try {
        await musicStore.add(f);
      } catch (err) {
        console.warn("add track failed", err);
      }
    }
    e.target.value = "";
    await refresh();
  }

  async function del(id: string) {
    await musicStore.remove(id);
    setIdx(-1);
    setPlaying(false);
    await refresh();
  }

  function next() {
    if (!tracks.length) return;
    setIdx((i) => (i + 1) % tracks.length);
    setPlaying(true);
  }
  function prev() {
    if (!tracks.length) return;
    setIdx((i) => (i - 1 + tracks.length) % tracks.length);
    setPlaying(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5" /> Music
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-background p-4">
          <div className="mb-2 truncate text-sm font-medium">
            {idx >= 0 ? tracks[idx]?.name : "No track selected"}
          </div>
          <audio
            ref={audioRef}
            src={url ?? undefined}
            onEnded={next}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            controls
            className="w-full"
          />
          <div className="mt-3 flex justify-center gap-2">
            <button onClick={prev} className="rounded-md bg-accent p-2">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-md bg-primary p-2 text-primary-foreground"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={next} className="rounded-md bg-accent p-2">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>

        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-accent">
          <Plus className="h-4 w-4" /> Add music
          <input type="file" accept="audio/*" multiple onChange={onPick} className="hidden" />
        </label>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {tracks.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Your music library is empty. Add an MP3 to get started.
            </li>
          )}
          {tracks.map((t, i) => (
            <li
              key={t.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                i === idx ? "bg-primary/10 text-primary" : "hover:bg-accent"
              }`}
            >
              <button
                onClick={() => {
                  setIdx(i);
                  setPlaying(true);
                }}
                className="flex-1 truncate text-left"
              >
                {t.name}
              </button>
              <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
