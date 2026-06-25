import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CapturePayload = {
  raw_content?: unknown;
  source_device?: unknown;
  source_channel?: unknown;
  source_agent?: unknown;
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

  let payload: CapturePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: "invalid_json" },
      400,
    );
  }

  const rawContent = asRequiredString(payload.raw_content);
  const sourceDevice = asRequiredString(payload.source_device);
  const sourceChannel = asRequiredString(payload.source_channel);
  const sourceAgent = asRequiredString(payload.source_agent) ?? "human";

  if (!rawContent || !sourceDevice || !sourceChannel) {
    return jsonResponse(
      {
        success: false,
        error: "missing_required_fields",
        required_fields: ["raw_content", "source_device", "source_channel"],
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

  const { data, error } = await supabase
    .from("captures")
    .insert({
      raw_content: rawContent,
      source_device: sourceDevice,
      source_channel: sourceChannel,
      source_agent: sourceAgent,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonResponse(
      {
        success: false,
        error: "capture_insert_failed",
        supabase_error: {
          message: error?.message ?? null,
          details: error?.details ?? null,
          hint: error?.hint ?? null,
          code: error?.code ?? null,
        },
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    capture_id: data.id,
    status: "recorded",
  });
});
