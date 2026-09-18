'use client';

import { scrollToPageTop } from './scroll-to-page-top';

export function BackToTopButton() {
 return <button className="back-to-top-control" type="button" aria-label="Torna in alto" title="Torna in alto" onClick={() => scrollToPageTop(window.matchMedia('(prefers-reduced-motion: reduce)').matches)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>;
}
