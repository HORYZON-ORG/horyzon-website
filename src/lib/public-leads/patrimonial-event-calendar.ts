// Official calendar details: 21:00–22:00 Europe/Rome = 20:00–21:00 UTC on 2026-12-09.
export const EVENT_START = '2026-12-09T20:00:00.000Z';
export const EVENT_END = '2026-12-09T21:00:00.000Z';
export const EVENT_TITLE = 'Quello che le banche non dicono · Horyzon';
export const EVENT_PAGE = 'https://horyzon.it/evento/quello-che-le-banche-non-dicono';
export const EVENT_ICS_URL = 'https://horyzon.it/api/patrimonial-event/calendar';
export const EVENT_DESCRIPTION = 'Evento online gratuito di 60 minuti con domande e risposte dal vivo. Le indicazioni di accesso saranno comunicate da Horyzon via email.';
export function eventGoogleCalendarUrl() {
  const query = new URLSearchParams({
    action: 'TEMPLATE', text: EVENT_TITLE, dates: '20261209T200000Z/20261209T210000Z',
    details: EVENT_DESCRIPTION + '\n' + EVENT_PAGE, location: 'Online', ctz: 'Europe/Rome',
  });
  return 'https://calendar.google.com/calendar/render?' + query.toString();
}
export function eventIcsContent() {
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Horyzon Consulting//Eventi//IT',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:quello-che-le-banche-non-dicono-20261209@horyzon.it',
    'DTSTAMP:20261123T000000Z','DTSTART:20261209T200000Z','DTEND:20261209T210000Z',
    'SUMMARY:'+esc(EVENT_TITLE),'DESCRIPTION:'+esc(EVENT_DESCRIPTION+'\n'+EVENT_PAGE),
    'LOCATION:Online','URL:'+EVENT_PAGE,
    'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY',
    'DESCRIPTION:Tra 30 minuti inizia l’evento Horyzon','END:VALARM',
    'END:VEVENT','END:VCALENDAR','',
  ].join('\r\n');
}
