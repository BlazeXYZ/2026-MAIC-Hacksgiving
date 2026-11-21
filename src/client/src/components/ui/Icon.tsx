import type { ReactElement } from 'react';

/* Stroke icons and the ComForce logo mark, copied from the symbol set in
   docs/design/src/common/defs.html so the app matches the mockup exactly. */
const PATHS = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  board: <path d="M8 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3M8 4V2h8v5H8zM8 12h8M8 16h8" />,
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  shield: <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3 8 3z" />,
  food: <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  chev: <path d="m9 18 6-6-6-6" />,
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  alert: <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3M12 9v4M12 17h.01" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-6 11-8 12-2-1-8-7-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  nav: <path d="M3 11 22 2l-9 19-2-8z" />,
  minus: <path d="M5 12h14" />,
  spark: <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'ic' }: { name: IconName; className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export function LogoMark(): ReactElement {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="16" y="1.5" width="20.5" height="20.5" rx="2" transform="rotate(45 16 1.5)" fill="#0F6B3A" />
      <path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#FCFCF9" strokeWidth="3.2" strokeLinecap="square" fill="none" />
    </svg>
  );
}
