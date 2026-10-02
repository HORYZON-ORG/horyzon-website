import { absoluteUrl, HOME_DESCRIPTION, ORGANIZATION_ID, pageLanguage, SITE_URL, WEBSITE_ID } from '@/content/seo';
import type { PublicFaq } from '@/content/public-faq';
import { people } from '@/data/people';

export function StructuredData({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

function teamPersonNodes() {
  return Object.entries(people).map(([slug, person]) => {
    const url = absoluteUrl(`/${slug}`);
    return {
      '@type': 'Person',
      '@id': `${url}#person`,
      url,
      name: person.name,
      jobTitle: person.role,
      description: person.intro,
      affiliation: { '@id': ORGANIZATION_ID },
      ...(person.image ? { image: absoluteUrl(person.image) } : {}),
      ...(person.email ? { email: person.email } : {}),
      ...(person.phone ? { telephone: person.phone } : {}),
      ...(person.sameAs ? { sameAs: person.sameAs } : {}),
    };
  });
}

export function SiteStructuredData() {
  const team = teamPersonNodes();
  return <StructuredData data={{ '@context': 'https://schema.org', '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Horyzon Consulting',
      alternateName: 'Horyzon',
      legalName: 'FELICITÀ srl',
      url: SITE_URL,
      email: 'info@horyzon.it',
      taxID: '05120660757',
      brand: { '@type': 'Brand', name: 'Horyzon Consulting' },
      address: { '@type': 'PostalAddress', streetAddress: 'Viale Papiniano 28', postalCode: '20123', addressLocality: 'Milano', addressCountry: 'IT' },
      contactPoint: { '@type': 'ContactPoint', contactType: 'informazioni generali', email: 'info@horyzon.it' },
      knowsAbout: ['Benessere organizzativo', 'Benessere patrimoniale', 'Benessere digitale', 'Intelligenza artificiale applicata', 'Processi e automazioni'],
      founder: { '@id': `${absoluteUrl('/angelo')}#person` },
      member: team.map((person) => ({ '@id': person['@id'] })),
    },
    { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE_URL, name: 'Horyzon Consulting', description: HOME_DESCRIPTION, publisher: { '@id': ORGANIZATION_ID } },
    ...team,
  ] }} />;
}

type PublicPerson = { name: string; role: string; intro: string; image?: string; email?: string; phone?: string; sameAs?: string[]; alternateName?: string };
export function PageStructuredData({ path, name, description, type = 'WebPage', breadcrumbs, person, faqs, dateModified }: {
  path: string; name: string; description: string; type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'ProfilePage';
  breadcrumbs?: { name: string; path: string }[]; person?: PublicPerson; faqs?: readonly PublicFaq[]; dateModified?: string;
}) {
  const url = absoluteUrl(path);
  const personId = `${url}#person`;
  return <StructuredData data={{ '@context': 'https://schema.org', '@graph': [
    { '@type': type, '@id': `${url}#webpage`, url, name, description, inLanguage: pageLanguage(path), isPartOf: { '@id': WEBSITE_ID }, publisher: { '@id': ORGANIZATION_ID }, ...(dateModified ? { dateModified } : {}), ...(person ? { mainEntity: { '@id': personId } } : {}), ...(breadcrumbs?.length ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}) },
    ...(breadcrumbs?.length ? [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) }] : []),
    ...(person ? [{ '@type': 'Person', '@id': personId, url, name: person.name, jobTitle: person.role, description: person.intro, affiliation: { '@id': ORGANIZATION_ID }, ...(person.image ? { image: absoluteUrl(person.image) } : {}), ...(person.email ? { email: person.email } : {}), ...(person.phone ? { telephone: person.phone } : {}), ...(person.sameAs ? { sameAs: person.sameAs } : {}), ...(person.alternateName ? { alternateName: person.alternateName } : {}) }] : []),
    ...(faqs?.length ? [{ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faqs.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
  ] }} />;
}
