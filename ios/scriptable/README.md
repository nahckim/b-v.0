# OOS2 Scriptable Review

This is an iPhone review + one-tap enrich surface for the OOS2 minimal slice. It calls `list-captures`, displays the latest captures with Barry notes, and can call `enrich-capture` for a selected capture.

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

The script does not display the key. It uses the key for listing captures and for one-tap enrichment.

## What It Shows

The script opens a full-screen review page with the latest five captures from:

```text
https://sxvvyjwvecbqimmqieuv.functions.supabase.co/list-captures?limit=5
```

Each capture shows:

- raw content
- source device and source channel
- processed status
- Barry note
- recommended action
- creation time
- Enrich action

Tapping `Enrich` reruns the Scriptable script with the selected capture ID, sends this payload to `enrich-capture`, and reloads the list:

```json
{
  "capture_id": "selected-capture-id"
}
```

On success, the page shows an `Enriched` notice above the refreshed list.

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
7. Confirm the capture now shows `Processed`, a Barry note, and a recommended action.
