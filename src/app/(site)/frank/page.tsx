import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
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

const description = 'Frank Cannoletta affianca imprenditori, manager e professionisti nelle decisioni che coinvolgono persona, impresa e patrimonio, collegando analisi, priorità e azione.';
export const metadata: Metadata = pageMetadata({path:'/frank',title:'Frank Cannoletta | Imprenditore e Strategista — Horyzon',description,image:frankData.person.image,profile:true});

export default function FrankPage() {
  return (
    <>
      <PageStructuredData path="/frank" name="Frank Cannoletta" description={description} type="ProfilePage" breadcrumbs={[{name:'Horyzon',path:'/'},{name:'Persone',path:'/persone'},{name:'Frank Cannoletta',path:'/frank'}]} person={{...frankData.person,intro:description,alternateName:'Francesco Cannoletta',sameAs:[frankData.person.instagramUrl]}} />
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
