import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function safeSupabaseError(error: SupabaseError | null) {
  return {
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
  };
}

function parseLimit(req: Request): number {
  const url = new URL(req.url);
  const parsed = Number.parseInt(url.searchParams.get("limit") ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5;
  }

  return Math.min(parsed, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  const limit = parseLimit(req);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("captures")
    .select(
      [
        "id",
        "created_at",
        "raw_content",
        "source_device",
        "source_channel",
        "processed",
        "barry_note",
        "recommended_action",
      ].join(", "),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonResponse(
      {
        success: false,
        error: "captures_list_failed",
        supabase_error: safeSupabaseError(error),
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    count: data?.length ?? 0,
    limit,
    captures: data ?? [],
  });
});
