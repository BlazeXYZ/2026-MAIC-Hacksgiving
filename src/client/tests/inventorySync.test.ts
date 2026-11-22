import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inventoryTextForNeed } from '../src/components/inventory/sync.ts';

describe('inventoryTextForNeed', () => {
  it('maps common help categories to inventory items', () => {
    assert.equal(inventoryTextForNeed('food'), 'Fresh produce');
    assert.equal(inventoryTextForNeed('ride'), 'Transit cards');
    assert.equal(inventoryTextForNeed('warm-lobby'), 'Blankets');
  });

  it('uses a resident description for other requests', () => {
    assert.equal(inventoryTextForNeed('other', '  first-aid supplies  '), 'first-aid supplies');
  });

  it('does not create an item request for categories that are not items', () => {
    assert.equal(inventoryTextForNeed('safe-place'), null);
    assert.equal(inventoryTextForNeed('talk'), null);
  });

  it('limits custom text to the inventory API limit', () => {
    assert.equal(inventoryTextForNeed('other', 'x'.repeat(240))?.length, 200);
  });
});
