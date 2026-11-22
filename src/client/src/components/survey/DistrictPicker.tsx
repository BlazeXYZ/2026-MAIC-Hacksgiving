import { useEffect, useId, useRef, useState } from 'react';
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
  const pickerId = useId();
  const locateRequest = useRef(0);

  useEffect(() => () => { locateRequest.current += 1; }, []);

  function useLocation() {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setLocate({ kind: 'failed', reason: 'unsupported' });
      return;
    }
    setLocate({ kind: 'busy' });
    const request = ++locateRequest.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (request !== locateRequest.current) return;
        const d = nearestDistrict([pos.coords.latitude, pos.coords.longitude]);
        update({ district: d.id });
        setLocate({ kind: 'found', name: d.name });
      },
      () => {
        if (request === locateRequest.current) setLocate({ kind: 'failed', reason: 'denied' });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function pick(id: DistrictId) {
    locateRequest.current += 1;
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
      <p className="kicker" id={pickerId}>
        {t('district.or')}
      </p>
      <div className="pick" role="radiogroup" aria-labelledby={pickerId}>
        {DISTRICTS.map((d) => (
          <label key={d.id}>
            <span>
              <b>{d.name}</b>
              <small>{d.hint}</small>
            </span>
            <input type="radio" name={pickerId} checked={survey.district === d.id} onChange={() => pick(d.id)} />
          </label>
        ))}
      </div>
    </div>
  );
}
