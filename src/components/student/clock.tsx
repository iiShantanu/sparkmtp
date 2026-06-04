import { useEffect, useState } from "react";

export function Clock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className={`text-right leading-tight ${className}`}>
      <div className="text-base font-semibold tabular-nums">{time}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{date}</div>
    </div>
  );
}
