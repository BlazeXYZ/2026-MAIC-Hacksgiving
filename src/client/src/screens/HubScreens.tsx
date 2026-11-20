import { useState } from 'react';
import CommunityMap from '../components/CommunityMap';
import { Icon } from '../components/Icon';
import VolunteerTickets from '../components/VolunteerTickets';
import { DeskFoot, PhoneHead, TabBar, type Tab } from '../components/shell/Frame';
import { useSurvey } from '../state/survey';

/** Map tab: the interactive Leaflet map (#11), laid out like the mockup's frame 7. */
export function MapScreen({ onNav, onBack }: { onNav: (tab: Tab) => void; onBack: () => void }) {
  const { t } = useSurvey();
  return (
    <div className="view wide">
      <PhoneHead meta={t('map.kicker')} title={t('map.title')} onBack={onBack} />
      <div className="view-body" style={{ paddingBottom: 32 }}>
        <CommunityMap />
        <DeskFoot />
      </div>
      <div className="view-foot">
        <TabBar current="map" onNav={onNav} />
      </div>
    </div>
  );
}

/** Requests tab: the volunteer ticket board (#17), as the mockup's frame 10 "Help a neighbor". */
export function RequestsScreen({ onNav }: { onNav: (tab: Tab) => void }) {
  const { t } = useSurvey();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="view wide">
      <PhoneHead meta={open === null ? t('req.kicker') : t('req.open', { n: open })} title={t('req.title')} />
      <div className="view-body" style={{ paddingBottom: 32 }}>
        <div className="ph-pad" style={{ marginBottom: 16 }}>
          <div className="tip">
            <Icon name="lamp" />
            <span>
              <b>{t('req.tip.b')}</b> {t('req.tip')}
            </span>
          </div>
        </div>
        <VolunteerTickets onOpenCount={setOpen} />
        <DeskFoot />
      </div>
      <div className="view-foot">
        <TabBar current="requests" onNav={onNav} />
      </div>
    </div>
  );
}
