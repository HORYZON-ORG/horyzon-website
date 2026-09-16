import type {MetadataRoute} from 'next';
import archive from '@/data/archive.json';
import {people} from '@/data/people';
export default function sitemap():MetadataRoute.Sitemap{const routes=[...new Set(['',...Object.keys(archive),...Object.keys(people),'le-tre-aree','metodo','persone','biblioteca','misura','radar-impresa','piattaforma'])].filter(x=>!['conoscenza','indice-horyzon'].includes(x));return routes.map(x=>({url:`https://horyzon.it/${x}`,changeFrequency:'monthly',priority:x===''?1:.7}))}
