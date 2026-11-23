import { eventIcsContent } from '@/lib/public-leads/patrimonial-event-calendar';
export function GET() {
  return new Response(eventIcsContent(), {status:200,headers:{
    'Content-Type':'text/calendar; charset=utf-8',
    'Content-Disposition':'attachment; filename="horyzon-quello-che-le-banche-non-dicono-9-dicembre-2026.ics"',
    'Cache-Control':'public, max-age=3600',
  }});
}
