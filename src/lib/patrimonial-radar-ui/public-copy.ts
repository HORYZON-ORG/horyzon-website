// Canonical wording stays in catalog.ts; the public wording lives in editorial-copy.ts.
import { resolveAnswers, value } from '../patrimonial-radar/answers.ts';
import type { AssessmentInput, QuestionId } from '../patrimonial-radar/types.ts';
import { editorialQuestion } from './editorial-copy.ts';
/** Presentation only: original IDs/options/units/periods/validation stay canonical. */
export const publicTitles: Partial<Record<QuestionId,string>> = {
  'RP-S03':'Da dove arrivano le entrate del bilancio scelto?',
  'RP-S04':'Quante altre persone dipendono in modo importante dalle risorse di questo bilancio?',
  'RP-A03':'Negli ultimi 12 mesi, come sono state coperte le uscite di questo bilancio?',
  'RP-C04':'Oggi, quanto è dovuto in rate in un mese ordinario?',
  'RP-E01':'Quali beni e risorse fanno parte oggi del patrimonio del bilancio scelto?',
  'RP-X06':'Che cosa vorresti realizzare con queste risorse? Indica fino a tre obiettivi, nell’ordine che conta per te.',
};
const purposes: Partial<Record<QuestionId,string>> = {
  'RP-A01':'Serve a capire le risorse disponibili, senza chiederti documenti.',
  'RP-A02':'Serve a distinguere le spese dalle rate e dal risparmio.',
  'RP-A05':'Serve a capire se un cambiamento nella stessa fonte può incidere molto sulle entrate.',
  'RP-B01':'Serve a mettere in relazione gli imprevisti con le necessità di oggi.',
  'RP-B02':'Serve a distinguere ciò che puoi usare presto da beni che richiedono tempo o una vendita incerta.',
  'RP-B03':'Serve a non considerare libere somme già impegnate.',
  'RP-C01':'Serve a includere gli impegni nel quadro generale. Avere debiti non è un giudizio sulla persona.',
  'RP-C02':'Serve a leggere le rate insieme alle entrate dello stesso periodo.',
  'RP-C03':'Serve a riconoscere situazioni da approfondire, senza attribuire colpe.',
  'RP-C04':'Serve a capire gli impegni mensili attuali.',
  'RP-D01':'Serve a individuare ciò che è importante proteggere, senza entrare in dettagli personali.',
  'RP-E01':'Bastano categorie generali: niente indirizzi, nomi di prodotti o documenti.',
  'RP-E02':'Serve a capire se molte risorse dipendono dalla stessa esposizione.',
  'RP-E03':'Serve a distinguere il patrimonio dalle somme utilizzabili in breve tempo.',
  'RP-F04':'Non è un esame: serve a capire quali spiegazioni potrebbero essere utili.',
  'RP-F05':'È solo un esempio per riflettere insieme, senza un voto sulla tua competenza.',
  'RP-X01':'Serve a capire quanto possono variare le entrate.',
  'RP-X04':'Questo dettaglio è facoltativo. Fasce e stime sono sufficienti; non occorrono cifre esatte.',
  'RP-X05':'Serve a distinguere il debito residuo dalle rate future.',
  'RP-X06':'I tuoi progetti guidano questa lettura; non servono importi esatti.',
  'RP-X07':'È un esercizio facoltativo, senza voto e senza giudizi sulla persona.',
  'RP-X09':'Serve a comprendere priorità e vincoli, senza impegnarti a investire.',
};
export function publicQuestion(id:QuestionId,input:AssessmentInput) {
  const copy=editorialQuestion(id,value<string[]>(resolveAnswers(input),'RP-S03')??null);
  return {text:copy.text,purpose:copy.purpose,help:[purposes[id]&&!copy.purpose?purposes[id]:undefined,copy.help,'Se il dato ti manca, puoi scegliere “Non so” oppure “Preferisco non rispondere”.'].filter(Boolean).join(' ')};
}
