import { ANNUNCI10X_RUBRIC_VERSION_V2 } from './constants.ts';
import type {
  AnchorScoreV2,
  CheckIdV2,
  RubricCheckDefinitionV2,
  RubricValidationResultV2,
} from './types-v2.ts';

const REQUIRED_ANCHORS: readonly AnchorScoreV2[] = [0, 2, 4, 6, 8, 10] as const;

type RubricCheckMetadataV2 = Pick<RubricCheckDefinitionV2, 'whatItMeasures' | 'targetEvidence' | 'contextAllowed' | 'conflictSemantics' | 'avoid'>;

const CHECK_METADATA_V2: Record<CheckIdV2, RubricCheckMetadataV2> = {
  '01': {
    whatItMeasures: 'Whether the target title lets a candidate immediately understand the role family and role identity.',
    targetEvidence: 'Title line, heading, role label, visible job title metadata, or repeated role naming inside the target.',
    contextAllowed: 'Role hints can help interpret ambiguous wording, but cannot replace an absent or unclear target title.',
    conflictSemantics: 'Conflicting titles for different roles can create a conflict and possible gate issue.',
    avoid: ['Do not reward keyword stuffing.', 'Do not reward brand-like creativity over recognizability.'],
  },
  '02': {
    whatItMeasures: 'Whether the target clarifies seniority or operating level, scope, and responsibility perimeter.',
    targetEvidence: 'Seniority, autonomy, reporting line, scope, area, responsibility statements, decision rights, or accountability.',
    contextAllowed: 'Role type can explain what level or perimeter would normally matter, but cannot add absent responsibilities.',
    conflictSemantics: 'Contradictory seniority or responsibility statements can trigger conflict.',
    avoid: ['Do not require formal junior/mid/senior labels when operational perimeter is clear.'],
  },
  '03': {
    whatItMeasures: 'Whether the target describes observable work instead of generic traits or slogans.',
    targetEvidence: 'Recurring tasks, workflows, tools, handoffs, actions, frequency, or observable responsibilities.',
    contextAllowed: 'RoleCard or declared context can suggest what activities to look for, but cannot supply target evidence.',
    conflictSemantics: 'Contradictory activity descriptions can create conflict.',
    avoid: ['Do not confuse activities with the role result.'],
  },
  '04': {
    whatItMeasures: 'Whether the target explains why the role exists and what improves because of the role.',
    targetEvidence: 'Mission, outcome, effect, result, improved condition, service level, reliability, speed, safety, or continuity.',
    contextAllowed: 'Context can clarify the expected outcome, but cannot score as target evidence if absent.',
    conflictSemantics: 'Conflicting result promises or impossible outcomes can trigger conflict.',
    avoid: ['Do not let an activity list automatically produce a high result score.'],
  },
  '05': {
    whatItMeasures: 'Whether the target makes the work setting and main interactions understandable.',
    targetEvidence: 'Team, manager, stakeholders, customers, suppliers, tools, work environment, autonomy, or collaboration model.',
    contextAllowed: 'Company or role context can identify relevant interlocutors, but cannot replace target evidence.',
    conflictSemantics: 'Incompatible environment statements can trigger conflict.',
    avoid: ['Do not reward generic corporate description.'],
  },
  '06': {
    whatItMeasures: 'Whether the target gives priority to the facts that matter most for this specific search.',
    targetEvidence: 'Visible order, emphasis, opening, section weight, repeated facts, and placement of key facts.',
    contextAllowed: 'The four lenses help determine what should matter, but context may not become target evidence.',
    conflictSemantics: 'Target emphasis on facts contradicted elsewhere can trigger conflict.',
    avoid: ['Do not reduce this to role popularity only.', 'Do not apply duplicate penalty automatically for every fact already missing in another control.'],
  },
  '07': {
    whatItMeasures: 'Whether the target represents the real rhythm of work without glamourizing or hiding it.',
    targetEvidence: 'Routine, cadence, recurring tasks, unexpected events, challenge level, problem types, variability, or pressure.',
    contextAllowed: 'RoleProfile or context can indicate expected routine/challenge, but cannot provide positive target evidence.',
    conflictSemantics: 'Target contradicting known target evidence about work rhythm can trigger conflict.',
    avoid: ['Do not automatically reward glamour.', 'Faithful routine can score 10.'],
  },
  '08': {
    whatItMeasures: 'Whether material demands are visible when they affect fit.',
    targetEvidence: 'Shifts, on-call, physical effort, peaks, variable priorities, responsibility, pressure, complexity, travel, or urgency.',
    contextAllowed: 'Context can identify which demands matter, but cannot invent demands or count as target evidence.',
    conflictSemantics: 'Contradictory or hidden material demand can trigger conflict.',
    avoid: ['Do not invent difficulties.', 'Do not treat generic challenging-language as concrete demand evidence.'],
  },
  '09': {
    whatItMeasures: 'Whether technical wording is proportionate to the actual role and candidate audience.',
    targetEvidence: 'Role-specific tools, methods, technical terms, level-appropriate jargon, and necessary specialist detail.',
    contextAllowed: 'Role context can clarify which technicality is expected, but cannot supply absent target wording.',
    conflictSemantics: 'Technical requirements that contradict the role reality can trigger conflict.',
    avoid: ['Simple does not mean poor.', 'Technical does not mean bureaucratic.'],
  },
  '10': {
    whatItMeasures: 'Whether indispensable, preferred, trainable, and disqualifying requirements are semantically distinct.',
    targetEvidence: 'Requirement labels, grouped lists, explicit must-have/nice-to-have/trainable wording, or unequivocal priority signals.',
    contextAllowed: 'Context can identify which requirements should exist, but target must show the distinction for positive scoring.',
    conflictSemantics: 'Requirements that contradict role facts or exclude impossible profiles can trigger conflict.',
    avoid: ['Exact labels are not mandatory when the distinction is unequivocal.'],
  },
  '11': {
    whatItMeasures: 'Whether each material requirement is connected to real activities, outcomes, or conditions.',
    targetEvidence: 'Explicit or strongly inferable link between requirement and activity, result, tool, responsibility, or condition.',
    contextAllowed: 'Role context can explain why a requirement may matter, but original-ad score needs target evidence or target basis.',
    conflictSemantics: 'A requirement contradicting role facts or conditions can trigger conflict.',
    avoid: ['Do not accept years of experience or problem solving by habit.'],
  },
  '12': {
    whatItMeasures: 'Whether the target clearly states where and how work happens.',
    targetEvidence: 'City, site, remote, hybrid, on-site, travel, mobility, territory, or branch information.',
    contextAllowed: 'Structured fields can clarify only if they are part of the evaluated target bundle.',
    conflictSemantics: 'Remote/on-site/hybrid contradictions are material conflicts.',
    avoid: ['Do not invent legal or policy obligations not present.'],
  },
  '13': {
    whatItMeasures: 'Whether time and contract conditions are clear enough for candidate decision.',
    targetEvidence: 'Contract type, full/part time, duration, days, hours, shift windows, cadence, availability, or start timing.',
    contextAllowed: 'Role context can identify relevant timing facts, but cannot fill target gaps.',
    conflictSemantics: 'Contradictory hours, contract, or availability can trigger conflict.',
    avoid: ['Do not treat "turni" alone as complete information.'],
  },
  '14': {
    whatItMeasures: 'Whether compensation is clear when known, available, necessary, or required.',
    targetEvidence: 'Salary, range, hourly rate, commission, bonus, CCNL/level, disclosure policy, or explicit compensation handling.',
    contextAllowed: 'Known context can determine availability/necessity, but absent original target compensation cannot become positive evidence.',
    conflictSemantics: 'Contradictory compensation figures or formulas can trigger conflict.',
    avoid: ['Do not invent legal obligations.', 'Do not turn genuine N/D into zero.', 'Do not give high score to a bare editorial excuse for hiding compensation.'],
  },
  '15': {
    whatItMeasures: 'Whether the target gives factual reasons to consider the opportunity.',
    targetEvidence: 'Onboarding, training, autonomy, real problems, technologies, schedule, flexibility, support, team structure, or concrete benefits.',
    contextAllowed: 'Company context can identify supportable proof points, but target must contain them for positive scoring.',
    conflictSemantics: 'Unsupported, contradicted, or inflated benefits can trigger unsupported-claim flags and gate issues.',
    avoid: ['Do not call a normal baseline a benefit without context.', 'Do not reward slogans.'],
  },
  '16': {
    whatItMeasures: 'Whether the target structure fits the declared publication channel.',
    targetEvidence: 'Channel, format, length, sectioning, field usage, opening, ordering, or required structured fields.',
    contextAllowed: 'Channel policy can define expectations; without explicit policy, do not invent platform rules.',
    conflictSemantics: 'A channel variant that alters Master facts or violates required fields can trigger conflict.',
    avoid: ['Do not invent LinkedIn, Indeed, Meta, ATS, or other platform rules without explicit policy.'],
  },
  '17': {
    whatItMeasures: 'Whether ad body, structured fields, and application destination tell the same facts.',
    targetEvidence: 'Body text, structured portal fields, metadata, destination URL/email, and application instructions.',
    contextAllowed: 'System fields can be compared when they are part of the evaluated target bundle.',
    conflictSemantics: 'Material contradiction across text, fields, or destination is a conflict by definition.',
    avoid: ['Do not penalize lack of portal fields when only free text is available; use N/D.'],
  },
  '18': {
    whatItMeasures: 'Whether the target is easy to read, scan, and navigate.',
    targetEvidence: 'Sections, headings, paragraph length, bullet structure, order, density, and hierarchy.',
    contextAllowed: 'Channel can influence expected length and structure, but cannot replace target readability evidence.',
    conflictSemantics: 'Usually not a conflict unless structure hides contradictory required facts.',
    avoid: ['Do not turn readability into subjective visual taste.'],
  },
  '19': {
    whatItMeasures: 'Whether wording avoids vagueness, cliches, bloating, and repetition.',
    targetEvidence: 'Concrete verbs, specific nouns, repetition, cliches, buzzwords, bureaucratic phrases, or inflated language.',
    contextAllowed: 'Role context can identify terms that are precise versus decorative.',
    conflictSemantics: 'Inflated unsupported claims can also trigger unsupported flags.',
    avoid: ['Do not penalize necessary technical terms when they are precise.'],
  },
  '20': {
    whatItMeasures: 'Whether the candidate has a usable next action.',
    targetEvidence: 'Email, URL, application button/path, required subject, documents, deadline, or next step.',
    contextAllowed: 'Structured destination can count only if part of the evaluated target bundle.',
    conflictSemantics: 'Invalid destination or conflicting destinations can trigger conflict.',
    avoid: ['Do not assume a visible platform button exists unless the evaluated target includes it.'],
  },
};

export const ANNUNCI10X_RUBRIC_CHECKS_V2: readonly RubricCheckDefinitionV2[] = [
  check('01', 'Il titolo rende immediatamente riconoscibile il ruolo?', 'Riconoscibilita del titolo', [
    [0, 'Titolo assente o inutilizzabile per identificare il ruolo.'],
    [2, 'Titolo creativo o generico con deboli indizi di ruolo.'],
    [4, 'Famiglia professionale intuibile, ma ruolo ancora ampio o ambiguo.'],
    [6, 'Ruolo riconoscibile, ma manca specificita utile.'],
    [8, 'Titolo chiaro, specifico e riconoscibile dai candidati target.'],
    [10, 'Titolo immediatamente riconoscibile, specifico e search-friendly, senza keyword stuffing.'],
  ], 'Titolo riconoscibile atteso ma assente.', 'Formato realmente privo di titolo o role label atteso.', true, 'CLOSED_DECISION_CANDIDATE', ['Non premiare keyword stuffing.']),
  check('02', 'Si capiscono livello, perimetro e responsabilita?', 'Livello, perimetro e responsabilita', [
    [0, 'Nessuna evidenza di livello, perimetro o responsabilita.'],
    [2, 'Accenni vaghi a responsabilita senza perimetro operativo.'],
    [4, 'Scope o responsabilita parziali, con ambiguita materiali.'],
    [6, 'Perimetro e responsabilita sufficienti per autoselezione base.'],
    [8, 'Perimetro operativo e responsabilita chiari; label junior/mid/senior non obbligatoria.'],
    [10, 'Livello, scope, autonomia, responsabilita e interfacce molto chiari.'],
  ], 'Responsabilita o perimetro attesi ma assenti.', 'Formato in cui livello/perimetro non sono rappresentabili legittimamente.', true, 'LLM_COMPLEX', ['La responsabilita e first-class evidence.']),
  check('03', 'Le attivita quotidiane sono concrete?', 'Concretezza delle attivita', [
    [0, 'Nessuna attivita concreta.'],
    [2, 'Solo etichette generiche come gestione clienti, CRM, problem solving.'],
    [4, 'Alcune attivita presenti ma ampie, incomplete o mescolate a tratti personali.'],
    [6, 'Attivita utili e comprensibili, con specificita ancora migliorabile.'],
    [8, 'Attivita quotidiane o settimanali chiare e osservabili.'],
    [10, 'Attivita concrete, specifiche, ordinate abbastanza da capire il lavoro reale.'],
  ], 'Attivita concrete applicabili ma assenti.', 'Target non destinato a descrivere attivita e nessuna attivita attesa.', false, 'LLM_COMPLEX', ['Non confondere attivita e risultato.']),
  check('04', 'E chiaro quale risultato deve produrre il ruolo?', 'Risultato osservabile del ruolo', [
    [0, 'Nessun risultato; solo titolo, tratti o attivita.'],
    [2, 'Risultato aspirazionale o generico con legame debole al ruolo.'],
    [4, 'Risultato inferibile ma non espresso chiaramente.'],
    [6, 'Risultato osservabile comprensibile ma ampio o poco collegato alle attivita.'],
    [8, 'Risultato chiaro, osservabile e collegato al ruolo.'],
    [10, 'Risultato preciso, specifico e senza ambiguita materiali; numerico o qualitativo.'],
  ], 'Risultato atteso applicabile ma assente.', 'Risultato non rappresentabile legittimamente nel target.', true, 'LLM_COMPLEX', ['Un elenco di attivita non giustifica automaticamente score alto.']),
  check('05', 'Si capiscono contesto, interlocutori e ambiente operativo?', 'Contesto operativo', [
    [0, 'Nessun contesto operativo.'],
    [2, 'Descrizione corporate generica senza setting di lavoro utile.'],
    [4, 'Alcuni indizi di contesto, ma interlocutori o ambiente restano poco chiari.'],
    [6, 'Contesto sufficiente per capire il setting base.'],
    [8, 'Team, interlocutori e ambiente rilevanti sono chiari.'],
    [10, 'Contesto, interlocutori, strumenti/ambiente e autonomia molto chiari senza corporate filler.'],
  ], 'Contesto atteso ma assente.', 'Canale o target che impedisce legittimamente la rappresentazione del contesto.', true, 'LLM_COMPLEX', ['Non premiare descrizioni corporate generiche.']),
  check('06', "L'annuncio mette in evidenza le informazioni piu utili per questa ricerca?", 'Priorita delle informazioni', [
    [0, 'Enfasi scollegata dalla ricerca o informazioni decisive assenti.'],
    [2, 'Enfasi generica; fatti utili deboli o sepolti.'],
    [4, 'Alcune priorita rilevanti visibili, ma restano gap strategici importanti.'],
    [6, 'Informazioni utili visibili, anche se non prioritarizzate in modo ottimale.'],
    [8, 'Informazioni piu utili per questa ricerca chiaramente in evidenza.'],
    [10, 'Enfasi fortemente allineata alle quattro lenti e informazioni decisive immediatamente accessibili.'],
  ], 'Priorita determinabile ma informazione decisiva mancante o sepolta.', 'Contesto insufficiente per determinare seriamente l enfasi corretta.', true, 'LLM_COMPLEX', ['Non applicare duplicate penalty automatica per ogni fatto gia mancante in altro controllo.']),
  check('07', 'Routine, imprevisti e sfide sono rappresentati fedelmente?', 'Fedelta routine e sfide', [
    [0, 'Routine/sfide assenti o fuorvianti quando rilevanti.'],
    [2, 'Solo formule come dinamico, sfidante, stimolante senza evidenza.'],
    [4, 'Segnali parziali ma bilanciamento routine/sfide poco chiaro.'],
    [6, 'Rappresentazione base fedele del ritmo di lavoro.'],
    [8, 'Routine, imprevisti e sfide concreti e bilanciati dove rilevanti.'],
    [10, 'Ritmo di lavoro pienamente fedele, senza glamour o occultamento.'],
  ], 'Ritmo materiale atteso ma assente.', 'Nessuna base legittima per valutare routine/sfide.', true, 'LLM_COMPLEX', ['Una routine fedele puo valere 10.']),
  check('08', 'Impegno, responsabilita e condizioni impegnative sono visibili quando contano?', 'Visibilita delle condizioni impegnative', [
    [0, 'Condizioni materiali assenti o nascoste quando dovrebbero essere visibili.'],
    [2, 'Linguaggio vago su impegno senza condizioni concrete.'],
    [4, 'Alcuni aspetti impegnativi visibili, ma dettagli materiali mancanti.'],
    [6, 'Principali impegni comprensibili, con incompletezze.'],
    [8, 'Condizioni impegnative chiare e proporzionate dove rilevanti.'],
    [10, 'Impegni, responsabilita e condizioni materiali espliciti, bilanciati e non esagerati.'],
  ], 'Condizioni note/materiali attese ma assenti.', 'Nessuna evidenza che condizioni impegnative siano rilevanti.', true, 'LLM_COMPLEX', ['Non inventare difficolta.']),
  check('09', 'Il livello tecnico del linguaggio e adatto al lavoro?', 'Adeguatezza tecnica del linguaggio', [
    [0, 'Tecnicalita assente dove essenziale o completamente fuori livello.'],
    [2, 'Gergo o termini generici con poca precisione specifica.'],
    [4, 'Fit tecnico parziale, con dettagli mancanti o rumore.'],
    [6, 'Livello tecnico adeguato alla comprensione base.'],
    [8, 'Buon fit tra linguaggio tecnico e realta del ruolo.'],
    [10, 'Linguaggio tecnico preciso, accessibile e adatto, senza complessita ornamentale.'],
  ], 'Dettaglio tecnico necessario assente.', 'Tecnicalita del ruolo non determinabile.', true, 'LLM_COMPLEX', ['Semplice non significa povero; tecnico non significa burocratico.']),
  check('10', 'Indispensabili, preferenziali e apprendibili sono distinti?', 'Classificazione dei requisiti', [
    [0, 'Requisiti assenti o completamente mescolati quando richiesti.'],
    [2, 'Lista unica Requisiti senza distinzione semantica.'],
    [4, 'Distinzione parziale o implicita, ma molti elementi restano mescolati.'],
    [6, 'Separazione base tra obbligatori e preferenziali o apprendibili.'],
    [8, 'Distinzione chiara tra indispensabili, preferenziali e apprendibili.'],
    [10, 'Distinzione completa, inequivocabile e senza barriere inutili.'],
  ], 'Classificazione attesa ma assente.', 'Nessun requisito legittimamente presente da classificare.', true, 'CLOSED_DECISION_CANDIDATE', ['Le tre etichette esatte non sono obbligatorie se la distinzione e inequivocabile.']),
  check('11', "Ogni requisito e collegato a un'attivita, un risultato o una condizione reale?", 'Rilevanza dei requisiti', [
    [0, 'Requisiti arbitrari o scollegati da basi di lavoro visibili.'],
    [2, 'Prerequisiti perlopiu generici con poca connessione.'],
    [4, 'Alcuni requisiti collegati, ma altri importanti non motivati.'],
    [6, 'Requisiti principali plausibilmente collegati al lavoro visibile.'],
    [8, 'Requisiti chiaramente rilevanti per attivita, risultati o condizioni.'],
    [10, 'Ogni requisito materiale ha una ragione chiara e proporzionata.'],
  ], 'Requisiti presenti senza base lavoro visibile.', 'Nessun requisito e nessuna base ruolo per valutare rilevanza.', true, 'LLM_COMPLEX', ['Domanda guida: per fare cosa?']),
  check('12', 'Sede e modalita di lavoro sono chiare?', 'Sede e modalita di lavoro', [
    [0, 'Sede o modalita assenti quando applicabili.'],
    [2, 'Sede/modalita vaghe come zona o flessibile senza chiarezza.'],
    [4, 'Sede o modalita parziali, con ambiguita importante.'],
    [6, 'Informazioni base sufficienti per autoselezione.'],
    [8, 'Sede e modalita chiare, inclusa mobilita se rilevante.'],
    [10, 'Sede e modalita complete e coerenti, senza ambiguita materiale.'],
  ], 'Sede/modalita applicabili ma assenti.', 'Sede/modalita realmente non applicabili al target.', true, 'DETERMINISTIC_CANDIDATE', ['Contraddizioni remoto/presenza sono materiali.']),
  check('13', 'Contratto, orari, turni e tempi sono sufficientemente chiari?', 'Contratto, orari e tempi', [
    [0, 'Nessuna informazione contratto/tempo quando applicabile.'],
    [2, 'Formula vaga come part-time con turni.'],
    [4, 'Alcuni fatti temporali, ma gap importanti.'],
    [6, 'Contratto e orari base comprensibili.'],
    [8, 'Contratto, schedule, turni e timing chiari dove rilevanti.'],
    [10, 'Informazioni tempo/contratto complete, precise e usabili dal candidato.'],
  ], 'Fatti contratto/tempo attesi ma assenti.', 'Fatti tempo/contratto non applicabili o legittimamente non disponibili.', true, 'CLOSED_DECISION_CANDIDATE', ['Turni da solo non e informazione completa.']),
  check('14', 'Il compenso e gestito con chiarezza quando e disponibile o necessario?', 'Chiarezza del compenso', [
    [0, 'Compenso noto, richiesto o necessario ma completamente omesso.'],
    [2, 'Frase vaga come commisurata all esperienza.'],
    [4, 'Compenso parziale o ambiguo.'],
    [6, 'Gestione base del compenso comprensibile ma incompleta.'],
    [8, 'Fascia, formula o policy di disclosure chiare.'],
    [10, 'Compenso chiaro, specifico e adeguato al contesto, senza ambiguita materiale.'],
  ], 'Compenso noto/disponibile/necessario ma assente.', 'Compenso davvero non disponibile e non necessario secondo contesto/policy.', true, 'CLOSED_DECISION_CANDIDATE', ['Una giustificazione editoriale del non comunicare compenso non produce da sola score alto.']),
  check('15', "Esistono ragioni concrete e verificabili per considerare l'offerta?", 'Ragioni concrete dell offerta', [
    [0, 'Nessuna ragione concreta o solo claim non supportati.'],
    [2, 'Slogan generici come azienda leader o ambiente stimolante.'],
    [4, 'Alcune ragioni presenti ma generiche o poco verificabili.'],
    [6, 'Ragioni concrete base con dettaglio limitato.'],
    [8, 'Diverse ragioni concrete, verificabili e rilevanti.'],
    [10, 'Ragioni forti, specifiche e supportate, senza claim gonfiati.'],
  ], 'Ragioni offerta attese ma assenti.', 'Nessun contesto offerta disponibile e nessun claim target valutabile.', true, 'LLM_COMPLEX', ['Fatti, non slogan.']),
  check('16', 'La struttura e adatta al canale in cui verra pubblicata?', 'Fit struttura-canale', [
    [0, 'Struttura chiaramente inadatta al canale dichiarato.'],
    [2, 'Struttura che ignora vincoli evidenti del canale.'],
    [4, 'Fit parziale con problemi strutturali importanti.'],
    [6, 'Fit canale base e utilizzabile.'],
    [8, 'Struttura ben adatta al canale.'],
    [10, 'Struttura pienamente adatta al canale e fedele ai fatti.'],
  ], 'Canale noto ma struttura inadatta o assente.', 'Canale sconosciuto o policy canale esplicita assente.', true, 'CLOSED_DECISION_CANDIDATE', ['Non inventare policy LinkedIn/Indeed/Meta senza documento esplicito.']),
  check('17', 'Testo, campi del portale e destinazione raccontano gli stessi fatti?', 'Coerenza testo-campi-destinazione', [
    [0, 'Contraddizioni materiali tra testo, campi o destinazione.'],
    [2, 'Diverse incoerenze o campi mancanti creano alta confusione.'],
    [4, 'Coerenza parziale con discrepanze significative.'],
    [6, 'Perlopiu coerente con gap minori.'],
    [8, 'Coerenza tra campi disponibili senza contraddizioni materiali.'],
    [10, 'Allineamento completo tra testo, campi e destinazione.'],
  ], 'Campi confrontabili attesi ma assenti.', 'Solo free text disponibile, senza campi/destinazione confrontabili.', true, 'DETERMINISTIC_CANDIDATE', ['Non penalizzare bundle che non include campi.']),
  check('18', "L'annuncio si legge e si scandisce facilmente?", 'Leggibilita e scansione', [
    [0, 'Struttura illeggibile o incoerente.'],
    [2, 'Testo denso, disordinato e difficile da scandire.'],
    [4, 'Qualche struttura, ma problemi importanti di densita o ordine.'],
    [6, 'Leggibile, con opportunita chiare di miglioramento.'],
    [8, 'Gerarchia chiara e buona scansione.'],
    [10, 'Struttura molto chiara, ordinata e scansionabile senza nascondere fatti.'],
  ], 'Struttura leggibile attesa ma assente.', 'Target troppo breve o vincolato per valutare equamente la leggibilita.', false, 'CLOSED_DECISION_CANDIDATE', ['Non trasformare in gusto estetico soggettivo.']),
  check('19', 'Il linguaggio e concreto, preciso e privo di ripetizioni inutili?', 'Concretezza del linguaggio', [
    [0, 'Linguaggio soprattutto vago, gonfio, ripetitivo o inutilizzabile.'],
    [2, 'Molti cliche o buzzword e poca informazione concreta.'],
    [4, 'Alcune formulazioni concrete, ma genericita dominante.'],
    [6, 'Comprensibile e utile, con vaghezze o ripetizioni notevoli.'],
    [8, 'Concreto, preciso e perlopiu conciso.'],
    [10, 'Linguaggio sempre concreto, preciso ed economico, senza filler materiale.'],
  ], 'Concretezza materiale assente.', 'Testo troppo limitato per valutare il linguaggio.', true, 'LLM_COMPLEX', ['Non penalizzare termini tecnici necessari.']),
  check('20', 'Una persona sa esattamente come candidarsi?', 'Chiarezza candidatura', [
    [0, 'Nessun percorso candidatura o destinazione inutilizzabile.'],
    [2, 'CTA vaga come Invia CV senza destinazione.'],
    [4, 'Istruzione parziale, ma destinazione o azione incompleta.'],
    [6, 'CTA base utilizzabile con ambiguita minore.'],
    [8, 'Destinazione e istruzioni chiare.'],
    [10, 'Percorso candidatura esatto, valido e usabile, con dettagli necessari.'],
  ], 'CTA attesa assente.', 'Formato che non richiede legittimamente istruzioni di candidatura.', true, 'DETERMINISTIC_CANDIDATE', ['Destinazione invalida puo generare gate.']),
] as const;

export const ANNUNCI10X_RUBRIC_V2 = {
  version: ANNUNCI10X_RUBRIC_VERSION_V2,
  checks: ANNUNCI10X_RUBRIC_CHECKS_V2,
  totalCheckCount: 20,
  maxScorePerCheck: 10,
} as const;

export function getRubricCheckDefinitionV2(id: string): RubricCheckDefinitionV2 {
  const definition = ANNUNCI10X_RUBRIC_CHECKS_V2.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown Annunci 10x V2 rubric check: ${id}`);
  return definition;
}

export function validateAnnunci10xRubricV2(): RubricValidationResultV2 {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (ANNUNCI10X_RUBRIC_CHECKS_V2.length !== 20) errors.push(`Rubric V2 must contain 20 checks, found ${ANNUNCI10X_RUBRIC_CHECKS_V2.length}`);

  for (let index = 0; index < ANNUNCI10X_RUBRIC_CHECKS_V2.length; index += 1) {
    const definition = ANNUNCI10X_RUBRIC_CHECKS_V2[index];
    const expectedId = String(index + 1).padStart(2, '0');
    if (definition.id !== expectedId) errors.push(`Rubric V2 check at index ${index} must be ${expectedId}, found ${definition.id}`);
    if (ids.has(definition.id)) errors.push(`Duplicate V2 check id ${definition.id}`);
    ids.add(definition.id);
    if (definition.maxScore !== 10) errors.push(`Check ${definition.id} must have maxScore 10`);

    const anchorScores = definition.anchors.map((anchor) => anchor.score);
    if (anchorScores.length !== REQUIRED_ANCHORS.length) errors.push(`Check ${definition.id} must define ${REQUIRED_ANCHORS.length} required anchors`);
    for (const required of REQUIRED_ANCHORS) {
      if (!anchorScores.includes(required)) errors.push(`Check ${definition.id} missing anchor ${required}`);
    }
    const sorted = [...anchorScores].sort((left, right) => left - right);
    if (anchorScores.some((score, anchorIndex) => score !== sorted[anchorIndex])) errors.push(`Check ${definition.id} anchors must be ordered`);
    for (const anchor of definition.anchors) {
      if (!anchor.description.trim()) errors.push(`Check ${definition.id} anchor ${anchor.score} has empty description`);
    }
    if (!definition.canonicalQuestion.trim()) errors.push(`Check ${definition.id} has empty canonicalQuestion`);
    if (!definition.label.trim()) errors.push(`Check ${definition.id} has empty label`);
    if (!definition.whatItMeasures.trim()) errors.push(`Check ${definition.id} has empty whatItMeasures`);
    if (!definition.targetEvidence.trim()) errors.push(`Check ${definition.id} has empty targetEvidence`);
    if (!definition.contextAllowed.trim()) errors.push(`Check ${definition.id} has empty contextAllowed`);
    if (!definition.missingSemantics.trim()) errors.push(`Check ${definition.id} has empty missingSemantics`);
    if (!definition.notEvaluableSemantics.trim()) errors.push(`Check ${definition.id} has empty notEvaluableSemantics`);
    if (!definition.conflictSemantics.trim()) errors.push(`Check ${definition.id} has empty conflictSemantics`);
    if (!definition.gateRelevance.notes.trim()) errors.push(`Check ${definition.id} has empty gate relevance notes`);
    if (!definition.avoid.length || definition.avoid.some((item) => !item.trim())) errors.push(`Check ${definition.id} has empty avoid/caveat metadata`);
  }

  return { ok: errors.length === 0, errors };
}

function check(
  id: CheckIdV2,
  canonicalQuestion: string,
  label: string,
  anchors: readonly (readonly [AnchorScoreV2, string])[],
  missingSemantics: string,
  notEvaluableSemantics: string,
  gateRelevant: boolean,
  acceleratorSuitability: RubricCheckDefinitionV2['acceleratorSuitability'],
  notes: readonly string[] = [],
): RubricCheckDefinitionV2 {
  const metadata = CHECK_METADATA_V2[id];
  return {
    id,
    canonicalQuestion,
    label,
    maxScore: 10,
    whatItMeasures: metadata.whatItMeasures,
    targetEvidence: metadata.targetEvidence,
    contextAllowed: metadata.contextAllowed,
    anchors: anchors.map(([score, description]) => ({ score, description })),
    missingSemantics,
    notEvaluableSemantics,
    conflictSemantics: metadata.conflictSemantics,
    gateRelevance: {
      relevant: gateRelevant,
      notes: gateRelevant ? 'Can contribute to future V2 gate/flags when material.' : 'Quality signal; not a default hard gate by itself.',
    },
    acceleratorSuitability,
    avoid: metadata.avoid,
    notes,
  };
}
