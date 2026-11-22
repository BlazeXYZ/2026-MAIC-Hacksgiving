// Run with `npm test` (node --test; Node >= 23.6 strips TypeScript types natively).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MILWAUKEE_CENTER, MILWAUKEE_DEFAULT_ZOOM } from '../src/map/defaultView.ts';

describe('default map view', () => {
  it('opens on downtown Milwaukee at street zoom', () => {
    const [latitude, longitude] = MILWAUKEE_CENTER;
    assert.ok(latitude > 42.9 && latitude < 43.2, `latitude ${latitude} is outside Milwaukee`);
    assert.ok(longitude < -87.8 && longitude > -88.1, `longitude ${longitude} is outside Milwaukee`);
    assert.equal(MILWAUKEE_DEFAULT_ZOOM, 14);
  });
});
