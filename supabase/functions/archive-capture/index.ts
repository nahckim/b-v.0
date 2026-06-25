import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ArchivePayload = {
  capture_id?: unknown;
};

type SupabaseError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

const REQUIRED_HEADER = "x-oos2-prototype-key";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function asRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeSupabaseError(error: SupabaseError | null) {
  return {
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "method_not_allowed" },
      405,
    );
  }

  const expectedPrototypeKey = Deno.env.get("OOS2_PROTOTYPE_KEY");
  if (!expectedPrototypeKey) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  const providedPrototypeKey = req.headers.get(REQUIRED_HEADER);
  if (providedPrototypeKey !== expectedPrototypeKey) {
    return jsonResponse(
      { success: false, error: "unauthorized" },
      401,
    );
  }

  let payload: ArchivePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: "invalid_json" },
      400,
    );
  }

  const captureId = asRequiredString(payload.capture_id);
  if (!captureId) {
    return jsonResponse(
      {
        success: false,
        error: "missing_required_fields",
        required_fields: ["capture_id"],
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const archivedAt = new Date().toISOString();
  const { data: capture, error: updateError } = await supabase
    .from("captures")
    .update({
      archived_at: archivedAt,
    })
    .eq("id", captureId)
    .select("id, archived_at")
    .maybeSingle();

  if (updateError) {
    return jsonResponse(
      {
        success: false,
        error: "capture_archive_failed",
        supabase_error: safeSupabaseError(updateError),
      },
      500,
    );
  }

  if (!capture) {
    return jsonResponse(
      { success: false, error: "capture_not_found", capture_id: captureId },
      404,
    );
  }

  return jsonResponse({
    success: true,
    capture_id: capture.id,
    status: "archived",
    archived_at: capture.archived_at,
  });
});
