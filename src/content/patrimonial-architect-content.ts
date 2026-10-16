// Architect funnel, revision 16 Oct 2026: the same system as the Event, seen from the side of who serves it.
import { eventAllocation, eventInstruments } from './patrimonial-event-content';

export { eventAllocation as architectAllocation, eventInstruments as architectInstruments };

// The four people the Architect meets: the Event's four awareness profiles.
export const architectClients = [
  { id: 'mese', label: 'CHI RINCORRE IL MESE', img: '/benessere-patrimoniale/evento/profilo-1.jpg', alt: 'Un uomo seduto al tavolino guarda le bollette da pagare',
    pain: 'Lo stipendio arriva e se ne va. Nessuno gli ha mai dato un metodo.',
    tool: 'La regola 70-10-10-10', give: 'Un posto per ogni euro, dal prossimo stipendio.' },
  { id: 'fermi', label: 'CHI HA I SOLDI FERMI', img: '/benessere-patrimoniale/evento/profilo-2.jpg', alt: 'Una donna tiene in mano un barattolo di vetro pieno di risparmi',
    pain: 'In 20 anni, 10.000 € rimasti sul conto comprano quanto 6.897 € di oggi.',
    tool: 'Il confronto fermi / al lavoro', give: 'Gli mostri cosa è successo ai soldi fermi e da dove cominciare.' },
  { id: 'consulente', label: 'CHI SI AFFIDA', img: '/benessere-patrimoniale/evento/profilo-3.jpg', alt: 'Una coppia a colloquio con un consulente',
    pain: 'Firma prodotti che non capisce, perché nessuno glieli ha spiegati.',
    tool: 'Le domande giuste', give: 'Gli insegni cosa chiedere prima di firmare, e perché.' },
  { id: 'costruisce', label: 'CHI COSTRUISCE', img: '/benessere-patrimoniale/evento/profilo-4.jpg', alt: 'Mani che analizzano grafici di mercato al portatile',
    pain: 'Diversifica già, ma guarda solo metà della mappa.',
    tool: 'La mappa 50/50 e il Radar', give: 'Gli mostri l’altra metà e dove il suo patrimonio è scoperto.' },
] as const;

// The Architect's toolkit: what the training puts in your hands.
export const architectTools = [
  { id: 'regola', img: '/benessere-patrimoniale/evento/serata-1.jpg', kicker: 'IL METODO', name: 'Regola 70-10-10-10',
    text: 'Il primo strumento che porti a ogni famiglia: 70% per vivere, 10% di riserva, 10% per i progetti, 10% che cresce.' },
  { id: 'mappa', img: '/benessere-patrimoniale/evento/diversificazione.jpg', kicker: 'LA VISIONE', name: 'Mappa 50/50',
    text: 'Metà in beni reali, metà in beni finanziari. Ogni famiglia di strumenti al suo posto, con il suo perché.' },
  { id: 'radar', img: '/benessere-patrimoniale/evento/radar.jpg', kicker: 'LO STRUMENTO', name: 'Radar Patrimoniale',
    text: 'In un colpo d’occhio mostra al cliente cosa ha e cosa gli manca. In sviluppo: lo usi tra i primi.' },
  { id: 'serate', img: '/benessere-patrimoniale/evento/serata-2.jpg', kicker: 'LE PERSONE', name: 'Le serate Horyzon',
    text: '«Quello che le banche non dicono»: chi partecipa può chiedere 40 minuti di confronto con un Architetto.' },
] as const;

export function architectKnownLine(count: number, total: number) {
  if (count === 0) return 'Tocca le famiglie di strumenti che sapresti già spiegare a un cliente.';
  if (count === total) return `Le conosci tutte e ${total}. Il percorso ti dà il metodo per metterle insieme, su misura per ogni famiglia.`;
  return `Ne sai già spiegare ${count} su ${total}. Le altre ${total - count} te le insegniamo noi, insieme al metodo per metterle insieme.`;
}
