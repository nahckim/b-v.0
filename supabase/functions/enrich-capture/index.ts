import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EnrichPayload = {
  capture_id?: unknown;
};

type SupabaseError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

const REQUIRED_HEADER = "x-oos2-prototype-key";
const BARRY_NOTE = "This looks like a general capture that may need review.";
const RECOMMENDED_ACTION = "Review and route this capture.";

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

function slackText(rawContent: string): string {
  return [
    `CAPTURED: ${rawContent}`,
    `UNDERSTOOD: ${BARRY_NOTE}`,
    `NEXT: ${RECOMMENDED_ACTION}`,
  ].join("\n");
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

  let payload: EnrichPayload;
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

  const { data: capture, error: loadError } = await supabase
    .from("captures")
    .select("id, raw_content")
    .eq("id", captureId)
    .maybeSingle();

  if (loadError) {
    return jsonResponse(
      {
        success: false,
        error: "capture_load_failed",
        supabase_error: safeSupabaseError(loadError),
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

  const processedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("captures")
    .update({
      processed: true,
      barry_note: BARRY_NOTE,
      recommended_action: RECOMMENDED_ACTION,
      processed_at: processedAt,
    })
    .eq("id", captureId);

  if (updateError) {
    return jsonResponse(
      {
        success: false,
        error: "capture_update_failed",
        supabase_error: safeSupabaseError(updateError),
      },
      500,
    );
  }

  const slack = {
    attempted: false,
    posted: false,
    error: null as string | null,
  };
  const slackWebhookUrl = Deno.env.get("SLACK_BARRY_WEBHOOK_URL");

  if (slackWebhookUrl) {
    slack.attempted = true;

    try {
      const slackResponse = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: slackText(capture.raw_content),
        }),
      });

      if (!slackResponse.ok) {
        throw new Error(`slack_http_${slackResponse.status}`);
      }

      slack.posted = true;
      await supabase
        .from("captures")
        .update({
          slack_posted_at: new Date().toISOString(),
          slack_error: null,
        })
        .eq("id", captureId);
    } catch (error) {
      slack.error = error instanceof Error ? error.message : "slack_post_failed";
      await supabase
        .from("captures")
        .update({
          slack_error: slack.error,
        })
        .eq("id", captureId);
    }
  }

  return jsonResponse({
    success: true,
    capture_id: captureId,
    status: "enriched",
    processed: true,
    processed_at: processedAt,
    barry_note: BARRY_NOTE,
    recommended_action: RECOMMENDED_ACTION,
    slack,
  });
});
