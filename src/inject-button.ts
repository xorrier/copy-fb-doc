// Injects the "Copy JSON" button into the Firestore breadcrumb bar

const BUTTON_ID = "copy-firestore-doc-btn";

export function injectButton(onCopy: () => void): void {
  // Avoid duplicates
  if (document.getElementById(BUTTON_ID)) return;

  // Only inject if we're on a Firestore document page (has "Add field" visible)
  if (!isDocumentPageVisible()) return;

  // Target the breadcrumb bar's inner .crumbs container
  const crumbsContainer = document.querySelector("fire-breadcrumbs .crumbs");
  if (!crumbsContainer) return;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "📋 Copy JSON";
  btn.title = "Copy this Firestore document as JSON";
  Object.assign(btn.style, {
    marginLeft: "auto",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    border: "none",
    borderRadius: "4px",
    background: "#1a73e8",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    transition: "background 0.2s",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#1557b0";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#1a73e8";
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onCopy();
  });

  // Ensure the crumbs container is flex so margin-left:auto pushes button right
  (crumbsContainer as HTMLElement).style.display = "flex";
  (crumbsContainer as HTMLElement).style.alignItems = "center";

  crumbsContainer.appendChild(btn);
  console.log("[Copy Firestore Doc] Button injected.");
}

/**
 * Checks if we're viewing a Firestore document (the "Add field" button is visible).
 */
function isDocumentPageVisible(): boolean {
  const bodyText = document.body.innerText;
  return (
    bodyText.includes("Add field") && bodyText.includes("Start collection")
  );
}

/**
 * Removes the button (used before re-injection on navigation).
 */
export function removeButton(): void {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) existing.remove();
}
