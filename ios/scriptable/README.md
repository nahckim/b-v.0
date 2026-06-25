# OOS2 Scriptable Review

This is an iPhone capture ledger for the OOS2 minimal slice. It calls `list-captures`, displays active captures newest-first, can enrich a selected capture, and can archive a handled capture from the active review queue.

## Install

1. Install Scriptable from the App Store.
2. Open Scriptable.
3. Create a new script named `OOS2 Review Captures`.
4. Paste the contents of `oos2-review-captures.js` into the script.
5. Run the script.

## First Run

On first run, the script prompts for the OOS2 prototype key. The key is saved in Scriptable Keychain under:

```text
OOS2_PROTOTYPE_KEY
```

The key is sent only as this request header:

```text
x-oos2-prototype-key
```

The script does not display the key. It uses the key for listing, enrichment, and archive requests.

## What It Shows

The script opens a full-screen ledger page with the latest five active captures from:

```text
https://sxvvyjwvecbqimmqieuv.functions.supabase.co/list-captures?limit=5
```

`list-captures` returns active captures only. A capture is active while `archived_at` is null.

Each active capture row shows:

- raw content
- source device and source channel
- creation time
- status: `New` or `Enriched`
- Enrich action
- Archive action

Barry note and recommended action are hidden behind row details when enrichment exists.

## Lifecycle

`processed` means the capture has been enriched. It does not mean the capture has been reviewed or handled.

`archived_at` means the capture has been cleared from the active phone review list.

Tapping `Enrich` reruns the Scriptable script with the selected capture ID, sends this payload to `enrich-capture`, and reloads the list:

```json
{
  "capture_id": "selected-capture-id"
}
```

On success, the page shows an `Enriched` notice above the refreshed active list.

Tapping `Archive` reruns the Scriptable script with the selected capture ID, sends this payload to `archive-capture`, and reloads the list:

```json
{
  "capture_id": "selected-capture-id"
}
```

On success, the page shows an `Archived` notice and the capture no longer appears in the active list.

## Reset Key Manually

If the prototype key changes, create a temporary Scriptable script with:

```js
Keychain.remove("OOS2_PROTOTYPE_KEY")
```

Run it once, then run `OOS2 Review Captures` again. It will prompt for the new key.

## Expected Test Path

1. Capture something from iPhone using the existing Shortcut.
2. Open Scriptable.
3. Run `OOS2 Review Captures`.
4. Confirm the latest capture appears.
5. Tap `Enrich` on the capture.
6. Confirm the page reloads with an `Enriched` notice.
7. Confirm the capture now shows `Enriched` and its details include a Barry note and recommended action.
8. Tap `Archive` on the capture.
9. Confirm the page reloads with an `Archived` notice.
10. Confirm the archived capture no longer appears in the active list.
