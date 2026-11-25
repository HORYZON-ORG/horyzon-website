'use client';
import { useEffect, useState } from 'react';
import { advertisingConsent, initializeRecruitingMeta, RECRUITING_META_CONSENT_EVENT } from '@/lib/recruiting-meta';

export function RecruitingMetaPixel({ pixelId }: { pixelId: string }) {
  const [status, setStatus] = useState('disabled');
  useEffect(() => {
    if (!pixelId) return;
    const tracker = initializeRecruitingMeta(pixelId, setStatus);
    const refresh = () => {
      const api = window._iub?.cs?.api;
      try {
        tracker.setConsent(api?.isPreferenceExpressed?.() === true
          ? advertisingConsent(api.getPreferences?.()) : window.horyzonAdvertisingConsent === true);
      } catch { tracker.setConsent(false); }
    };
    const changed = (event: Event) => tracker.setConsent((event as CustomEvent).detail === true);
    window.addEventListener(RECRUITING_META_CONSENT_EVENT, changed);
    refresh();
    return () => window.removeEventListener(RECRUITING_META_CONSENT_EVENT, changed);
  }, [pixelId]);
  return <span hidden data-recruiting-meta-status={status} />;
}
