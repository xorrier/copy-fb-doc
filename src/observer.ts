// Watches for DOM changes (SPA navigation) and triggers re-injection

// All IDs we inject — mutations from these nodes are ignored so we don't
// create a feedback loop where our own DOM writes trigger re-injection.
const OWN_IDS = [
  "copy-fbd-collection-filter-wrapper",
  "copy-fbd-collection-filter",
  "copy-fbd-filtered-list",
  "copy-firestore-doc-btn",
];

function isOwnMutation(mutations: MutationRecord[]): boolean {
  for (const m of mutations) {
    for (const node of [...m.addedNodes, ...m.removedNodes]) {
      if (node instanceof HTMLElement) {
        if (OWN_IDS.includes(node.id)) return true;
        if (OWN_IDS.some((id) => node.querySelector?.(`#${id}`))) return true;
      }
    }
    // Also ignore attribute/characterData changes inside our own nodes
    if (
      m.target instanceof HTMLElement &&
      OWN_IDS.some(
        (id) =>
          m.target === document.getElementById(id) ||
          (document.getElementById(id)?.contains(m.target) ?? false),
      )
    ) {
      return true;
    }
  }
  return false;
}

export function observeDOM(callback: () => void): void {
  // Initial attempt
  callback();

  // Re-run on DOM changes (Firebase Console is a SPA), but skip our own mutations
  const observer = new MutationObserver((mutations) => {
    if (isOwnMutation(mutations)) return;
    callback();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also re-check on URL changes (History API navigation)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback();
    }
  }, 1000);
}