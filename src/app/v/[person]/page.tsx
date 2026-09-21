import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {people} from '@/data/people';
import {SiteHeader,SiteFooter} from '@/components/site-shell';
import {ShareCard} from '@/components/person-card';
export function generateStaticParams(){return Object.keys(people).map(person=>({person}))}
export async function generateMetadata({params}:{params:Promise<{person:string}>}):Promise<Metadata>{const {person}=await params;const p=people[person];return pageMetadata({path:`/v/${person}`,title:p?.name||'Contatto',description:p?.intro||'Biglietto digitale Horyzon',noindex:true})}
export default async function Card({params}:{params:Promise<{person:string}>}){const {person}=await params;const p=people[person];if(!p)notFound();return <><PageStructuredData path={`/v/${person}`} name={p.name} description={p.intro}/><SiteHeader/><main id="content" className="vcard-page"><article className="vcard"><div className="vcard-top"><p className="eyebrow">Horyzon Consulting</p><h1>{p.name}</h1><p>{p.role}</p></div><div className="vcard-body"><a download={`${p.name}.vcf`} className="button primary" href={`/v/${person}/contact.vcf`}>Salva in rubrica ↓</a>{p.phone&&<><a className="button ghost-dark" href={`tel:${p.phone}`}>Chiama · {p.phone}</a><a className="button ghost-dark" href={`https://wa.me/${p.phone.replace('+','')}`}>WhatsApp ↗</a></>}{p.email&&<a className="button ghost-dark" href={`mailto:${p.email}`}>Scrivi un’email ↗</a>}<Link className="button ghost-dark" href={`/${person}`}>Scopri il mio profilo ↗</Link><ShareCard/></div></article></main><SiteFooter/></>}
