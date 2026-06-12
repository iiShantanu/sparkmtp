// Server-only helpers for ElevenLabs (TTS, STT, Conversational AI tokens).
// Never import from client code.

const API = "https://api.elevenlabs.io/v1";

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not configured");
  return k;
}

export async function getConversationToken(agentId: string): Promise<string> {
  const res = await fetch(
    `${API}/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    {
      headers: { "xi-api-key": key() },
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs token failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { token: string };
  return json.token;
}

// Ensure the agent allows per-session overrides for prompt, first_message, and language.
// Idempotent; safe to call on every voice start. Returns true if overrides should be
// passed to startSession, false if the PATCH failed and we should connect without overrides.
let overridesEnabledCache: { agentId: string; ok: boolean; at: number } | null = null;
export async function ensureAgentOverridesEnabled(agentId: string): Promise<boolean> {
  // Cache for 10 minutes per process to avoid PATCH on every Start.
  if (
    overridesEnabledCache &&
    overridesEnabledCache.agentId === agentId &&
    Date.now() - overridesEnabledCache.at < 10 * 60_000
  ) {
    return overridesEnabledCache.ok;
  }
  try {
    const res = await fetch(`${API}/convai/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      headers: { "xi-api-key": key(), "Content-Type": "application/json" },
      body: JSON.stringify({
        platform_settings: {
          overrides: {
            conversation_config_override: {
              agent: {
                prompt: { prompt: true },
                first_message: true,
                language: true,
              },
            },
          },
        },
      }),
    });
    const ok = res.ok;
    if (!ok) {
      console.warn("ElevenLabs agent PATCH (overrides) failed:", res.status, await res.text());
    }
    overridesEnabledCache = { agentId, ok, at: Date.now() };
    return ok;
  } catch (e) {
    console.warn("ElevenLabs agent PATCH threw:", (e as Error).message);
    return false;
  }
}

export async function tts(text: string, voiceId: string): Promise<string> {
  const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
    }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export async function sttBase64(audioBase64: string, mime = "audio/webm"): Promise<string> {
  const bytes = Buffer.from(audioBase64, "base64");
  const blob = new Blob([bytes], { type: mime });
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model_id", "scribe_v2");
  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": key() },
    body: form,
  });
  if (!res.ok) throw new Error(`STT failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}
