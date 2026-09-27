import { Annunci10xClient } from '@/components/annunci-10x/annunci-10x-client';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';

const title = 'Annunci 10x — Il tuo annuncio attira i candidati giusti? Scoprilo gratis';
const description = 'Incolla il tuo annuncio di lavoro e scopri in 2 minuti se sta attirando le persone giuste. Score gratuito su 100, report via email.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/annunci-10x` },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/annunci-10x`,
    siteName: 'Horyzon Consulting',
    locale: 'it_IT',
    type: 'website',
  },
};

export default function Annunci10xPage() {
  return <Annunci10xClient />;
}
