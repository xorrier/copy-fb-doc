// Watches for DOM changes (SPA navigation) and triggers re-injection

export function observeDOM(callback: () => void): void {
  // Initial attempt
  callback();

  // Re-run on DOM changes (Firebase Console is a SPA)
  const observer = new MutationObserver(() => {
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
