// HighLevel calendar for the Benessere Digitale intro call. Only a calendar id is configurable:
// the widget origin is fixed so a wrong value can never embed another site in the Radar.
export const DIGITAL_BOOKING_ORIGIN='https://api.leadconnectorhq.com';

export function digitalBookingUrl(env:Record<string,string|undefined>=process.env):string|null{
 const id=env.DIGITAL_BOOKING_CALENDAR_ID?.trim();
 return id&&/^[A-Za-z0-9]{10,40}$/.test(id)?`${DIGITAL_BOOKING_ORIGIN}/widget/booking/${id}`:null;
}
