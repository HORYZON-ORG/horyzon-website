import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { frankData } from '@/data/frank-data';
import {
  FrankBreadcrumb,
  FrankSubnav,
  FrankHero,
  FrankProfile,
  FrankMethod,
  FrankApproach,
  FrankRadar,
  FrankCapabilities,
  FrankExperience,
  FrankContact,
  FrankDisclaimer,
} from './frank-components';
import './frank.css';

export const metadata: Metadata = {
  title: {
    absolute: 'Frank Cannoletta | Imprenditore e Strategista — Horyzon',
  },
  description:
    'Frank Cannoletta affianca imprenditori, manager e professionisti nelle decisioni che coinvolgono persona, impresa e patrimonio, collegando analisi, priorità e azione.',
  alternates: {
    canonical: '/frank',
  },
  openGraph: {
    title: 'Frank Cannoletta | Imprenditore e Strategista — Horyzon',
    description:
      'Frank Cannoletta affianca imprenditori, manager e professionisti nelle decisioni che coinvolgono persona, impresa e patrimonio, collegando analisi, priorità e azione.',
    url: 'https://horyzon.it/frank',
    siteName: 'Horyzon Consulting',
    locale: 'it_IT',
    type: 'profile',
    images: [
      {
        url: frankData.person.image,
        width: 700,
        height: 850,
        alt: frankData.person.imageAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frank Cannoletta | Imprenditore e Strategista — Horyzon',
    description:
      'Frank Cannoletta affianca imprenditori, manager e professionisti nelle decisioni che coinvolgono persona, impresa e patrimonio.',
    images: [frankData.person.image],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: frankData.person.name,
  alternateName: 'Francesco Cannoletta',
  jobTitle: frankData.person.role,
  description:
    'Consulente strategico per la persona, l’azienda e il patrimonio. Unisce la gestione della mente, la struttura dell’azienda e la protezione del capitale.',
  image: `https://horyzon.it${frankData.person.image}`,
  affiliation: {
    '@type': 'Organization',
    name: 'Horyzon Consulting',
    url: 'https://horyzon.it',
  },
  email: frankData.person.email,
  telephone: frankData.person.phone,
  sameAs: [frankData.person.instagramUrl],
};

export default function FrankPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main id="content" className="inside editorial-page frank-page" data-page="frank">
        <FrankBreadcrumb />
        <FrankSubnav />
        <FrankHero />
        <FrankProfile />
        <FrankMethod />
        <FrankApproach />
        <FrankRadar />
        <FrankCapabilities />
        <FrankExperience />
        <FrankContact />
        <FrankDisclaimer />
      </main>
      <SiteFooter />
    </>
  );
}
