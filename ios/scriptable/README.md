# OOS2 Scriptable Review

This is a read-only iPhone review surface for the OOS2 minimal slice. It calls `list-captures` and displays the latest captures with Barry notes.

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

The script does not display the key and does not write to Supabase.

## What It Shows

The script opens a full-screen read-only review page with the latest five captures from:

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

## Reset Key Manually

If the prototype key changes, create a temporary Scriptable script with:

```js
Keychain.remove("OOS2_PROTOTYPE_KEY")
```

Run it once, then run `OOS2 Review Captures` again. It will prompt for the new key.

## Expected Test Path

1. Capture something from iPhone using the existing Shortcut.
2. Enrich the capture if needed.
3. Open Scriptable.
4. Run `OOS2 Review Captures`.
5. Confirm the latest capture appears with its Barry note and recommended action.
