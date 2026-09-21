import type {MetadataRoute} from 'next';
import archive from '@/data/archive.json';
import {people} from '@/data/people';
import {pages} from '@/data/pages';

// No invented lastmod; exclude campaigns, legal placeholders and redirects.
const excluded = new Set(['radar', 'privacy-policy', 'cookie-policy', 'conoscenza', 'indice-horyzon']);
export default function sitemap(): MetadataRoute.Sitemap {
 const routes = new Set(['', ...Object.keys(archive), ...Object.keys(pages), ...Object.keys(people), 'le-tre-aree', 'metodo', 'persone', 'biblioteca', 'misura', 'radar-impresa', 'piattaforma']);
 return [...routes].filter(route => !excluded.has(route) && !route.startsWith('v/'))
  .map(route => ({ url: route ? `https://horyzon.it/${route}` : 'https://horyzon.it' }));
}
