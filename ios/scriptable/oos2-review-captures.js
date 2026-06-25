const LIST_CAPTURES_URL =
  "https://sxvvyjwvecbqimmqieuv.functions.supabase.co/list-captures?limit=5";
const ENRICH_CAPTURE_URL =
  "https://sxvvyjwvecbqimmqieuv.functions.supabase.co/enrich-capture";
const ARCHIVE_CAPTURE_URL =
  "https://sxvvyjwvecbqimmqieuv.functions.supabase.co/archive-capture";
const PROTOTYPE_HEADER = "x-oos2-prototype-key";
const KEYCHAIN_KEY = "OOS2_PROTOTYPE_KEY";

async function getPrototypeKey() {
  if (Keychain.contains(KEYCHAIN_KEY)) {
    const storedKey = Keychain.get(KEYCHAIN_KEY);
    if (storedKey && storedKey.trim().length > 0) {
      return storedKey.trim();
    }
  }

  const alert = new Alert();
  alert.title = "OOS2 Prototype Key";
  alert.message = "Enter the prototype key. It will be saved in Scriptable Keychain on this iPhone.";
  alert.addSecureTextField("Prototype key");
  alert.addAction("Save");
  alert.addCancelAction("Cancel");

  const result = await alert.presentAlert();
  if (result === -1) {
    throw new Error("prototype_key_required");
  }

  const key = alert.textFieldValue(0).trim();
  if (!key) {
    throw new Error("prototype_key_required");
  }

  Keychain.set(KEYCHAIN_KEY, key);
  return key;
}

async function loadCaptures(prototypeKey) {
  const request = new Request(urlWithCacheBuster(LIST_CAPTURES_URL));
  request.method = "GET";
  request.headers = {
    [PROTOTYPE_HEADER]: prototypeKey,
    "cache-control": "no-cache",
    pragma: "no-cache",
  };
  request.timeoutInterval = 20;

  let responseText;
  try {
    responseText = await request.loadString();
  } catch (error) {
    return {
      ok: false,
      title: "Request failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const statusCode = request.response?.statusCode ?? 0;
  let body = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    return {
      ok: false,
      title: "Unexpected response",
      message: `HTTP ${statusCode}: ${responseText}`,
    };
  }

  if (statusCode === 401) {
    return {
      ok: false,
      title: "Unauthorized",
      message: "The stored prototype key was rejected. Reset the Scriptable Keychain value and run again.",
    };
  }

  if (statusCode < 200 || statusCode >= 300 || body.success !== true) {
    return {
      ok: false,
      title: "List request failed",
      message: `HTTP ${statusCode}: ${JSON.stringify(body)}`,
    };
  }

  if (!Array.isArray(body.captures)) {
    return {
      ok: false,
      title: "Unexpected response",
      message: "The response did not include a captures array.",
    };
  }

  return {
    ok: true,
    count: body.count,
    limit: body.limit,
    captures: body.captures,
  };
}

async function enrichCapture(prototypeKey, captureId) {
  const request = new Request(ENRICH_CAPTURE_URL);
  request.method = "POST";
  request.headers = {
    [PROTOTYPE_HEADER]: prototypeKey,
    "content-type": "application/json",
  };
  request.body = JSON.stringify({
    capture_id: captureId,
  });
  request.timeoutInterval = 20;

  let responseText;
  try {
    responseText = await request.loadString();
  } catch (error) {
    return {
      ok: false,
      title: "Enrich request failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const statusCode = request.response?.statusCode ?? 0;
  let body = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    return {
      ok: false,
      title: "Unexpected enrich response",
      message: `HTTP ${statusCode}: ${responseText}`,
    };
  }

  if (statusCode === 401) {
    return {
      ok: false,
      title: "Unauthorized",
      message: "The stored prototype key was rejected. Reset the Scriptable Keychain value and run again.",
    };
  }

  if (statusCode < 200 || statusCode >= 300 || body.success !== true) {
    return {
      ok: false,
      title: "Enrich request failed",
      message: `HTTP ${statusCode}: ${JSON.stringify(body)}`,
    };
  }

  return {
    ok: true,
    title: "Enriched",
    message: "Capture updated. Latest list reloaded below.",
    body,
  };
}

async function archiveCapture(prototypeKey, captureId) {
  const request = new Request(ARCHIVE_CAPTURE_URL);
  request.method = "POST";
  request.headers = {
    [PROTOTYPE_HEADER]: prototypeKey,
    "content-type": "application/json",
  };
  request.body = JSON.stringify({
    capture_id: captureId,
  });
  request.timeoutInterval = 20;

  let responseText;
  try {
    responseText = await request.loadString();
  } catch (error) {
    return {
      ok: false,
      title: "Archive request failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const statusCode = request.response?.statusCode ?? 0;
  let body = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    return {
      ok: false,
      title: "Unexpected archive response",
      message: `HTTP ${statusCode}: ${responseText}`,
    };
  }

  if (statusCode === 401) {
    return {
      ok: false,
      title: "Unauthorized",
      message: "The stored prototype key was rejected. Reset the Scriptable Keychain value and run again.",
    };
  }

  if (statusCode < 200 || statusCode >= 300 || body.success !== true) {
    return {
      ok: false,
      title: "Archive request failed",
      message: `HTTP ${statusCode}: ${JSON.stringify(body)}`,
    };
  }

  return {
    ok: true,
    title: "Archived",
    message: "Capture cleared from active review.",
    body,
  };
}

function getQueryParameters() {
  if (
    typeof args !== "undefined" &&
    args.queryParameters &&
    typeof args.queryParameters === "object"
  ) {
    return args.queryParameters;
  }

  return {};
}

function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function currentScriptUrl(params) {
  const baseUrl = URLScheme.forRunningScript();
  const [path, queryString = ""] = baseUrl.split("?");
  const currentParams = queryString
    .split("&")
    .filter(Boolean)
    .filter((param) => {
      const key = decodeURIComponent(param.split("=")[0] || "");
      return key !== "action" && key !== "capture_id";
    });
  const nextParams = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  const query = currentParams.concat(nextParams).join("&");

  return query ? `${path}?${query}` : path;
}

function urlWithCacheBuster(url) {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}_=${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[char];
  });
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function renderCapture(capture) {
  const status = capture.processed ? "Enriched" : "New";
  const statusClass = capture.processed ? "status-enriched" : "status-new";
  const barryNote = optionalString(capture.barry_note) || "No Barry note yet.";
  const recommendedAction = optionalString(capture.recommended_action) || "No recommended action yet.";
  const sourceDevice = capture.source_device || "unknown device";
  const sourceChannel = capture.source_channel || "unknown channel";
  const captureId = optionalString(capture.id);
  const details = capture.processed || optionalString(capture.barry_note) || optionalString(capture.recommended_action)
    ? `
      <details class="capture-details">
        <summary>Details</summary>
        <div class="detail-block">
          <div class="detail-label">Barry</div>
          <p>${escapeHtml(barryNote)}</p>
        </div>
        <div class="detail-block">
          <div class="detail-label">Next</div>
          <p>${escapeHtml(recommendedAction)}</p>
        </div>
      </details>
    `
    : "";
  const actions = captureId
    ? `
      <div class="capture-actions">
        <a class="action-link" href="${escapeHtml(currentScriptUrl({
          action: "enrich",
          capture_id: captureId,
        }))}">Enrich</a>
        <a class="action-link action-archive" href="${escapeHtml(currentScriptUrl({
          action: "archive",
          capture_id: captureId,
        }))}">Archive</a>
      </div>
    `
    : "";

  return `
    <article class="capture">
      <div class="capture-header">
        <div class="capture-meta">
          <span>${escapeHtml(formatDate(capture.created_at))}</span>
          <span>${escapeHtml(sourceDevice)} / ${escapeHtml(sourceChannel)}</span>
        </div>
        <span class="${statusClass}">${escapeHtml(status)}</span>
      </div>
      <p class="raw">${escapeHtml(capture.raw_content || "")}</p>
      ${details}
      ${actions}
    </article>
  `;
}

function renderNotice(notice) {
  if (!notice) {
    return "";
  }

  const kind = notice.kind === "success" ? "success" : "error";

  return `
    <div class="notice notice-${kind}">
      <div class="notice-title">${escapeHtml(notice.title)}</div>
      <div>${escapeHtml(notice.message)}</div>
    </div>
  `;
}

function pageShell(title, body, notice = null) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            color-scheme: light dark;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
          }

          body {
            margin: 0;
            background: Canvas;
            color: CanvasText;
          }

          main {
            padding: 20px;
          }

          header {
            margin-bottom: 16px;
          }

          h1 {
            font-size: 24px;
            line-height: 1.15;
            margin: 0 0 6px;
          }

          .subtle {
            color: color-mix(in srgb, CanvasText 62%, Canvas 38%);
            font-size: 14px;
          }

          .capture {
            border-bottom: 1px solid color-mix(in srgb, CanvasText 16%, Canvas 84%);
            padding: 12px 0;
          }

          .capture:first-of-type {
            border-top: 1px solid color-mix(in srgb, CanvasText 16%, Canvas 84%);
          }

          .capture-header {
            align-items: flex-start;
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin-bottom: 6px;
          }

          .capture-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 6px 8px;
            align-items: center;
            color: color-mix(in srgb, CanvasText 62%, Canvas 38%);
            font-size: 12px;
          }

          .capture-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
          }

          .action-link {
            align-items: center;
            border: 1px solid color-mix(in srgb, CanvasText 18%, Canvas 82%);
            border-radius: 8px;
            color: CanvasText;
            display: inline-flex;
            font-size: 14px;
            font-weight: 700;
            min-height: 34px;
            padding: 0 11px;
            text-decoration: none;
          }

          .action-archive {
            color: color-mix(in srgb, CanvasText 72%, Canvas 28%);
          }

          .status-enriched,
          .status-new {
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            padding: 2px 8px;
            white-space: nowrap;
          }

          .status-enriched {
            background: color-mix(in srgb, #1f9d55 18%, Canvas 82%);
            color: color-mix(in srgb, #1f9d55 82%, CanvasText 18%);
          }

          .status-new {
            background: color-mix(in srgb, #b45309 18%, Canvas 82%);
            color: color-mix(in srgb, #b45309 82%, CanvasText 18%);
          }

          .capture-details {
            margin-top: 8px;
          }

          .capture-details summary {
            color: color-mix(in srgb, CanvasText 62%, Canvas 38%);
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
          }

          .detail-block {
            margin-top: 8px;
          }

          .detail-label {
            color: color-mix(in srgb, CanvasText 58%, Canvas 42%);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0;
            text-transform: uppercase;
          }

          p {
            font-size: 15px;
            line-height: 1.42;
            margin: 4px 0 0;
          }

          .raw {
            white-space: pre-wrap;
          }

          .empty,
          .error {
            border: 1px solid color-mix(in srgb, CanvasText 16%, Canvas 84%);
            border-radius: 8px;
            padding: 16px;
            font-size: 16px;
            line-height: 1.4;
          }

          .notice {
            border: 1px solid color-mix(in srgb, CanvasText 16%, Canvas 84%);
            border-radius: 8px;
            font-size: 15px;
            line-height: 1.4;
            margin: 0 0 12px;
            padding: 12px 14px;
          }

          .notice-success {
            background: color-mix(in srgb, #1f9d55 12%, Canvas 88%);
          }

          .notice-error {
            background: color-mix(in srgb, #b42318 12%, Canvas 88%);
          }

          .notice-title {
            font-weight: 700;
            margin-bottom: 3px;
          }


          .error-title {
            font-weight: 700;
            margin-bottom: 6px;
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>${escapeHtml(title)}</h1>
            <div class="subtle">Active captures, newest first</div>
          </header>
          ${renderNotice(notice)}
          ${body}
        </main>
      </body>
    </html>
  `;
}

function renderCaptures(result, notice = null) {
  if (result.captures.length === 0) {
    return pageShell(
      "OOS2 Review",
      '<div class="empty">No active captures.</div>',
      notice,
    );
  }

  const body = result.captures.map(renderCapture).join("");
  return pageShell("OOS2 Review", body, notice);
}


function withoutCaptureId(captures, captureId) {
  if (!captureId) {
    return captures;
  }

  return captures.filter((capture) => optionalString(capture.id) !== captureId);
}

function withCaptures(result, captures) {
  return {
    ...result,
    count: captures.length,
    captures,
  };
}


function renderError(title, message, notice = null) {
  return pageShell(
    "OOS2 Review",
    `
      <div class="error">
        <div class="error-title">${escapeHtml(title)}</div>
        <div>${escapeHtml(message)}</div>
      </div>
    `,
    notice,
  );
}

async function showHtml(html) {
  const webView = new WebView();
  await webView.loadHTML(html);
  await webView.present(true);
}

try {
  const prototypeKey = await getPrototypeKey();
  const queryParameters = getQueryParameters();
  const action = optionalString(queryParameters.action);
  const captureId = optionalString(queryParameters.capture_id);
  let notice = null;
  let archivedCaptureId = null;

  if (action === "enrich") {
    if (!captureId) {
      notice = {
        kind: "error",
        title: "Enrich skipped",
        message: "No capture ID was provided.",
      };
    } else {
      const enrichResult = await enrichCapture(prototypeKey, captureId);
      notice = {
        kind: enrichResult.ok ? "success" : "error",
        title: enrichResult.title,
        message: enrichResult.message,
      };
    }
  } else if (action === "archive") {
    if (!captureId) {
      notice = {
        kind: "error",
        title: "Archive skipped",
        message: "No capture ID was provided.",
      };
    } else {
      const archiveResult = await archiveCapture(prototypeKey, captureId);
      if (archiveResult.ok) {
        archivedCaptureId = captureId;
      }
      notice = {
        kind: archiveResult.ok ? "success" : "error",
        title: archiveResult.title,
        message: archiveResult.message,
      };
    }
  }

  const result = await loadCaptures(prototypeKey);

  if (!result.ok) {
    await showHtml(renderError(result.title, result.message, notice));
  } else {
    const renderedCaptures = withoutCaptureId(result.captures, archivedCaptureId);
    const renderResult = withCaptures(result, renderedCaptures);
    await showHtml(renderCaptures(renderResult, notice));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await showHtml(renderError("Cannot open review", message));
}
