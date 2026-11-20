import { useRef, useState } from 'react';
import HelpSurvey from '../components/HelpSurvey';
import { Icon, Portrait, type IconName } from '../components/Icon';
import VolunteerTickets from '../components/VolunteerTickets';
import { DeskFoot, PhoneTop, TabBar, type Tab } from '../components/shell/Frame';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { DISTRICTS, useSurvey } from '../state/survey';
import type { StringKey } from '../i18n/strings';

const COMMUNITIES = [
  { id: 'domestic-safety', key: 'hub.domestic', icon: 'shield', color: 'var(--ink)' },
  { id: 'missing-persons', key: 'hub.missing', icon: 'search', color: 'var(--red)' },
  { id: 'food-pantry', key: 'hub.food', icon: 'food', color: 'var(--green)' },
] as const satisfies ReadonlyArray<{ id: string; key: 'hub.domestic' | 'hub.missing' | 'hub.food'; icon: IconName; color: string }>;

const SEARCH_SECTORS = [
  { name: 'A', status: 'active' },
  { name: 'B', status: 'searching' },
  { name: 'C', status: 'cleared' },
  { name: 'D', status: 'pending' },
] as const;

const DISTRICT_CALLS = [
  { name: 'Juneautown / Campus', calls: 5 },
  { name: 'Third Ward', calls: 3 },
  { name: 'Near West Side', calls: 12 },
];

const NEWS: Array<[StringKey, StringKey, StringKey]> = [
  ['news.1.m', 'news.1.t', 'news.1.d'],
  ['news.2.m', 'news.2.t', 'news.2.d'],
  ['news.3.m', 'news.3.t', 'news.3.d'],
  ['news.4.m', 'news.4.t', 'news.4.d'],
];

const BASEMAP_PREVIEW = new URL('../assets/community-basemap.png', import.meta.url).href;

type CommunityId = (typeof COMMUNITIES)[number]['id'];

function greeting(): StringKey {
  const h = new Date().getHours();
  return h < 12 ? 'home.greet.morning' : h < 17 ? 'home.greet.afternoon' : 'home.greet.evening';
}

/**
 * Home, following the mockup's frame 4 (phone) and section 2 (desktop): greeting, the one missing-person
 * alert, "What do you need?" (#2 cards), neighbors who need a hand, news, then the hubs and district
 * overview from the community demo.
 */
export function HomeScreen({ onNav, onAsk }: { onNav: (tab: Tab) => void; onAsk: () => void }) {
  const { survey, t } = useSurvey();
  const [selected, setSelected] = useState<CommunityId>('domestic-safety');
  const [shared, setShared] = useState(false);
  const gridHeading = useRef<HTMLHeadingElement>(null);
  const active = COMMUNITIES.find((c) => c.id === selected) ?? COMMUNITIES[0];
  const area = DISTRICTS.find((d) => d.id === survey.district)?.name ?? 'Milwaukee';
  const today = new Date().toLocaleDateString(survey.language === 'hmn' ? 'en' : survey.language, { weekday: 'short', month: 'short', day: 'numeric' });
  const cleared = SEARCH_SECTORS.filter((s) => s.status === 'cleared').length;

  function openSearchGrid() {
    setSelected('missing-persons');
    requestAnimationFrame(() => {
      gridHeading.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      gridHeading.current?.focus({ preventScroll: true });
    });
  }

  async function share() {
    const text = `${t('alert.name')}: ${t('alert.desc')}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (insecure origin, no permission): show the text so it can be copied by hand,
      // and don't claim it was copied.
      window.prompt(t('alert.share'), text);
      return;
    }
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="view wide">
      <PhoneTop />
      <div className="view-body" style={{ paddingBottom: 32 }}>
        <div className="ph-greet">
          <span className="kicker">
            {today} · {area}
          </span>
          <h1>
            {t(greeting())} <span className="hl">{t('home.neighbor')}</span>.
          </h1>
        </div>

        <div className="ph-pad" style={{ marginTop: 24 }}>
          <article className="alertcard p-alert" aria-label={t('alert.strip')}>
            <div className="alert-strip">
              <span className="live" />
              <span>{t('alert.strip')}</span>
              <span>5:42 PM</span>
            </div>
            <div className="body">
              <Portrait label={t('alert.photo')} />
              <div>
                <h3>{t('alert.name')}</h3>
                <p>{t('alert.desc')}</p>
              </div>
            </div>
            <div className="prog">
              <span className="segs" aria-hidden="true">
                {SEARCH_SECTORS.map((s) => (
                  <i key={s.name} className={s.status === 'cleared' ? 'done' : s.status === 'searching' ? 'on' : undefined} />
                ))}
              </span>
              <span>{t('alert.prog', { n: cleared, total: SEARCH_SECTORS.length })}</span>
            </div>
            <div className="acts">
              <button type="button" className="btn danger" onClick={openSearchGrid}>
                {t('alert.join')}
              </button>
              <button type="button" className="btn" onClick={() => void share()}>
                <span aria-live="polite">{shared ? t('alert.shared') : t('alert.share')}</span>
              </button>
            </div>
          </article>
        </div>

        <div className="homegrid">
          <div className="homecol">
            <section className="ph-sec" aria-labelledby="need-title">
              <div className="ph-h">
                <h2 id="need-title">{t('home.need')}</h2>
              </div>
              <div className="page-pad">
                <HelpSurvey onPick={onAsk} />
                <div className="homesos">
                  <EmergencyBar />
                </div>
              </div>
            </section>

            <section className="ph-sec" aria-labelledby="hand-title">
              <div className="ph-h">
                <h2 id="hand-title">{t('home.hand')}</h2>
                <button type="button" onClick={() => onNav('requests')}>
                  {t('home.hand.go')}
                </button>
              </div>
              <div className="page-pad">
                <VolunteerTickets preview={1} />
              </div>
            </section>

            <section className="ph-sec" aria-labelledby="news-title">
              <div className="ph-h">
                <h2 id="news-title">{t('news.title')}</h2>
                <span className="meta">{t('sample')}</span>
              </div>
              <div className="strip">
                {NEWS.map(([meta, title, body]) => (
                  <div className="card" key={title}>
                    <span className="meta">{t(meta)}</span>
                    <b>{t(title)}</b>
                    <p>{t(body)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="homecol">
            <section className="ph-sec home-mapcard" aria-labelledby="map-title">
              <div className="ph-h">
                <h2 id="map-title">{t('map.title')}</h2>
                <button type="button" onClick={() => onNav('map')}>
                  {t('home.mapcard')}
                </button>
              </div>
              <div className="page-pad">
                <button type="button" className="mapcard mappeek" onClick={() => onNav('map')} aria-label={t('home.mapcard')}>
                  <img src={BASEMAP_PREVIEW} alt="" width={1250} height={710} />
                </button>
              </div>
            </section>

            <section className="ph-sec" aria-labelledby="hubs-title">
              <div className="ph-h">
                <h2 id="hubs-title">{t('home.hubs')}</h2>
              </div>
              <div className="page-pad">
                <div className="rowlist">
                  {COMMUNITIES.map((c) => (
                    <button key={c.id} type="button" aria-pressed={c.id === active.id} onClick={() => setSelected(c.id)}>
                      <span className="sw" style={{ background: c.color }}>
                        <Icon name={c.icon} />
                      </span>
                      <span>
                        <b>{t(c.key)}</b>
                        <small>{t(`${c.key}.tag`)}</small>
                      </span>
                      <Icon name="chev" className="chev" />
                    </button>
                  ))}
                  {active.id === 'missing-persons' ? (
                    <div className="redhead">
                      <span className="meta">{t('hub.missing')}</span>
                      <div className="sp-who">
                        <Portrait width={46} height={56} label={t('alert.photo')} />
                        <div>
                          <b>{t('alert.name')}</b>
                          <p>{t('alert.desc')}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hubband" style={{ backgroundColor: active.color }}>
                      <span className="sw" style={{ background: active.color }}>
                        <Icon name={active.icon} />
                      </span>
                      <b>{t(active.key)}</b>
                    </div>
                  )}
                  <div className={active.id === 'missing-persons' ? 'hubdetail' : 'hubdetail banded'}>
                    <p>{t(`${active.key}.d`)}</p>
                    {active.id === 'domestic-safety' && (
                      <>
                        <h3>{t('hub.route.title')}</h3>
                        <button type="button" className="btn sm" onClick={() => onNav('map')}>
                          {t('hub.route.go')}
                        </button>
                      </>
                    )}
                    {active.id === 'missing-persons' && (
                      <>
                        <h3 ref={gridHeading} tabIndex={-1}>
                          {t('hub.grid.title')}
                        </h3>
                        <ul className="sectors" aria-label={t('hub.grid.label')}>
                          {SEARCH_SECTORS.map(({ name, status }) => (
                            <li key={name} data-status={status}>
                              <strong>{t('hub.sector', { x: name })}</strong>
                              <span>{t(`sector.${status}`)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="sp-legend" aria-hidden="true">
                          <span>
                            <i style={{ background: 'var(--fence-tight)' }} />
                            {t('sector.cleared')}
                          </span>
                          <span>
                            <i style={{ background: 'var(--hivis)' }} />
                            {t('sector.searching')}
                          </span>
                          <span>
                            <i style={{ borderStyle: 'dashed', background: 'var(--sunk)' }} />
                            {t('sector.pending')}
                          </span>
                        </div>
                      </>
                    )}
                    {active.id === 'food-pantry' && (
                      <>
                        <h3>{t('hub.pantry.title')}</h3>
                        <button type="button" className="btn sm" onClick={() => onNav('map')}>
                          {t('hub.pantry.go')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="ph-sec" aria-labelledby="districts-title">
              <div className="ph-h">
                <h2 id="districts-title">{t('home.districts')}</h2>
                <span className="meta">{t('sample')}</span>
              </div>
              <div className="page-pad">
                <div className="card">
                  <table className="dist">
                    <tbody>
                      {DISTRICT_CALLS.map(({ name, calls }) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="n">
                            {calls} {t('home.calls')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>

        <DeskFoot />
      </div>
      <div className="view-foot">
        <TabBar current="home" onNav={onNav} />
      </div>
    </div>
  );
}
