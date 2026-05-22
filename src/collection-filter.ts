// Injects a live-filter search box above the Firestore collection list panel.

const FILTER_INPUT_ID = "copy-fbd-collection-filter";
const FILTER_WRAPPER_ID = "copy-fbd-collection-filter-wrapper";
const FILTERED_LIST_ID = "copy-fbd-filtered-list";

const seenCollections = new Set<string>();

let cdkObserver: MutationObserver | null = null;
let currentPanel: HTMLElement | null = null;
let isScanning = false;

let lastDatabaseUrl = "";

function getDatabaseUrl(): string {
  const match = location.href.match(/^(.*\/databases\/[^/]+)/);

  return match
    ? match[1]
    : location.origin + location.pathname.split("/data/")[0];
}

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

  const dbUrl = getDatabaseUrl();

  if (currentPanel && (currentPanel !== panel || dbUrl !== lastDatabaseUrl)) {
    removeCollectionFilter();
  }

  collectVisibleCollections(panel);

  if (document.getElementById(FILTER_WRAPPER_ID)) {
    return;
  }

  const scrollContainer = panel.querySelector<HTMLElement>(
    ".cdk-virtual-scrollable",
  );

  if (!scrollContainer) return;

  currentPanel = panel;
  lastDatabaseUrl = dbUrl;

  startCDKObserver(panel);

  const panelBg = window.getComputedStyle(panel).backgroundColor;

  const bg =
    panelBg && panelBg !== "rgba(0, 0, 0, 0)" && panelBg !== "transparent"
      ? panelBg
      : "#1f1f1f";

  // --- Input wrapper (sticky, sits above the scrollable) ---
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
  });

  input.addEventListener("input", () => {
    if (isScanning) return;

    applyFilter(input.value.trim().toLowerCase(), panel, bg);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applyFilter("", panel, bg);
    }
  });

  wrapper.appendChild(input);

  scrollContainer.parentElement!.insertBefore(wrapper, scrollContainer);

  // --- Filtered results overlay — anchored to the panel, NOT inside the scrollable ---
  // This ensures it doesn't scroll away and always covers the list below the input.
  ensureFilteredListContainer(panel, scrollContainer, bg);

  console.log("[Copy Firestore Doc] Collection filter injected.");

  if (seenCollections.size === 0) {
    setTimeout(() => {
      scanAndCacheCollections(scrollContainer, input);
    }, 100);
  }
}

/**
 * Creates (once) the overlay div that shows filtered results.
 * It is positioned relative to the panel so it sits over the scrollable area
 * and doesn't scroll away.
 */
function ensureFilteredListContainer(
  panel: HTMLElement,
  scrollContainer: HTMLElement,
  bg: string,
): void {
  if (document.getElementById(FILTERED_LIST_ID)) return;

  // Make the panel a positioning context if it isn't already.
  const panelPos = getComputedStyle(panel).position;
  if (panelPos === "static") {
    panel.style.position = "relative";
  }

  const filteredList = document.createElement("div");

  filteredList.id = FILTERED_LIST_ID;

  // Calculate top offset so it sits right below the wrapper + scrollContainer top.
  // We use offsetTop of scrollContainer as the reference.
  Object.assign(filteredList.style, {
    display: "none", // hidden until a search is active
    position: "absolute",
    left: "0",
    right: "0",
    // Will be updated dynamically in applyFilter once wrapper height is known.
    top: "0",
    bottom: "0",
    overflowY: "auto",
    zIndex: "9",
    backgroundColor: bg,
  });

  panel.appendChild(filteredList);
}

async function scanAndCacheCollections(
  viewport: HTMLElement,
  input: HTMLInputElement,
): Promise<void> {
  if (isScanning) return;

  isScanning = true;

  const originalPlaceholder = input.placeholder;
  input.placeholder = "Scanning collections...";

  const originalScrollTop = viewport.scrollTop;

  try {
    const step = Math.max(200, viewport.clientHeight - 50);

    let currentScroll = 0;

    collectVisibleCollections(currentPanel!);

    while (currentScroll < viewport.scrollHeight) {
      viewport.scrollTop = currentScroll;

      await new Promise((resolve) => setTimeout(resolve, 15));

      collectVisibleCollections(currentPanel!);

      currentScroll += step;
    }
  } catch (err) {
    console.error(err);
  } finally {
    viewport.scrollTop = originalScrollTop;

    input.placeholder = originalPlaceholder;

    isScanning = false;

    console.log(
      `[Copy Firestore Doc] Cached ${seenCollections.size} collections.`,
    );
  }
}

function collectVisibleCollections(panel: HTMLElement): void {
  panel
    .querySelectorAll<HTMLElement>("f7e-panel-list-item .item-label-button")
    .forEach((btn) => {
      const name = btn.textContent?.trim();

      if (name) {
        seenCollections.add(name);
      }
    });
}

function startCDKObserver(panel: HTMLElement): void {
  if (cdkObserver) return;

  const contentWrapper = panel.querySelector<HTMLElement>(
    ".cdk-virtual-scroll-content-wrapper",
  );

  if (!contentWrapper) return;

  cdkObserver = new MutationObserver(() => {
    collectVisibleCollections(panel);
  });

  cdkObserver.observe(contentWrapper, {
    childList: true,
    subtree: false,
  });
}

function applyFilter(query: string, panel: HTMLElement, bg: string): void {
  const filteredList = document.getElementById(FILTERED_LIST_ID) as HTMLElement | null;

  if (!filteredList) return;

  if (!query) {
    // Hide overlay — restore normal view
    filteredList.style.display = "none";
    filteredList.innerHTML = "";
    return;
  }

  // Position the overlay to start right below the filter wrapper
  const wrapper = document.getElementById(FILTER_WRAPPER_ID);
  if (wrapper) {
    const wrapperBottom = wrapper.offsetTop + wrapper.offsetHeight;
    filteredList.style.top = `${wrapperBottom}px`;
  }

  filteredList.style.display = "block";
  filteredList.innerHTML = "";

  const matches = Array.from(seenCollections)
    .filter((name) => name.toLowerCase().includes(query))
    .sort();

  if (matches.length === 0) {
    const empty = document.createElement("div");

    Object.assign(empty.style, {
      padding: "16px",
      fontSize: "13px",
      color: "rgba(128,128,128,0.5)",
    });

    empty.textContent = `No collections matching "${query}"`;

    filteredList.appendChild(empty);

    return;
  }

  matches.forEach((name) => {
    const row = document.createElement("div");

    Object.assign(row.style, {
      height: "32px",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      boxSizing: "border-box",
      cursor: "pointer",
      fontSize: "13px",
      userSelect: "none",
      borderBottom: "1px solid rgba(128,128,128,0.08)",
    });

    row.textContent = name;

    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(255,255,255,0.06)";
    });

    row.addEventListener("mouseleave", () => {
      row.style.background = "transparent";
    });

    row.addEventListener("click", async () => {
      await selectCollection(name, panel);
    });

    filteredList!.appendChild(row);
  });
}

async function selectCollection(
  name: string,
  panel: HTMLElement,
): Promise<void> {
  // 1. Clear the filter input and hide the overlay
  const input = document.getElementById(FILTER_INPUT_ID) as HTMLInputElement;

  if (input) {
    input.value = "";
  }

  const filteredList = document.getElementById(FILTERED_LIST_ID) as HTMLElement | null;
  if (filteredList) {
    filteredList.style.display = "none";
    filteredList.innerHTML = "";
  }

  // 2. First, try clicking a row that's already in the visible DOM
  //    (fast path — works if the collection is currently rendered by the virtual scroller)
  if (clickVisibleCollection(name, panel)) return;

  // 3. Slow path — scroll the virtual list until the row appears, then click it.
  const scrollable = panel.querySelector<HTMLElement>(".cdk-virtual-scrollable");

  if (!scrollable) return;

  await scrollUntilVisible(name, panel, scrollable);
}

/** Clicks the collection row if it is currently in the DOM. Returns true on success. */
function clickVisibleCollection(name: string, panel: HTMLElement): boolean {
  const items = panel.querySelectorAll<HTMLElement>("f7e-panel-list-item");

  for (const item of items) {
    const btn = item.querySelector<HTMLElement>(".item-label-button");

    if (btn?.textContent?.trim() === name) {
      btn.click();
      return true;
    }
  }

  return false;
}

/**
 * Scrolls through the virtual list in steps, checking after each step whether
 * the target collection row has been rendered. When found, clicks it.
 */
async function scrollUntilVisible(
  name: string,
  panel: HTMLElement,
  scrollable: HTMLElement,
): Promise<void> {
  // Estimate scroll position using sorted index (best-effort).
  const sorted = Array.from(seenCollections).sort();
  const index = sorted.indexOf(name);

  const ITEM_HEIGHT = 32;

  if (index !== -1) {
    // Jump close to the expected position first.
    scrollable.scrollTop = Math.max(0, index * ITEM_HEIGHT - scrollable.clientHeight / 2);
    await new Promise((r) => setTimeout(r, 80));

    if (clickVisibleCollection(name, panel)) return;
  }

  // Full sweep: scan from top to bottom until found.
  const step = Math.max(150, scrollable.clientHeight - 50);
  let pos = 0;

  while (pos <= scrollable.scrollHeight) {
    scrollable.scrollTop = pos;

    await new Promise((r) => setTimeout(r, 40));

    if (clickVisibleCollection(name, panel)) return;

    pos += step;
  }

  // Last attempt after reaching the bottom.
  clickVisibleCollection(name, panel);
}

export function removeCollectionFilter(): void {
  document.getElementById(FILTER_WRAPPER_ID)?.remove();

  const filteredList = document.getElementById(FILTERED_LIST_ID);
  if (filteredList) {
    filteredList.style.display = "none";
    filteredList.remove();
  }

  cdkObserver?.disconnect();

  cdkObserver = null;

  currentPanel = null;

  seenCollections.clear();

  isScanning = false;

  lastDatabaseUrl = "";
}
