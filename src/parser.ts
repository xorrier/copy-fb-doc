/**
 * Parses the visible Firestore document fields from the DOM.
 *
 * DOM structure (Firebase Console):
 * - Container: f7e-fields-subpanel[data-test-id="f7e-fields-subpanel"]
 * - Each field: .database-node with type class (type-string, type-map, etc.)
 * - Key: span.database-key
 * - Value (leaf): span.database-leaf-value
 * - Type from class: "type-string", "type-boolean", "type-map", "type-array", "type-timestamp"
 * - Children (map/array): .database-children > f7e-data-tree
 */

export function parseFirestoreDocument(): Record<string, unknown> | null {
  // Find the fields subpanel
  const fieldsPanel = document.querySelector(
    'f7e-fields-subpanel[data-test-id="f7e-fields-subpanel"]',
  );
  if (!fieldsPanel) {
    console.warn("[Copy Firestore Doc] Could not find f7e-fields-subpanel.");
    return null;
  }

  // Get top-level f7e-data-tree elements
  const topLevelTrees = fieldsPanel.querySelectorAll(
    "fs-animate-change-classes > f7e-data-tree",
  );

  if (topLevelTrees.length === 0) {
    console.warn("[Copy Firestore Doc] No f7e-data-tree elements found.");
    return null;
  }

  console.log(
    `[Copy Firestore Doc] Found ${topLevelTrees.length} top-level fields.`,
  );
  return parseNodes(Array.from(topLevelTrees) as HTMLElement[]);
}

/**
 * Parses a list of f7e-data-tree elements into a key-value object (map).
 */
function parseNodes(treeElements: HTMLElement[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const tree of treeElements) {
    const node = tree.querySelector(":scope > .database-node");
    if (!node) continue;

    const parsed = parseNode(node as HTMLElement);
    if (parsed) {
      result[parsed.key] = parsed.value;
    }
  }

  return result;
}

/**
 * Parses child f7e-data-tree elements as an array (ordered by numeric index).
 */
function parseArrayChildren(treeElements: HTMLElement[]): unknown[] {
  const items: Array<{ index: number; value: unknown }> = [];

  for (const tree of treeElements) {
    const node = tree.querySelector(":scope > .database-node");
    if (!node) continue;

    const parsed = parseNode(node as HTMLElement);
    if (parsed) {
      const idx = parseInt(parsed.key, 10);
      items.push({
        index: isNaN(idx) ? items.length : idx,
        value: parsed.value,
      });
    }
  }

  items.sort((a, b) => a.index - b.index);
  return items.map((i) => i.value);
}

/**
 * Parses a single .database-node element.
 */
function parseNode(node: HTMLElement): { key: string; value: unknown } | null {
  // Extract key
  const keyEl = node.querySelector(
    ":scope > .database-node-click-target .database-key",
  );
  if (!keyEl) return null;
  const key = keyEl.textContent?.trim() || "";

  // Determine type from the node's class list
  const type = getFieldType(node);

  // Maps and arrays have .database-children with nested f7e-data-tree elements
  if (type === "map" || type === "array") {
    const childrenContainer = node.querySelector(":scope > .database-children");
    if (childrenContainer) {
      const childTrees = childrenContainer.querySelectorAll(
        ":scope > f7e-data-tree",
      );
      if (childTrees.length > 0) {
        if (type === "array") {
          return {
            key,
            value: parseArrayChildren(Array.from(childTrees) as HTMLElement[]),
          };
        } else {
          return {
            key,
            value: parseNodes(Array.from(childTrees) as HTMLElement[]),
          };
        }
      }
    }
    // Empty map or array
    return { key, value: type === "array" ? [] : {} };
  }

  // Leaf value
  const valueEl = node.querySelector(
    ":scope > .database-node-click-target .database-leaf-value",
  );
  const rawValue = valueEl?.textContent?.trim() || "";

  return { key, value: castValue(rawValue, type) };
}

/**
 * Extracts the field type from the .database-node class list.
 * e.g., "database-node type-string" → "string"
 */
function getFieldType(node: HTMLElement): string {
  const classes = node.className;
  const match = classes.match(/type-(\w+)/);
  return match ? match[1] : "string";
}

/**
 * Casts a raw string value to the appropriate JS type.
 */
function castValue(raw: string, type: string): unknown {
  switch (type) {
    case "string":
      // Remove surrounding quotes: "value" → value
      let str = raw;
      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.slice(1, -1);
      }
      // Try to parse stringified JSON (arrays or objects)
      return tryParseJSON(str);

    case "number":
      const num = Number(raw);
      return isNaN(num) ? raw : num;

    case "boolean":
      return raw === "true";

    case "null":
      return null;

    case "timestamp":
      return raw; // Keep as display string

    case "geopoint":
      return raw;

    case "reference":
      return raw;

    default:
      return raw;
  }
}

/**
 * Attempts to parse a string as JSON. Returns the parsed value if it's
 * a valid JSON object or array, otherwise returns the original string.
 */
function tryParseJSON(str: string): unknown {
  // Only attempt parse if it looks like JSON (starts with { or [)
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return str;
    }
  }
  return str;
}
