export const patrimonialInterests = {
  'evento-patrimoniale': { label: 'Informazioni sull’evento patrimoniale', title: 'Ricevi informazioni sull’evento.', intro: 'Lascia un contatto per conoscere data, programma e modalità quando saranno definiti. Questa richiesta non è una prenotazione.', subject: 'Informazioni evento patrimoniale Horyzon' },
  'percorso-consulenti': { label: 'Architetti Patrimoniali Horyzon', title: 'Conosci il percorso degli Architetti Patrimoniali.', intro: 'Raccontaci la tua esperienza e chiedi un primo confronto sulla rete Horyzon. La richiesta non comporta ingresso automatico o promessa di incarichi.', subject: 'Architetti Patrimoniali Horyzon' },
} as const;
export type PatrimonialInterest = keyof typeof patrimonialInterests;
export function patrimonialInterest(value: unknown): PatrimonialInterest | undefined {
  return typeof value === 'string' && Object.hasOwn(patrimonialInterests, value) ? value as PatrimonialInterest : undefined;
}
export const patrimonialContact = (interest: PatrimonialInterest) => `/contatti?interesse=${interest}#richiesta-patrimoniale`;
export const PATRIMONIAL_PRIVACY_VERSION = 'patrimoniale-privacy-v1';
