// Content script — injected into Firebase Console pages
import { injectButton } from "./inject-button";
import { observeDOM } from "./observer";
import { parseFirestoreDocument } from "./parser";

console.log("[Copy Firestore Doc] Extension loaded on Firebase Console.");

function handleCopy(): void {
  const doc = parseFirestoreDocument();

  if (!doc || Object.keys(doc).length === 0) {
    console.warn(
      "[Copy Firestore Doc] No fields parsed. Check console for details.",
    );
    alert(
      "Could not parse document fields. Check DevTools console for debug info.",
    );
    return;
  }

  const json = JSON.stringify(doc, null, 2);
  console.log("[Copy Firestore Doc] Parsed document:", json);

  // Copy to clipboard
  navigator.clipboard
    .writeText(json)
    .then(() => {
      console.log("[Copy Firestore Doc] Copied to clipboard!");
      showCopiedFeedback();
    })
    .catch((err) => {
      console.error("[Copy Firestore Doc] Clipboard write failed:", err);
      // Fallback: show the JSON in a prompt so user can manually copy
      prompt("Copy this JSON:", json);
    });
}

function showCopiedFeedback(): void {
  const btn = document.getElementById("copy-firestore-doc-btn");
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "✅ Copied!";
  setTimeout(() => {
    btn.textContent = original;
  }, 2000);
}

// Debounce injection to avoid excessive calls from MutationObserver
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function tryInject(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    injectButton(handleCopy);
  }, 500);
}

observeDOM(tryInject);
