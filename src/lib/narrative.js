// Helpers for the 3-box GM narrative fields (key_wins, previous_results, next_priorities).
// Boxes are stored as a JSON array of 3 strings so each box stays fully independent
// of its siblings' content (pasted numbered lists, decimals, multi-line text, etc.).
// Legacy data stored as "1. ...\n2. ...\n3. ..." text is still parsed for back-compat.

export const NARRATIVE_BOX_COUNT = 3;

function emptyBoxes() {
  return ['', '', ''];
}

// Parse a stored narrative field into an array of 3 trimmed strings.
export function parseBoxes(text) {
  const result = emptyBoxes();
  if (!text) return result;

  // New format: JSON array
  if (text.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        for (let i = 0; i < NARRATIVE_BOX_COUNT; i++) {
          result[i] = arr[i] != null ? String(arr[i]).trim() : '';
        }
        return result;
      }
    } catch {
      // fall through to legacy parsing
    }
  }

  // Legacy: split on numbered prefixes that start a line (back-compat with old data)
  const parts = text
    .split(/(?:^|\n)\s*\d+[.)]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < NARRATIVE_BOX_COUNT && i < parts.length; i++) {
    result[i] = parts[i];
  }
  return result;
}

// Serialize an array of 3 box strings into the stored JSON format.
export function formatBoxes(arr) {
  const boxes = (arr || [])
    .slice(0, NARRATIVE_BOX_COUNT)
    .map((b) => (b == null ? '' : String(b).trim()));
  while (boxes.length < NARRATIVE_BOX_COUNT) boxes.push('');
  return JSON.stringify(boxes);
}

// Render a stored narrative field as readable text for raw-display consumers
// (HotelDetail notes, PDF exports). New JSON format is expanded into "1. ...\n2. ..."
// so exports stay human-readable; legacy text is returned unchanged.
export function boxesToText(text) {
  if (!text) return '';
  if (text.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        return arr
          .map((b, i) => (b && String(b).trim()) ? `${i + 1}. ${String(b).trim()}` : '')
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      // fall through
    }
  }
  return text;
}