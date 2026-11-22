import type { NeedId } from '../../map/helpOptions';

const INVENTORY_TEXT: Partial<Record<NeedId, string>> = {
  food: 'Fresh produce',
  ride: 'Transit cards',
  'warm-lobby': 'Blankets',
};

export function inventoryTextForNeed(needId: NeedId, note = ''): string | null {
  if (needId === 'other') {
    const text = note.trim();
    return text ? text.slice(0, 200) : null;
  }
  return INVENTORY_TEXT[needId] ?? null;
}
