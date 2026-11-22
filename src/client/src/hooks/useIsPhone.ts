import { useEffect, useState } from 'react';

/** Width at or below which the app switches to the phone shell (top bar + tab bar). */
export const PHONE_QUERY = '(max-width: 640px)';

function matches(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches;
}

/** True when the viewport is phone-sized; updates live on resize / device emulation. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(matches);

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setIsPhone(event.matches);
    setIsPhone(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
