import type {MetadataRoute} from 'next';
import archive from '@/data/archive.json';
import {people} from '@/data/people';
import {pages} from '@/data/pages';

// Only publish lastmod values backed by a known content change; never stamp every URL on deploy.
const knownLastModified: Record<string, string> = {
 'ai-score': '2026-10-02',
 'ai-score/methodology': '2026-10-02',
};
const excluded = new Set(['radar', 'privacy-policy', 'cookie-policy', 'conoscenza', 'indice-horyzon']);
const pilotRoots = ['benessere-patrimoniale/percorso-architetto-patrimoniale', 'benessere-patrimoniale/evento'];
export default function sitemap(): MetadataRoute.Sitemap {
 const routes = new Set(['', ...Object.keys(archive), ...Object.keys(pages), ...Object.keys(people), 'ai-score', 'ai-score/methodology', 'le-tre-aree', 'metodo', 'persone', 'biblioteca', 'misura', 'radar-impresa']);
 return [...routes].filter(route => !excluded.has(route) && !route.startsWith('v/') && !pilotRoots.some(root => route === root || route.startsWith(`${root}/`)))
  .map(route => ({
   url: route ? `https://horyzon.it/${route}` : 'https://horyzon.it',
   ...(knownLastModified[route] ? { lastModified: knownLastModified[route] } : {}),
  }));
}
