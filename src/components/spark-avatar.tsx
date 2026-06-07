export type SparkEmotion =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "friendly"
  | "love"
  | "angry"
  | "forgot"
  | "error";

const COLORS: Record<SparkEmotion, string> = {
  idle: "hsl(var(--primary) / 0.6)",
  listening: "#22c55e",
  thinking: "#a855f7",
  speaking: "#3b82f6",
  happy: "#facc15",
  friendly: "#06b6d4",
  love: "#ec4899",
  angry: "#ef4444",
  forgot: "#94a3b8",
  error: "#f97316",
};

const LABEL: Record<SparkEmotion, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  happy: "Happy",
  friendly: "Friendly",
  love: "Loves it",
  angry: "Hmph!",
  forgot: "Hmm…",
  error: "Oops",
};

export function SparkAvatar({
  emotion,
  size = 180,
  showLabel = true,
}: {
  emotion: SparkEmotion;
  size?: number;
  showLabel?: boolean;
}) {
  const color = COLORS[emotion];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative grid place-items-center rounded-full transition-all duration-300"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 50% 50%, ${color}33, transparent 70%)`,
          boxShadow: `0 0 60px ${color}55`,
        }}
      >
        {/* Pulsing aura ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: `${color}22`,
            animationDuration:
              emotion === "speaking" ? "0.9s" : emotion === "thinking" ? "1.8s" : "2.4s",
          }}
        />
        <div
          key={emotion}
          className="relative grid place-items-center rounded-full overflow-hidden animate-fade-in"
          style={{
            width: size * 0.78,
            height: size * 0.78,
            background: `linear-gradient(135deg, ${color}, ${color}88)`,
          }}
        >
          <FallbackFace emotion={emotion} />
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color }}>
          {LABEL[emotion]}
        </span>
      )}
    </div>
  );
}

function FallbackFace({ emotion }: { emotion: SparkEmotion }) {
  // Simple SVG face that reacts to emotion — guaranteed to render.
  const eye = (cx: number) => {
    if (emotion === "love")
      return (
        <path
          d={`M${cx - 6} 40 q6 -10 12 0 q6 -10 12 0 q0 8 -12 16 q-12 -8 -12 -16 z`}
          fill="#fff"
          transform={`translate(${cx - 6} 0)`}
        />
      );
    if (emotion === "angry")
      return (
        <g>
          <line
            x1={cx - 8}
            y1={36}
            x2={cx + 8}
            y2={42}
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={48} r={4} fill="#fff" />
        </g>
      );
    if (emotion === "thinking" || emotion === "forgot")
      return <ellipse cx={cx} cy={46} rx={5} ry={2} fill="#fff" />;
    return <circle cx={cx} cy={46} r={5} fill="#fff" />;
  };

  const mouth = () => {
    if (emotion === "speaking") return <ellipse cx={60} cy={78} rx={12} ry={6} fill="#fff" />;
    if (emotion === "happy" || emotion === "love" || emotion === "friendly")
      return (
        <path
          d="M44 72 q16 16 32 0"
          stroke="#fff"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      );
    if (emotion === "angry" || emotion === "error")
      return (
        <path
          d="M44 80 q16 -12 32 0"
          stroke="#fff"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      );
    if (emotion === "thinking" || emotion === "forgot")
      return (
        <line x1="48" y1="78" x2="72" y2="78" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      );
    return (
      <path d="M48 76 q12 8 24 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
    );
  };

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full">
      {eye(46)}
      {eye(74)}
      {mouth()}
    </svg>
  );
}
