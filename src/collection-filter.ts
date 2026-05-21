// Injects a live-filter search box above the Firestore collection list panel.
// Uses a custom overlay list to avoid conflicts with CDK Virtual Scroll DOM recycling.

const FILTER_INPUT_ID = "copy-fbd-collection-filter";
const FILTER_WRAPPER_ID = "copy-fbd-collection-filter-wrapper";
const FILTERED_LIST_ID = "copy-fbd-filtered-list";

// Progressive cache of all collection names seen in the DOM
const seenCollections = new Set<string>();
let cdkObserver: MutationObserver | null = null;
let currentPanel: HTMLElement | null = null;
let isScanning = false;
let lastInjectedUrl = "";

/**
 * Entry point — call this on every DOM mutation.
 */
export function injectCollectionFilter(): void {
  const panel = document.querySelector<HTMLElement>(
    'f7e-collection-list-fields-panel[data-test-id="f7e-collection-list-fields-panel"]',
  );
  if (!panel) {
    if (currentPanel) {
      removeCollectionFilter();
    }
    return;
  }

  // Clear cache if we switched panel elements or changed database/URL
  if (currentPanel && (currentPanel !== panel || location.href !== lastInjectedUrl)) {
    removeCollectionFilter();
  }

  // Always collect newly-rendered items from CDK virtual scroll
  collectVisibleCollections(panel);

  // Only inject UI once
  if (document.getElementById(FILTER_WRAPPER_ID)) return;

  const scrollContainer = panel.querySelector<HTMLElement>(
    ".cdk-virtual-scrollable",
  );
  if (!scrollContainer) return;

  currentPanel = panel;

  // Start watching CDK virtual scroll mutations to capture every rendered item
  startCDKObserver(panel);

  // Detect computed background for seamless blending
  const panelBg = window.getComputedStyle(panel).backgroundColor;
  const bg =
    panelBg && panelBg !== "rgba(0, 0, 0, 0)" && panelBg !== "transparent"
      ? panelBg
      : "#1f1f1f";

  // --- Wrapper ---
  const wrapper = document.createElement("div");
  wrapper.id = FILTER_WRAPPER_ID;
  Object.assign(wrapper.style, {
    padding: "8px 12px",
    boxSizing: "border-box",
    width: "100%",
    position: "sticky",
    top: "0",
    zIndex: "10",
    backgroundColor: bg,
    borderBottom: "1px solid rgba(128,128,128,0.15)",
  });

  // --- Input ---
  const input = document.createElement("input");
  input.id = FILTER_INPUT_ID;
  input.type = "text";
  input.placeholder = "Filter collections…";
  input.autocomplete = "off";
  input.spellcheck = false;
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 12px",
    fontSize: "13px",
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: "20px",
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    outline: "none",
    transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
  });

  input.addEventListener("focus", () => {
    input.style.borderColor = "#1a73e8";
    input.style.backgroundColor = "rgba(128,128,128,0.04)";
    input.style.boxShadow = "0 0 0 2px rgba(26,115,232,0.2)";
  });
  input.addEventListener("blur", () => {
    input.style.borderColor = "rgba(128,128,128,0.3)";
    input.style.backgroundColor = "rgba(128,128,128,0.08)";
    input.style.boxShadow = "none";
  });
  input.addEventListener("input", () => {
    if (isScanning) return;
    applyFilter(input.value.trim().toLowerCase(), panel, bg);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applyFilter("", panel, bg);
      input.blur();
    }
  });

  wrapper.appendChild(input);
  scrollContainer.parentElement!.insertBefore(wrapper, scrollContainer);
  console.log("[Copy Firestore Doc] Collection filter injected.");

  // Save current URL to detect navigation
  lastInjectedUrl = location.href;

  // Trigger silent scan to pre-cache all collections
  setTimeout(() => {
    scanAndCacheCollections(scrollContainer, input);
  }, 100);
}

/**
 * Silently and quickly scrolls the viewport to the bottom and back to pre-cache all collection names.
 */
async function scanAndCacheCollections(
  viewport: HTMLElement,
  input: HTMLInputElement,
): Promise<void> {
  if (isScanning) return;
  isScanning = true;

  const originalPlaceholder = input.placeholder;
  input.placeholder = "Scanning collections...";

  const originalScrollTop = viewport.scrollTop;
  const originalScrollBehavior = viewport.style.scrollBehavior;
  const originalVisibility = viewport.style.visibility;

  viewport.style.scrollBehavior = "auto";
  viewport.style.visibility = "hidden";

  try {
    const step = Math.max(200, viewport.clientHeight - 50);
    let currentScroll = 0;

    // Run first collection pass
    collectVisibleCollections(currentPanel!);

    if (viewport.scrollHeight > viewport.clientHeight) {
      while (currentScroll < viewport.scrollHeight) {
        if (!currentPanel || !viewport.isConnected) break;
        viewport.scrollTop = currentScroll;
        // Small delay to allow CDK virtual scroll to render new items
        await new Promise((resolve) => setTimeout(resolve, 15));
        currentScroll += step;
      }
    }
  } catch (err) {
    console.error("[Copy Firestore Doc] Error scanning collections:", err);
  } finally {
    // Restore original state
    viewport.scrollTop = originalScrollTop;
    viewport.style.scrollBehavior = originalScrollBehavior;
    viewport.style.visibility = originalVisibility;
    input.placeholder = originalPlaceholder;
    isScanning = false;
  }
}

/**
 * Scrapes labels from currently-rendered f7e-panel-list-item elements into the cache.
 */
function collectVisibleCollections(panel: HTMLElement): void {
  panel
    .querySelectorAll<HTMLElement>("f7e-panel-list-item .item-label-button")
    .forEach((btn) => {
      const name = btn.textContent?.trim();
      if (name) seenCollections.add(name);
    });
}

/**
 * Watches the CDK virtual scroll content wrapper for new items being rendered.
 * Each time CDK recycles/adds items, we harvest their labels into the cache.
 */
function startCDKObserver(panel: HTMLElement): void {
  if (cdkObserver) return; // already watching

  const contentWrapper = panel.querySelector<HTMLElement>(
    ".cdk-virtual-scroll-content-wrapper",
  );
  if (!contentWrapper) return;

  cdkObserver = new MutationObserver(() => {
    collectVisibleCollections(panel);
  });

  cdkObserver.observe(contentWrapper, { childList: true, subtree: false });
}

/**
 * Gets the name of the currently active/selected collection from the URL.
 */
function getActiveCollectionName(): string | null {
  const parts = location.href.split("/data/");
  if (parts.length > 1) {
    const subParts = parts[1].split("/");
    if (subParts.length > 0) {
      return decodeURIComponent(subParts[0]);
    }
  }
  return null;
}

/**
 * Searches the DOM for a non-selected f7e-panel-list-item to act as a normal row template.
 */
function getTemplateItem(panel: HTMLElement): HTMLElement | null {
  const activeName = getActiveCollectionName();
  const items = panel.querySelectorAll<HTMLElement>("f7e-panel-list-item");
  for (const item of items) {
    const btn = item.querySelector(".item-label-button");
    const name = btn?.textContent?.trim();
    if (name && name !== activeName) {
      return item;
    }
  }
  return items[0] || null;
}

/**
 * Searches the DOM for the active f7e-panel-list-item to act as the selected row template.
 */
function getActiveItemTemplate(panel: HTMLElement): HTMLElement | null {
  const activeName = getActiveCollectionName();
  if (!activeName) return null;
  const items = panel.querySelectorAll<HTMLElement>("f7e-panel-list-item");
  for (const item of items) {
    const btn = item.querySelector(".item-label-button");
    const name = btn?.textContent?.trim();
    if (name === activeName) {
      return item;
    }
  }
  return null;
}

/**
 * Applies the filter: shows a custom overlay list (hides CDK viewport)
 * or restores the original viewport when query is empty.
 */
function applyFilter(query: string, panel: HTMLElement, bg: string): void {
  const viewport = panel.querySelector<HTMLElement>(
    "cdk-virtual-scroll-viewport",
  );

  if (!query) {
    // Restore original CDK viewport
    if (viewport) viewport.style.display = "";
    const existing = document.getElementById(FILTERED_LIST_ID);
    if (existing) existing.remove();
    return;
  }

  // Calculate height before hiding the viewport (otherwise clientHeight is 0)
  const viewportHeight = viewport ? viewport.clientHeight : 0;

  // Hide CDK viewport to prevent DOM recycling conflicts
  if (viewport) viewport.style.display = "none";

  // Re-use or create the overlay list
  let filteredList = document.getElementById(FILTERED_LIST_ID);
  if (!filteredList) {
    filteredList = document.createElement("div");
    filteredList.id = FILTERED_LIST_ID;
    if (viewport) {
      filteredList.className = viewport.className;
    }
    Object.assign(filteredList.style, {
      overflowY: "auto",
      height: viewportHeight ? `${viewportHeight}px` : "100%",
      maxHeight: "calc(100vh - 200px)",
      flex: "1 1 auto",
    });
    viewport?.parentElement?.appendChild(filteredList);
  } else {
    // Update height dynamically in case window was resized
    if (viewportHeight) {
      filteredList.style.height = `${viewportHeight}px`;
    }
  }

  filteredList.innerHTML = "";

  const matches = Array.from(seenCollections)
    .filter((name) => name.toLowerCase().includes(query))
    .sort();

  if (matches.length === 0) {
    const empty = document.createElement("div");
    Object.assign(empty.style, {
      padding: "16px 14px",
      fontSize: "13px",
      color: "rgba(128,128,128,0.5)",
      userSelect: "none",
    });
    empty.textContent = `No collections matching "${query}"`;
    filteredList.appendChild(empty);
    return;
  }

  const normalTemplate = getTemplateItem(panel);
  const activeTemplate = getActiveItemTemplate(panel);
  const activeName = getActiveCollectionName();

  matches.forEach((name) => {
    const isActive = (name === activeName);
    let clone: HTMLElement | null = null;

    if (isActive && activeTemplate) {
      clone = activeTemplate.cloneNode(true) as HTMLElement;
    } else if (normalTemplate) {
      clone = normalTemplate.cloneNode(true) as HTMLElement;
    }

    if (!clone) {
      // Fallback row if no templates found
      const fallbackRow = document.createElement("div");
      Object.assign(fallbackRow.style, {
        height: "32px",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        boxSizing: "border-box",
        cursor: "pointer",
        fontSize: "13px",
        userSelect: "none",
        transition: "background-color 0.12s",
      });
      fallbackRow.textContent = name;
      fallbackRow.addEventListener("click", () => {
        selectCollection(name, panel, viewport ?? null);
      });
      filteredList!.appendChild(fallbackRow);
      return;
    }

    // Reset CDK inline positioning styling
    clone.style.position = "relative";
    clone.style.top = "";
    clone.style.left = "";
    clone.style.transform = "";
    clone.removeAttribute("id");

    const labelBtn = clone.querySelector(".item-label-button");
    if (labelBtn) {
      labelBtn.textContent = name;
    }

    clone.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const isMenuClick = !!target.closest(".menu-button, [data-test-id*='menu'], .mat-icon, button:not(.item-label-button)");
      selectCollection(name, panel, viewport ?? null, isMenuClick);
    });

    filteredList!.appendChild(clone);
  });
}

/**
 * Selects a collection by:
 * 1. Clearing the filter and restoring the CDK viewport
 * 2. Scrolling CDK to the approximate position of the item
 * 3. Polling until the item appears in the DOM, then clicking it (or its menu)
 */
function selectCollection(
  name: string,
  panel: HTMLElement,
  viewport: HTMLElement | null,
  clickMenu: boolean = false,
): void {
  // Clear input & restore original list
  const input = document.getElementById(FILTER_INPUT_ID) as HTMLInputElement;
  if (input) input.value = "";

  if (viewport) viewport.style.display = "";
  const filteredList = document.getElementById(FILTERED_LIST_ID);
  if (filteredList) filteredList.remove();

  // Estimate scroll position: sort seen collections alphabetically (same as Firebase)
  const sorted = Array.from(seenCollections).sort();
  const index = sorted.indexOf(name);
  const ITEM_HEIGHT = 32;

  if (viewport && index !== -1) {
    viewport.scrollTop = Math.max(0, (index - 2) * ITEM_HEIGHT);
  }

  // Poll until CDK renders the item, then click it
  let attempts = 0;
  const tryClick = setInterval(() => {
    const row = findCollectionRow(name, panel);
    if (row) {
      clearInterval(tryClick);
      if (clickMenu) {
        const menuBtn = row.querySelector<HTMLElement>(".menu-button, [data-test-id*='menu'], button:not(.item-label-button)");
        if (menuBtn) {
          menuBtn.click();
        } else {
          row.querySelector<HTMLElement>(".item-label-button")?.click() || row.click();
        }
      } else {
        row.querySelector<HTMLElement>(".item-label-button")?.click() || row.click();
      }
    } else if (++attempts > 20) {
      clearInterval(tryClick);
      console.warn("[Copy Firestore Doc] Could not find collection row for:", name);
    } else if (viewport) {
      viewport.scrollTop = Math.max(0, (index - 2) * ITEM_HEIGHT) + attempts;
    }
  }, 50);
}

/**
 * Finds the f7e-panel-list-item for a given collection name in the current DOM.
 */
function findCollectionRow(
  name: string,
  panel: HTMLElement,
): HTMLElement | null {
  const items = panel.querySelectorAll<HTMLElement>("f7e-panel-list-item");
  for (const item of items) {
    const btn = item.querySelector(".item-label-button");
    if (btn?.textContent?.trim() === name) return item;
  }
  return null;
}

/**
 * Removes all injected UI and stops the CDK observer.
 */
export function removeCollectionFilter(): void {
  document.getElementById(FILTER_WRAPPER_ID)?.remove();
  document.getElementById(FILTERED_LIST_ID)?.remove();
  cdkObserver?.disconnect();
  cdkObserver = null;
  currentPanel = null;
  seenCollections.clear();
  isScanning = false;
  lastInjectedUrl = "";
}
