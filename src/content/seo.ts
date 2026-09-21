import type { Metadata } from 'next';

export const SITE_URL = 'https://horyzon.it';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const HOME_TITLE = 'Horyzon — Diagnosi e organizzazione per l’impresa';
export const HOME_DESCRIPTION = 'Dal Radar d’Impresa all’organizzazione obiettivo: cinque reparti, responsabilità ed evidenze per un’evoluzione misurabile.';
export const absoluteUrl = (path: string) => path === '/' ? SITE_URL : new URL(path, SITE_URL).href;
export const pageLanguage = (path: string) => path.match(/^\/(en|de|fr)(?:\/|$)/)?.[1] ?? 'it';

export function pageMetadata({ path, title, description, noindex = false, image = '/opengraph-image', profile = false }: {
  path: string; title: string; description: string; noindex?: boolean; image?: string; profile?: boolean;
}): Metadata {
  const fullTitle = title.includes('Horyzon') ? title : `${title} — Horyzon`;
  const language = pageLanguage(path);
  return {
    title: { absolute: fullTitle }, description,
    alternates: { canonical: absoluteUrl(path) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: fullTitle, description, url: absoluteUrl(path), siteName: 'Horyzon Consulting', locale: ({ it: 'it_IT', en: 'en_GB', de: 'de_DE', fr: 'fr_FR' } as Record<string, string>)[language], type: profile ? 'profile' : 'website', images: [absoluteUrl(image)] },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [absoluteUrl(image)] },
  };
}

const italianTitles: Record<string, string> = {
  'benessere-organizzativo': 'Benessere organizzativo e sviluppo dell’impresa',
  'benessere-patrimoniale': 'Benessere e visione patrimoniale',
  'benessere-digitale': 'Benessere digitale, AI e processi aziendali',
  horyzon: 'Horyzon Consulting: visione e competenze', umanita: 'Umanità e sviluppo della persona',
  impresa: 'Impresa e sviluppo organizzativo', economia: 'Economia e valore condiviso',
  'entra-in-horyzon': 'Entra nella Partner Network Horyzon', persone: 'Le persone di Horyzon',
  biblioteca: 'Biblioteca e libri', misura: 'Autovalutazione delle tre aree di benessere',
};
export function editorialTitle(path: string, fallback: string) {
  return italianTitles[path] ?? ({ en: 'Horyzon Consulting: business, wealth and technology', de: 'Horyzon Consulting: Unternehmen, Vermögen und Technologie', fr: 'Horyzon Consulting : entreprise, patrimoine et technologie' } as Record<string, string>)[path] ?? fallback;
}
