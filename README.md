# Firestore Copy JSON

A Chrome Extension that adds a **"Copy JSON"** button to the Firebase Firestore Console, letting you copy any open document as formatted JSON with one click.

Supports all Firestore types: strings, numbers, booleans, maps, arrays, timestamps, nulls — including deeply nested structures. String fields containing stringified JSON are automatically parsed.

---

## Install for Team Testing (no Chrome Web Store needed)

### Step 1 — Download the extension

Go to the [Releases page](https://github.com/xorrier/copy-fb-doc/releases/latest) and download **`firestore-copy-json.zip`**.

### Step 2 — Extract the zip

Extract it to a **permanent folder** on your machine (do not delete this folder later — Chrome needs it to stay there).

```
~/extensions/firestore-copy-json/   ← example location
```

### Step 3 — Load in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **"Load unpacked"**
4. Select the folder you extracted in Step 2
5. The extension is now installed ✓

### Step 4 — Use it

1. Go to [Firebase Console](https://console.firebase.google.com/) → Firestore
2. Open any document by clicking on a document ID
3. A blue **"📋 Copy JSON"** button will appear in the breadcrumb bar (top of the page)
4. Click it — the full document JSON is now in your clipboard
5. Paste anywhere with `Cmd+V`

The button shows **"✅ Copied!"** briefly to confirm success.

---

## Updating to a newer version

When a new release is published:

1. Download the new `firestore-copy-json.zip` from the [Releases page](https://github.com/xorrier/copy-fb-doc/releases)
2. Extract and **replace** the contents of your existing folder (same folder Chrome is pointing to)
3. Go to `chrome://extensions/` → find the extension → click the **↺ reload** button

---

## Example output

```json
{
  "category": "UTILITY",
  "channel": "whatsapp",
  "createdAt": "15 May 2026 at 17:30:40 UTC+5:30",
  "editCategory": true,
  "mapping": {
    "body": ["((editableVariable0))", "((editableVariable1))"],
    "buttons": ["((customPlaceholderName))"],
    "header": []
  },
  "status": "ACTIVE",
  "templateId": "JkREVgdCiUE6rr7dqwxO"
}
```

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/xorrier/copy-fb-doc.git
cd firestore-copy-json
npm install
```

### Build

```bash
npm run build         # one-time build → dist/
npm run dev           # watch mode (rebuilds on file changes)
```

Load the `dist/` folder as an unpacked extension (same steps as above).

### Package for release

```bash
npm run build:zip     # generates icons + builds + creates firestore-copy-json.zip
```

### Project structure

```
src/
  content.ts          # entry point — injected into Firebase Console
  inject-button.ts    # injects the Copy JSON button into the breadcrumb bar
  observer.ts         # MutationObserver for SPA navigation detection
  parser.ts           # DOM parser — extracts Firestore fields recursively
public/
  manifest.json       # Chrome Extension manifest (MV3)
  icons/              # generated PNG icons
scripts/
  generate-icons.mjs  # pure Node.js icon generator (no extra deps)
```

---

## How it works

Firebase Console is a single-page Angular app. The extension:

1. Injects a content script on `console.firebase.google.com`
2. Uses a `MutationObserver` to detect when a Firestore document panel appears
3. Injects the button into the `fire-breadcrumbs` bar
4. On click, recursively walks `f7e-data-tree` DOM elements to extract field names, types, and values
5. Casts each value to its correct JS type based on the `type-*` CSS class on each node
6. Serializes to JSON and writes to clipboard

---

## License

MIT
