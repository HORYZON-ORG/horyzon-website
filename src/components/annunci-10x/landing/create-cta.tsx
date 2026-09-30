'use client';

import type { ReactNode } from 'react';

// The landing is server-rendered; the create-from-zero flow lives in Annunci10xClient. This link asks the
// client to open it (and scroll to it) through a window event. #crea-annuncio also works as a deep link.
export const ANNUNCI10X_CREATE_EVENT = 'annunci10x:create';

export function CreateCta({ className, position, children }: { className: string; position: string; children: ReactNode }) {
  return <a
    className={className}
    href="#crea-annuncio"
    data-analytics-event="annunci10x_lp_cta_click"
    data-cta-position={position}
    onClick={(event) => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent(ANNUNCI10X_CREATE_EVENT));
    }}
  >{children}</a>;
}
