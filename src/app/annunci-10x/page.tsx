import { Annunci10xClient } from '@/components/annunci-10x/annunci-10x-client';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';

const description = 'Annunci 10x valuta annunci di lavoro esistenti o raccoglie i fatti necessari per crearne uno nuovo, senza inventare informazioni mancanti.';

export const metadata: Metadata = {
  title: { absolute: 'ANNUNCI 10x — Horyzon' },
  description,
  alternates: { canonical: `${SITE_URL}/annunci-10x` },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: 'ANNUNCI 10x — Horyzon',
    description,
    url: `${SITE_URL}/annunci-10x`,
    siteName: 'Horyzon Consulting',
    locale: 'it_IT',
    type: 'website',
  },
};

export default function Annunci10xPage() {
  return <>
    <SiteHeader />
    <main id="content" data-page="annunci-10x">
      <Annunci10xClient />
    </main>
    <SiteFooter />
  </>;
}
