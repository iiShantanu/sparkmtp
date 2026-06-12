// Server-only helpers for ElevenLabs (TTS, STT, Conversational AI tokens).
// Never import from client code.

import { SPARK_VOICE_TOOLS, type VoiceToolDef } from "./spark-voice-tools";

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

// Provision client tools on the agent so it can call browser-side handlers.
// Idempotent; cached per-process for 10 minutes.
let toolsProvisionedCache: { agentId: string; ok: boolean; at: number } | null = null;
function toolDefForApi(t: VoiceToolDef) {
  return {
    type: "client" as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    expects_response: true,
    response_timeout_secs: 15,
  };
}
export async function ensureAgentToolsProvisioned(agentId: string): Promise<boolean> {
  if (
    toolsProvisionedCache &&
    toolsProvisionedCache.agentId === agentId &&
    Date.now() - toolsProvisionedCache.at < 10 * 60_000
  ) {
    return toolsProvisionedCache.ok;
  }
  const tools = SPARK_VOICE_TOOLS.map(toolDefForApi);
  try {
    const res = await fetch(`${API}/convai/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      headers: { "xi-api-key": key(), "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: { tools },
          },
        },
      }),
    });
    let ok = res.ok;
    if (!ok) {
      const errText = await res.text();
      console.warn("ElevenLabs agent PATCH (tools) failed:", res.status, errText);
      // Fall back to legacy shape if the API rejected the nested shape.
      try {
        const res2 = await fetch(`${API}/convai/agents/${encodeURIComponent(agentId)}`, {
          method: "PATCH",
          headers: { "xi-api-key": key(), "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_config: { agent: { tools } },
          }),
        });
        ok = res2.ok;
        if (!ok) {
          console.warn(
            "ElevenLabs agent PATCH (tools fallback) failed:",
            res2.status,
            await res2.text(),
          );
        }
      } catch (e2) {
        console.warn("ElevenLabs agent PATCH (tools fallback) threw:", (e2 as Error).message);
      }
    }
    toolsProvisionedCache = { agentId, ok, at: Date.now() };
    return ok;
  } catch (e) {
    console.warn("ElevenLabs agent PATCH (tools) threw:", (e as Error).message);
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
