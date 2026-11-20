import { useState } from 'react';
import { Icon } from '../Icon';
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

/** Neighborhood chips, as on the mockup's "Where are you, roughly?" screen. The picked one shows a check. */
export function DistrictChips({ onPick }: { onPick?: (id: DistrictId) => void }) {
  const { survey, update, t } = useSurvey();
  return (
    <div className="chips" role="radiogroup" aria-label={t('district.or')}>
      {DISTRICTS.map((d) => {
        const on = survey.district === d.id;
        return (
          <button
            key={d.id}
            type="button"
            className="chip"
            role="radio"
            aria-checked={on}
            title={d.hint}
            onClick={() => {
              update({ district: d.id });
              onPick?.(d.id);
            }}
          >
            {on && <Icon name="check" />}
            {d.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Neighborhood picker (#4): "Use my location" plus the chips. Coordinates are turned into a
 * neighborhood on this device; only the neighborhood name goes into the request.
 */
export function DistrictPicker() {
  const { update, t } = useSurvey();
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

  return (
    <>
      <button type="button" className="locbtn" onClick={useLocation} disabled={locate.kind === 'busy'}>
        <Icon name="nav" />
        <span>
          {locate.kind === 'busy' ? t('district.locating') : locate.kind === 'found' ? t('district.found', { name: locate.name }) : t('district.locate')}
        </span>
      </button>
      {locate.kind === 'failed' && (
        <p className="field-error" role="alert" style={{ marginTop: 8 }}>
          {t(locate.reason === 'denied' ? 'district.denied' : 'district.unsupported')}
        </p>
      )}
      <p className="or">{t('district.or')}</p>
      <DistrictChips onPick={() => setLocate({ kind: 'idle' })} />
    </>
  );
}
