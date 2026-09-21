import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
 return {
  rules: [
   // Preserve the existing open policy, including training crawlers. Search and
   // training are separate choices; see the audit for the purpose of each bot.
   { userAgent: '*', allow: '/' },
   { userAgent: ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'], allow: '/' },
   { userAgent: ['ChatGPT-User', 'Claude-User', 'Perplexity-User'], allow: '/' },
  ],
  sitemap: 'https://horyzon.it/sitemap.xml',
 };
}
