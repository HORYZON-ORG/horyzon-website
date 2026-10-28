import { question } from '../patrimonial-radar/catalog.ts';
import { ordinaryRoute, resolveAnswers, value } from '../patrimonial-radar/answers.ts';
import { recordAnswer } from '../patrimonial-radar/answers.ts';
import type { AnswerState, AssessmentInput, QuestionId, Scope, Period, Goal } from '../patrimonial-radar/types.ts';
export interface Draft { state: AnswerState; value?: unknown }
export const blank = () => ({ state: 'UNANSWERED' as const });
export const field = (value: unknown) => ({ state: 'VALUE' as const, value });
export const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
export const labels: Record<string, string> = {
  INDIVIDUAL: 'Solo la mia situazione', HOUSEHOLD: 'Il nucleo con cui condivido il bilancio', COMPLETE: 'Entrate, spese e quote dello stesso bilancio', PARTIAL: 'Conosco solo una parte del bilancio',
  EMPLOYEE: 'Lavoro dipendente', PROFESSIONAL: 'Professione o lavoro autonomo', BUSINESS: 'Attività di impresa', PENSION: 'Pensione o capitale previdenziale', RENT: 'Rendite o affitti', TRANSFERS: 'Trasferimenti o sostegno regolare',
  NONE: 'Nessuna di queste', '0': 'Nessun’altra persona', '1': 'Una persona', '2': 'Due persone', '3+': 'Tre o più persone',
  COVERED: 'Le entrate sono bastate senza usare il patrimonio', PLANNED_DRAW: 'Abbiamo usato patrimonio secondo un piano', OCCASIONAL_GAP: 'Risparmi o nuovo credito non previsti in alcuni mesi', REPEATED_GAP: 'Risparmi o nuovo credito non previsti nella maggior parte dei mesi',
  REGULAR: 'Regolari', PREDICTABLE_VARIABLE: 'Variabili, ma abbastanza prevedibili', UNPREDICTABLE: 'Variabili e poco prevedibili', NO_INCOME: 'Nessuna entrata', LE50: 'Fino al 50%', GT50_LE80: 'Oltre il 50% e fino all’80%', GT80: 'Oltre l’80% e fino al 100%',
  OWN_AVAILABLE: 'Con somme disponibili, senza intaccare gli impegni', EARMARKED: 'Usando somme già destinate ad altro', SELL_OR_BORROW: 'Vendendo beni o investimenti, oppure chiedendo denaro', CANNOT_PAY: 'Non saprei come pagarla',
  MORTGAGE: 'Mutuo', CONSUMER: 'Credito al consumo', REVOLVING: 'Credito revolving', OTHER: 'Altro', RESOLVED: 'Ci sono stati ritardi, ora risolti', CURRENT: 'Ci sono ritardi ancora in corso',
  INCOME: 'Continuità delle entrate', SUPPORT: 'Sostentamento di altre persone', HOME: 'Abitazione e beni essenziali', LIABILITY: 'Responsabilità verso altri', CHECKED: 'Verificato', UNREVIEWED: 'Da verificare', GAP: 'Una strategia non è ancora definita',
  CASH: 'Liquidità disponibile', FINANCIAL: 'Strumenti finanziari non previdenziali', OTHER_PROPERTY: 'Altri immobili', VALUABLES: 'Metalli e collezioni', CRYPTO: 'Cripto-attività',
  LT50: 'Meno del 50%', GE50_LT75: 'Dal 50% a meno del 75%', GE75: 'Almeno il 75%', PROPERTY: 'Un immobile', FINANCIAL_ISSUER: 'Uno stesso emittente finanziario', UNKNOWN: 'Non so',
  LT25: 'Meno di un quarto', GE25_LT50: 'Da un quarto a meno della metà', GE50_NOT_ALL: 'Almeno metà, ma non tutto', ALL: 'Tutto', YES: 'Sì', NO: 'No',
  IDEA: 'Un’idea, senza tempo né importo', HORIZON: 'Un obiettivo con orizzonte', DEFINED: 'Un obiettivo con tempo e risorse da verificare o già stimate', ROUGH: 'Solo un’idea o stima non verificata', NOT_REVIEWED: 'Non ho ancora fatto il confronto',
  DIRECT: 'Direttamente', WITH_PROFESSIONAL: 'Confronto e decisione condivisa con un professionista', DELEGATED_PROFESSIONAL: 'Delega prevalente a un professionista', OTHER_HOUSEHOLD: 'Decide soprattutto un’altra persona del bilancio',
  EXPLAIN: 'So individuare e spiegare i costi su un riepilogo', FOUND: 'Li ho individuati ma non so spiegarli', NOT_FOUND: 'Non li ho individuati', COUNT: 'Il numero di investimenti basta a eliminare la concentrazione', EXPOSURE: 'La dipendenza dalla stessa impresa può rimanere',
  WITHIN3: 'Negli ultimi tre mesi', FOUR_TO12: 'Tra quattro e dodici mesi fa', OVER12: 'Oltre dodici mesi fa', NEVER: 'Mai',
  GUARANTEE: 'Garanzie personali per debiti altrui', JOINT_OBLIGATIONS: 'Debiti condivisi con obblighi ulteriori', VARIABLE_RATE: 'Rate variabili', BALLOON_OR_MORATORIUM: 'Sospensioni o pagamenti finali importanti', KNOWN_CHANGE: 'Cambiamenti di rata già noti',
  RESERVE: 'Riserva per imprevisti', PLANNED_EXPENSE: 'Una spesa programmata', HOUSING: 'Acquistare o adattare l’abitazione', REDUCE_DEBT: 'Ridurre impegni debitori', WORK_CHANGE: 'Un cambiamento lavorativo', LONGTERM: 'Organizzare il lungo periodo', FAMILY_PASSAGE: 'Un futuro passaggio di risorse familiari', OTHER_CLARIFY: 'Altro da chiarire insieme',
  WITHIN12: 'Entro dodici mesi', OVER12_TO36: 'Oltre dodici e fino a trentasei mesi', OVER36: 'Oltre trentasei mesi', ONCE: 'Una tantum', CONTINUING: 'Continuativa',
  OFFICIAL: 'Comunicazione ufficiale dell’ente', CONTRACTUAL: 'Comunicazione contrattuale previdenziale', UNVERIFIED: 'Stima personale o simulazione non verificata',
  ACCESS: 'Avere accesso alle risorse', PRESERVE_RESERVE: 'Non intaccare riserva e impegni', NO_NEW_DEBT: 'Non assumere nuovo debito', NO_HOME_BUSINESS: 'Non usare abitazione o attività d’impresa', NOW: 'Subito', DAYS7: 'Entro sette giorni', DAYS30: 'Entro trenta giorni', BY_GOAL_HORIZON: 'Quando servono per l’obiettivo', HARD: 'Non negoziabile', PREFERENCE: 'Preferenza da discutere', GLOBAL: 'Per tutti gli obiettivi',
  BONDS: 'Titoli obbligazionari', EQUITY: 'Azioni', FUNDS_ETF: 'Fondi o ETF', INSURANCE: 'Soluzioni assicurative', HEARD: 'Solo sentita nominare', READ_COMPARED: 'Letta o confrontata, senza operazioni', HELD_DELEGATED: 'Detenuta con decisioni affidate ad altri', PARTICIPATED: 'Ho partecipato alla scelta o gestione',
  UNDERSTAND_COSTS_RISKS: 'Capire rischi, costi e vincoli prima di decidere', AVAILABILITY: 'Mantenere disponibili le risorse quando servono', UNCERTAIN_RESULTS: 'Capire quali risultati sono incerti', GUARANTEED_NO_FLUCTUATION: 'Vorrei un rendimento certo senza oscillazioni', HIGH_RETURN_NO_RISK_LIQUID: 'Vorrei risultati elevati, accesso immediato e nessun rischio', NONE_DEFINED: 'Nessuna aspettativa ancora definita',
  COST: 'Costi', LOSS: 'Possibilità di perdita', FUNCTION: 'Funzionamento', CONTRACT: 'Impegni contrattuali', CLARIFY_GOALS: 'Chiarire gli obiettivi', RESOURCES_CONSTRAINTS: 'Ricostruire risorse e vincoli', PROTECTION: 'Capire esposizioni e protezioni', COST_FUNCTION: 'Comprendere costi e funzionamento', INFORMATION_PROFESSIONALS: 'Capire quali informazioni e figure professionali servono', TOGETHER: 'Confrontarci e decidere insieme', CONSIDER_DELEGATION: 'Valutare una delega dopo averne comprese le condizioni', UNDERSTAND_FIRST: 'Capire prima le alternative, senza decidere ora', CLARIFY: 'Da chiarire',
};
const overrides: Partial<Record<QuestionId, Record<string, string>>> = {
  'RP-S03': { NONE: 'Nessuna entrata', PENSION: 'Pensione' }, 'RP-C01': { NONE: 'Nessun debito aperto né rate pagate nei due periodi' }, 'RP-C03': { NONE: 'Nessun ritardo' },
  'RP-D01': { NONE: 'Nessuna esposizione individuata' }, 'RP-E01': { HOME: 'Abitazione principale', BUSINESS: 'Quota della propria attività', PENSION: 'Capitale previdenziale vincolato', NONE: 'Nessuna attività da indicare' },
  'RP-F01': { NONE: 'Nessun obiettivo definito' }, 'RP-F02': { CHECKED: 'Confronto fatto con informazioni ufficiali o contrattuali datate' }, 'RP-X07': { '2': '2 euro', '20': '20 euro', '200': '200 euro' }, 'RP-X08': { NONE: 'Nessuna verifica', WITHIN12: 'Negli ultimi dodici mesi' }, 'RP-X10': { NONE: 'Nessuna esperienza da segnalare', PENSION: 'Previdenza complementare', CASH: 'Conti, depositi e risparmio disponibile', WITHIN12: 'Negli ultimi dodici mesi' },
};
export const label = (code: string, id?: QuestionId) => id && overrides[id]?.[code] || labels[code] || 'Da precisare';
export const areaNames = { S: 'Il bilancio che descrivi', A: 'Equilibrio economico', B: 'Liquidità e sicurezza', C: 'Indebitamento', D: 'Protezione', E: 'Struttura patrimoniale', F: 'Pianificazione', X: 'Approfondimenti facoltativi' };
export const stateLabels: Record<AnswerState, string> = { VALUE: 'Risposta indicata', UNKNOWN: 'Non so', DECLINED: 'Preferisco non rispondere', UNANSWERED: 'Da completare', NOT_APPLICABLE: 'Non applicabile' };
export const optionalTitles = ['Il mese con meno entrate', 'Condizioni dei debiti', 'Limiti delle protezioni', 'Valori del patrimonio', 'Debito residuo', 'I tuoi obiettivi', 'Un esempio sui costi', 'Fonti del lungo periodo', 'Risorse e vincoli', 'Esperienza e aspettative', 'Utilità del colloquio'];
export function context(input: AssessmentInput) { const a = resolveAnswers(input); return { asOf: input.asOf, scope: value<Scope>(a, 'RP-S01'), answers: a }; }
export function route(input: AssessmentInput) { const order = ['S', 'A', 'C', 'B', 'D', 'E', 'F']; return ordinaryRoute(resolveAnswers(input)).slice().sort((a, b) => order.indexOf(a[3]) - order.indexOf(b[3])); }
export function latestDraft(input: AssessmentInput, id: QuestionId): Draft | null { const raw = input.answers.filter(a => a.id === id).at(-1); return raw ? { state: raw.state, value: raw.value } : null; }
export function initialValue(id: QuestionId, input: AssessmentInput): unknown {
  const a = context(input).answers, exposures = value<string[]>(a, 'RP-D01')?.filter(e => e !== 'NONE') ?? [];
  const inventory = value<{ categories: string[] }>(a, 'RP-E01')?.categories.filter(c => c !== 'NONE' && c !== 'CASH') ?? [];
  switch (id) {
    case 'RP-C01': return { kinds: [] };
    case 'RP-C04': return { payment: undefined, knownChange: blank() };
    case 'RP-D02': return Object.fromEntries(exposures.map(e => [e, blank()]));
    case 'RP-E01': return { categories: [], complete: false };
    case 'RP-E02': return { band: '', type: '' };
    case 'RP-X03': return Object.fromEntries(exposures.map(e => [e, Object.fromEntries(['availability', 'conditions', 'duration', 'need'].map(k => [k, blank()]))]));
    case 'RP-X04': return { complete: false, rows: Object.fromEntries(inventory.map(e => [e, blank()])) };
    case 'RP-X05': return { total: undefined, complete: false };
    case 'RP-X06': return { goals: [] };
    case 'RP-X08': return { source: blank(), recency: blank() };
    case 'RP-X09': return { minimum: blank(), available: blank(), collections: { allocations: 'UNANSWERED', constraints: 'UNANSWERED', otherResources: 'UNANSWERED' }, allocations: [], constraints: [], otherResources: [] };
    case 'RP-X10': return { personalExperience: blank(), expectations: blank(), doubts: blank() };
    case 'RP-X11': return { main: blank(), futureInvolvement: blank() };
    default: return ['RP-S03', 'RP-D01', 'RP-X02'].includes(id) ? [] : undefined;
  }
}
/** Recontextualize only at the user's explicit confirmation, never during rendering. */
export function confirmDraft(input: AssessmentInput, id: QuestionId, draft: Draft): AssessmentInput {
  const c = context(input), old = latestDraft(input, id);
  function update(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(update);
    if (!v || typeof v !== 'object') return v;
    if ('currency' in v && v.currency === 'EUR') return { ...v, scope: c.scope, asOf: input.asOf };
    return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, update(child)]));
  }
  let payload = draft.value;
  if (draft.state === 'VALUE') {
    payload = update(payload);
    if (id === 'RP-X04') { const inv = value<{ categories: string[] }>(c.answers, 'RP-E01'); payload = { ...obj(payload), rows: Object.fromEntries((inv?.categories ?? []).filter(key => !['CASH', 'NONE'].includes(key)).map(key => [key, obj(obj(payload).rows)[key] ?? blank()])) }; }
    if (id === 'RP-D02' || id === 'RP-X03') {
      const exposures = value<string[]>(c.answers, 'RP-D01')?.filter(e => e !== 'NONE') ?? [];
      payload = Object.fromEntries(exposures.map(e => [e, id === 'RP-D02' ? obj(payload)[e] ?? blank() : Object.fromEntries(['availability', 'conditions', 'duration', 'need'].map(k => [k, obj(obj(payload)[e])[k] ?? blank()]))]));
    }
  }
  if (old?.state === draft.state && JSON.stringify(old.value) === JSON.stringify(payload) && c.answers[id].lifecycle === 'ACTIVE') return input;
  return recordAnswer(input, id, draft.state, payload);
}
export function defaultMoney(input: AssessmentInput, period: Period) { return { currency: 'EUR' as const, scope: context(input).scope, asOf: input.asOf, period, basis: period === 'T0' ? 'STOCK' as const : 'MONTHLY' as const, quality: 'ESTIMATED' as const }; }
export function currentGoals(input: AssessmentInput): Goal[] { return value<{ goals: Goal[] }>(context(input).answers, 'RP-X06')?.goals ?? []; }
export function questionPeriod(id: QuestionId): Period { return question(id).period ?? 'T0'; }
