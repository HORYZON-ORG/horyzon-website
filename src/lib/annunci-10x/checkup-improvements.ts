import type { Annunci10xScoreReport } from './score-report-email.ts';
import { interpretAnnunci10xScoreBand } from './score-report-email.ts';
import { getScoreBandV2 } from './score-v2.ts';

export const CHECKUP_SCORE_METHOD = 'mean-evaluable-checks-v1' as const;
export const CHECKUP_SCORE_EXPLANATION = 'Il voto è la media dei criteri valutabili della stessa griglia di 20 controlli, senza tetti aggiuntivi. N/D è escluso dalla media e resta visibile nella copertura.';

export interface CheckupImprovement {
  checkId: string;
  title: string;
  currentScore: number;
  currentGap: string;
  toAdd: string;
  why: string;
  questions: string[];
  draft: string;
}
export interface CheckupImprovementPlan {
  summary: string;
  priorities: CheckupImprovement[];
  nextStep: string;
}
export interface CheckupRewriteSelection {
  kind: 'REWRITE' | 'ORIGINAL';
  evaluatedRewriteScore: number | null;
  explanation: string;
}

export function selectCheckupRecommendation(originalText: string, rewrittenText: string, before: Annunci10xScoreReport, evaluatedRewrite: Annunci10xScoreReport, quality?: { status: string }) {
  const unverified = quality?.status === 'ORIGINAL_RETAINED';
  const keepOriginal = unverified || evaluatedRewrite.score === null || (before.score !== null && evaluatedRewrite.score < before.score - 1e-8);
  const format = (n: number | null) => n === null ? 'N/D' : `${(n / 10).toLocaleString('it-IT', { maximumFractionDigits: 1 })}/10`;
  const selection: CheckupRewriteSelection = {
    kind: keepOriginal ? 'ORIGINAL' : 'REWRITE',
    evaluatedRewriteScore: unverified ? null : evaluatedRewrite.score,
    explanation: unverified ? 'La verifica non ha confermato una riscrittura che conservi tutte le informazioni. Manteniamo l’originale e indichiamo le integrazioni utili: il PDF resta completo e gratuito.' : keepOriginal
      ? `La riscrittura valutata ha ottenuto ${format(evaluatedRewrite.score)}, rispetto a ${format(before.score)} dell’originale. Manteniamo l’originale come testo consigliato. Per fare un salto concreto, integra le informazioni indicate nelle priorità.`
      : 'Il testo consigliato è la riscrittura, valutata con gli stessi 20 criteri. Le priorità indicano quali informazioni confermare per migliorarlo ancora.',
  };
  return { text: keepOriginal ? originalText : rewrittenText, report: keepOriginal ? before : evaluatedRewrite, selection };
}

/** A presentation score for the check-up; persisted legacy evaluations remain immutable. */
export function meanCheckupReport(report: Annunci10xScoreReport): Annunci10xScoreReport {
  const checks = report.checks.filter(c => c.score !== null);
  const score = checks.length ? checks.reduce((sum, c) => sum + c.score!, 0) / checks.length * 10 : null;
  const band = getScoreBandV2(score);
  return { ...report, score, band: band?.label ?? null, interpretation: interpretAnnunci10xScoreBand(band?.code ?? null) };
}

type Action = Pick<CheckupImprovement, 'toAdd' | 'why' | 'questions' | 'draft'>;
const actions: Record<string, Action> = {
  '10': {
    toAdd: 'Separa i requisiti indispensabili da quelli preferenziali e da ciò che può essere appreso dopo l’ingresso. Usa soltanto le categorie che esistono davvero.',
    why: 'Chi legge deve capire se può candidarsi anche senza possedere ogni competenza. Le priorità devono essere decise dall’azienda.',
    questions: ['Quali requisiti devono esserci dal primo giorno?', 'Quali sono preferenziali e quali possono essere appresi con l’inserimento realmente previsto?'],
    draft: 'Indispensabili: [requisiti confermati]. Preferenziali: [se presenti]. Apprendibili durante l’inserimento: [solo se previsto].',
  },
  '14': {
    toAdd: 'Precisa l’importo o la fascia retributiva effettiva, indicando lordo o netto, periodo di riferimento ed eventuale parte variabile.',
    why: 'Una proposta economica comprensibile aiuta la persona a valutare la compatibilità prima di candidarsi.',
    questions: ['Qual è la fascia realmente disponibile per questa figura?', 'L’importo è lordo o netto, mensile o annuo? Da cosa dipende l’eventuale variabile?'],
    draft: 'Retribuzione: [importo o fascia confermata] [lordi/netti] [al mese/all’anno]. Eventuale variabile: [condizioni confermate].',
  },
  '04': {
    toAdd: 'Spiega come si riconosce un lavoro ben fatto: risultato osservabile, criterio di verifica ed eventuale periodo già definito.',
    why: 'Il candidato può collegare le attività a un contributo concreto, oltre all’elenco delle mansioni.',
    questions: ['Quale risultato deve produrre la persona?', 'Con quale criterio realistico e in quale periodo, se definito, viene verificato?'],
    draft: 'Il risultato atteso è [risultato concreto], verificato attraverso [criterio concordato] nel periodo [se definito].',
  },
  '02': {
    toAdd: 'Definisci il perimetro del ruolo: a chi risponde, quali decisioni prende da solo e quando coinvolge un responsabile.',
    why: 'Responsabilità e autonomia rendono riconoscibile il livello reale della posizione.',
    questions: ['A chi risponde la figura e quali attività le competono?', 'Che cosa gestisce in autonomia e quando chiede supporto?'],
    draft: 'Risponderai a [ruolo del referente]. Gestirai in autonomia [ambito confermato]; coinvolgerai [referente] per [casi previsti].',
  },
  '13': {
    toAdd: 'Completa tipo e durata del contratto, ore previste, distribuzione dell’orario, turni ed eventuali altri tempi rilevanti.',
    why: 'La persona deve poter confrontare il lavoro con la propria disponibilità concreta.',
    questions: ['Quali contratto, durata e monte ore sono effettivamente previsti?', 'Come sono distribuiti orario e turni? Sono previste altre disponibilità?'],
    draft: 'Contratto: [tipo e durata]. Orario: [ore e distribuzione]. Turni o altre disponibilità: [solo quanto previsto].',
  },
  '12': {
    toAdd: 'Indica la sede effettiva e precisa presenza, lavoro da remoto o modalità ibrida, con la distribuzione già stabilita.',
    why: 'Luogo e modalità sono informazioni decisive per valutare la compatibilità della proposta.',
    questions: ['Dove si svolge il lavoro?', 'Quale presenza è richiesta e quale eventuale lavoro da remoto è realmente previsto?'],
    draft: 'Sede: [luogo confermato]. Modalità: [presenza/remoto/ibrida e condizioni effettive].',
  },
  '05': {
    toAdd: 'Descrivi il contesto operativo: interlocutori, dimensione del gruppo, strumenti e ambiente pertinenti al ruolo.',
    why: 'Chi legge riesce a immaginare con chi e in quale situazione lavorerà.',
    questions: ['Con quali persone o funzioni collaborerà?', 'Quali strumenti e caratteristiche dell’ambiente incidono sul lavoro?'],
    draft: 'Lavorerai con [interlocutori confermati], utilizzando [strumenti effettivi] nel contesto [caratteristiche rilevanti].',
  },
  '07': {
    toAdd: 'Racconta una situazione di lavoro tipica e una difficoltà ricorrente che la persona dovrà affrontare.',
    why: 'La descrizione rende visibili ritmo e sfide reali e aiuta una candidatura consapevole.',
    questions: ['Come si svolge una giornata o una settimana tipica?', 'Quali imprevisti o priorità ricorrono davvero?'],
    draft: 'Di norma ti occuperai di [routine reale]. Quando si verifica [situazione ricorrente], dovrai [azione effettivamente richiesta].',
  },
  '08': {
    toAdd: 'Rendi esplicite le condizioni impegnative che incidono sulla compatibilità: picchi, spostamenti, disponibilità o altri vincoli realmente presenti.',
    why: 'Le condizioni chiare permettono alla persona di valutare la proposta prima di entrare nella selezione.',
    questions: ['Quali condizioni concrete è utile conoscere prima di candidarsi?', 'Con quale frequenza e in quali situazioni si presentano?'],
    draft: 'Il ruolo prevede [condizione confermata] con [frequenza o modalità effettiva].',
  },
  '15': {
    toAdd: 'Aggiungi una o due ragioni concrete per scegliere questa offerta, sostenute da ciò che l’azienda offre già: inserimento, strumenti, organizzazione o condizioni.',
    why: 'I fatti verificabili rendono distinguibile la proposta e spiegano il valore per chi si candida.',
    questions: ['Che cosa riceverà realmente la persona e come?', 'Quale elemento concreto distingue questa posizione da offerte simili?'],
    draft: 'Per questa posizione è previsto [elemento effettivo], con [modalità concreta di erogazione o utilizzo].',
  },
  '11': {
    toAdd: 'Collega i requisiti importanti alle attività per cui servono e chiarisci il livello realmente necessario.',
    why: 'Il candidato comprende il motivo di ogni richiesta e può confrontarla con la propria esperienza.',
    questions: ['Per quale attività serve ciascun requisito importante?', 'Quale livello è sufficiente per svolgerla?'],
    draft: 'Serve [competenza] per [attività concreta], con un livello di [livello confermato].',
  },
  '20': {
    toAdd: 'Precisa come candidarsi, quali materiali inviare e gli eventuali passaggi di selezione già stabiliti.',
    why: 'Un’azione finale semplice riduce l’incertezza su come procedere.',
    questions: ['Dove si invia la candidatura e quali materiali servono?', 'Quali passaggi successivi sono già confermati?'],
    draft: 'Per candidarti [azione e canale effettivi]. Invia [materiali richiesti]. Passaggi successivi: [solo quelli confermati].',
  },
};
const order = ['10', '14', '04', '02', '13', '12', '05', '07', '08', '15', '11', '20'];
const unusableDestination = (c: Annunci10xScoreReport['checks'][number]) => c.checkId === '20' && /segnaposto/i.test(c.reason);

export function buildCheckupImprovementPlan(before: Annunci10xScoreReport, after: Annunci10xScoreReport): CheckupImprovementPlan {
  const priorities = after.checks
    .filter(c => c.score !== null && c.score < 10 && c.status !== 'NOT_EVALUABLE' && actions[c.checkId])
    .sort((a, b) => Number(unusableDestination(b)) - Number(unusableDestination(a)) || a.score! - b.score! || order.indexOf(a.checkId) - order.indexOf(b.checkId))
    .slice(0, 3)
    .map(c => ({ checkId: c.checkId, title: c.label, currentScore: c.score!, currentGap: c.reason, ...actions[c.checkId] }));
  const strongBase = (before.score ?? 0) >= 80;
  const summary = priorities.length
    ? `${strongBase ? 'Il testo parte già da una base buona. ' : ''}Il testo consigliato usa le informazioni disponibili. Per un salto più sostanziale, completa questi punti con dati confermati dall’azienda.`
    : after.score === null
      ? 'La copertura non consente di scegliere priorità affidabili. Verifica ruolo, attività e condizioni prima di una nuova valutazione.'
      : 'Non emergono integrazioni fattuali prioritarie dalla griglia. Verifica che le informazioni restino complete, precise e coerenti quando aggiorni il testo.';
  return { summary, priorities, nextStep: 'Conferma i dati, integrali nell’annuncio e richiedi una nuova valutazione con gli stessi 20 criteri. Il nuovo voto dipende dai contenuti aggiunti: non è un aumento preassegnato.' };
}
