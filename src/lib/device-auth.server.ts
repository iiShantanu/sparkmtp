import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function newPairingCode(): string {
  // 6 chars, no ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function requireDevice(token: string): Promise<{
  device_id: string;
  student_id: string;
}> {
  if (!token) throw new Error("Missing device token");
  const h = hashToken(token);
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, student_id, claimed")
    .eq("token_hash", h)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.claimed || !data.student_id) throw new Error("Device not paired");
  // touch last_seen_at, fire and forget
  void supabaseAdmin
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return { device_id: data.id, student_id: data.student_id };
}