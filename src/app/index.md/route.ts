import { publicGuideMarkdown } from '@/content/public-guide';

export const dynamic = 'force-static';
export function GET() {
 return new Response(publicGuideMarkdown(), {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' },
 });
}
