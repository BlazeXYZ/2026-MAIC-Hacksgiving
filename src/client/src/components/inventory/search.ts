import type { CatalogItem } from '../../contracts/inventory';

/**
 * Typo-tolerant search for the "pick from the list" box. It only helps someone find a chip to tap, so a
 * wrong guess costs nothing: the person still chooses the item themselves.
 */

/** Lowercase, drop punctuation, and strip a plural "s" so "formulas" finds "formula". */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** Edit distance with adjacent swaps counted as one edit ("frmoula" is one slip away from "formula"). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * How many slips to forgive when matching a typed word to a known word. Short typed words must be exact,
 * or "bin" would find "pin". Longer ones may drop or swap a letter or two, in proportion to the known word.
 */
function allowedSlips(typed: string, known: string): number {
  if (typed.length <= 3) return 0;
  return Math.max(1, Math.min(3, Math.round(known.length * 0.28)));
}

/**
 * Score one typed word against one known word: 1 for a prefix (the person is still typing),
 * 0.5 to 0.9 for a typo, 0 for no match.
 */
function wordScore(typed: string, known: string, slips: number = allowedSlips(typed, known)): number {
  if (known.startsWith(typed)) return 1;
  if (slips === 0) return 0;
  // A prefix can also hide a typo, so compare against the same-length start of the known word as well.
  const best = Math.min(editDistance(typed, known), editDistance(typed, known.slice(0, typed.length)));
  return best <= slips ? 0.9 - 0.15 * Math.max(0, best - 1) : 0;
}

/**
 * Score one typed query against one wording: the average of its words, or 0 if any word has no match.
 * A very short word ("bn") may have one slip, but only when another word in the query matched firmly,
 * so a lone "bin" still never finds "pin".
 */
function wordingScore(typed: string[], known: string[]): number {
  const scores = typed.map((word) => Math.max(0, ...known.map((k) => wordScore(word, k))));
  const firm = scores.some((s) => s >= 0.9);
  const relaxed = scores.map((score, i) => {
    if (score > 0 || !firm || typed[i].length < 2) return score;
    return Math.max(0, ...known.map((k) => (wordScore(typed[i], k, 1) > 0 ? 0.6 : 0)));
  });
  return relaxed.includes(0) ? 0 : relaxed.reduce((sum, s) => sum + s, 0) / relaxed.length;
}

export interface Found {
  item: CatalogItem;
  /** True when it matched only by forgiving a typo, so the screen can say "Did you mean". */
  approximate: boolean;
}

/** The catalog items that match what was typed, best first. An empty query returns everything, unchanged. */
export function searchCatalog(catalog: CatalogItem[], query: string): Found[] {
  const typed = words(query);
  if (typed.length === 0) return catalog.map((item) => ({ item, approximate: false }));
  const found: Array<Found & { score: number }> = [];
  for (const item of catalog) {
    const wordings = [item.name, ...item.aliases].map(words);
    const score = Math.max(...wordings.map((known) => wordingScore(typed, known)));
    if (score > 0) found.push({ item, score, approximate: score < 1 });
  }
  // When something matches exactly (or is being typed), near-misses are only clutter. Offer them only if nothing else matches.
  const exact = found.filter((f) => !f.approximate);
  const kept = exact.length > 0 ? exact : found;
  return kept.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map(({ item, approximate }) => ({ item, approximate }));
}
