import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { DISTRICTS, useSurvey, type District, type DistrictId } from '../../state/survey';

/** Beyond this distance from every known centre we call it "General Milwaukee". */
const NEAR_KM = 2.5;

function km([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function nearestDistrict(at: [number, number]): District {
  let best: District | undefined;
  let bestKm = Infinity;
  for (const d of DISTRICTS) {
    if (!d.center) continue;
    const dist = km(at, d.center);
    if (dist < bestKm) [best, bestKm] = [d, dist];
  }
  return best && bestKm <= NEAR_KM ? best : DISTRICTS[DISTRICTS.length - 1];
}

type LocateState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'found'; name: string } | { kind: 'failed'; reason: 'denied' | 'unsupported' };

/**
 * Neighborhood picker (#4). "Use my location" turns coordinates into a neighborhood on this device;
 * only the neighborhood name goes into the request, never the coordinates.
 */
export function DistrictPicker() {
  const { survey, update, t } = useSurvey();
  const [locate, setLocate] = useState<LocateState>({ kind: 'idle' });

  function useLocation() {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setLocate({ kind: 'failed', reason: 'unsupported' });
      return;
    }
    setLocate({ kind: 'busy' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = nearestDistrict([pos.coords.latitude, pos.coords.longitude]);
        update({ district: d.id });
        setLocate({ kind: 'found', name: d.name });
      },
      () => setLocate({ kind: 'failed', reason: 'denied' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function pick(id: DistrictId) {
    update({ district: id });
    setLocate({ kind: 'idle' });
  }

  return (
    <div className="stack">
      <button type="button" className="btn block" onClick={useLocation} disabled={locate.kind === 'busy'}>
        <LocateFixed aria-hidden="true" />
        {locate.kind === 'busy' ? t('district.locating') : locate.kind === 'found' ? t('district.found', { name: locate.name }) : t('district.locate')}
      </button>
      {locate.kind === 'failed' && (
        <p className="field-error" role="alert">
          {t(locate.reason === 'denied' ? 'district.denied' : 'district.unsupported')}
        </p>
      )}
      <p className="kicker" id="district-or">
        {t('district.or')}
      </p>
      <div className="pick" role="radiogroup" aria-labelledby="district-or">
        {DISTRICTS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={survey.district === d.id}
            onClick={() => pick(d.id)}
          >
            <span>
              <b>{d.name}</b>
              <small>{d.hint}</small>
            </span>
            <span className="radio-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
