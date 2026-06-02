import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hashToken,
  newDeviceToken,
  newPairingCode,
  requireDevice,
} from "./device-auth.server";

// --- Admin / teacher: create pairing code for a student ---
export const createPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        student_id: z.string().uuid(),
        name: z.string().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Authorization: admin OR teacher who can see this student.
    // Use the user-context client so RLS enforces visibility.
    const { data: s, error } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("id", data.student_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Student not found or not visible to you");

    const code = newPairingCode();
    const { data: dev, error: insErr } = await supabaseAdmin
      .from("devices")
      .insert({
        student_id: data.student_id,
        name: data.name,
        pairing_code: code,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { code, device_id: dev.id };
  });

// --- List devices for student(s) the caller can see ---
export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Get visible students via RLS first
    const { data: students } = await supabase
      .from("students")
      .select("id, full_name");
    const ids = (students ?? []).map((s: any) => s.id);
    if (ids.length === 0) return [];
    const { data } = await supabaseAdmin
      .from("devices")
      .select("id, name, student_id, pairing_code, claimed, last_seen_at, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: false });
    const byId = new Map(
      (students ?? []).map((s: any) => [s.id, s.full_name as string]),
    );
    return (data ?? []).map((d: any) => ({
      ...d,
      student_name: byId.get(d.student_id) ?? "",
    }));
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Make sure caller can see the student tied to this device
    const { data: dev } = await supabaseAdmin
      .from("devices")
      .select("id, student_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!dev || !dev.student_id) throw new Error("Not found");
    const { data: s } = await supabase
      .from("students")
      .select("id")
      .eq("id", dev.student_id)
      .maybeSingle();
    if (!s) throw new Error("Not authorized");
    const { error } = await supabaseAdmin.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Public: Pi posts the pairing code, gets a long-lived device token ---
export const devicePair = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        code: z.string().min(4).max(12).regex(/^[A-Za-z0-9]+$/),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const { data: dev, error } = await supabaseAdmin
      .from("devices")
      .select("id, student_id, claimed")
      .eq("pairing_code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dev) throw new Error("Invalid code");
    if (dev.claimed) throw new Error("Code already used");
    if (!dev.student_id) throw new Error("Code is not bound to a student");

    const token = newDeviceToken();
    const { error: upErr } = await supabaseAdmin
      .from("devices")
      .update({
        claimed: true,
        token_hash: hashToken(token),
        paired_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        pairing_code: null,
      })
      .eq("id", dev.id);
    if (upErr) throw new Error(upErr.message);

    const { data: s } = await supabaseAdmin
      .from("students")
      .select("id, full_name")
      .eq("id", dev.student_id)
      .single();
    return { device_token: token, student: s };
  });

// --- Heartbeat (so we can show last_seen) ---
export const deviceHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ device_token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    await requireDevice(data.device_token);
    return { ok: true };
  });