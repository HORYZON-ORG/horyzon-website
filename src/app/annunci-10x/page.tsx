import { Annunci10xClient } from '@/components/annunci-10x/annunci-10x-client';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';

const title = 'Annunci 10x — Score di chiarezza e annuncio pronto a 7 €';
const description = 'Valuta gratis chiarezza e completezza del tuo annuncio. Poi scegli Annuncio 10x: 7 € per un annuncio, una versione e un canale.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/annunci-10x` },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/annunci-10x`,
    siteName: 'Horyzon Consulting Recruiting',
    locale: 'it_IT',
    type: 'website',
  },
};

export default function Annunci10xPage() {
  return <Annunci10xClient />;
}
