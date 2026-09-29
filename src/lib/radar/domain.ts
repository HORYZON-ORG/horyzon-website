import type { RadarAnswers, RadarAreaId, RadarAreaScore, RadarScores, RadarStep } from './types.ts';

type AreaDefinition = { id: RadarAreaId; label: string; questions: readonly string[] };

export const RADAR_AREAS: readonly AreaDefinition[] = [
  { id: 'amministrazione', label: 'Amministrazione', questions: [
    'Conosco con ragionevole certezza il flusso di cassa dei prossimi 3 mesi.',
    'Abbiamo un piano finanziario scritto e lo confrontiamo periodicamente con i risultati reali.',
    'So sempre qual è il margine reale di ogni servizio o prodotto che vendiamo.',
    "Le decisioni di spesa importanti passano da un controllo di budget, non solo dall'istinto.",
    "Se mi assentassi per un mese, l'azienda continuerebbe a pagare fornitori e incassare senza il mio intervento diretto.",
  ] },
  { id: 'produzione', label: 'Produzione', questions: [
    'Il modo in cui eroghiamo il servizio è scritto in procedure che chiunque in azienda può seguire.',
    'Misuriamo regolarmente la soddisfazione dei clienti, non solo a sensazione.',
    'Un nuovo collaboratore saprebbe come fare il lavoro senza dover chiedere sempre a me.',
    'Reclami ed errori vengono gestiti con un protocollo definito, non caso per caso.',
    'La qualità del servizio non cambia se io non sono direttamente coinvolto nella consegna.',
  ] },
  { id: 'commerciale', label: 'Commerciale', questions: [
    'So esattamente quanti clienti nuovi acquisiamo e quanti ne perdiamo ogni mese.',
    'Abbiamo un processo di vendita definito, che chi vende segue anche senza di me.',
    'Le entrate ricorrenti pesano più delle vendite occasionali.',
    'Chi vende in azienda ha ricevuto una formazione strutturata sulle tecniche di vendita.',
    'Le trattative importanti possono chiudersi anche senza il mio intervento diretto.',
  ] },
  { id: 'marketing', label: 'Marketing', questions: [
    'Sappiamo con chiarezza chi è il nostro cliente ideale e cosa ci differenzia dagli altri.',
    'Generiamo contatti o richieste in modo costante, non solo grazie al passaparola.',
    'Curiamo attivamente la nostra reputazione online.',
    'Il marketing produce contatti già caldi per chi vende, non solo visibilità generica.',
    'Le attività di marketing continuerebbero anche se io non me ne occupassi personalmente.',
  ] },
  { id: 'risorse-umane', label: 'Risorse Umane', questions: [
    'Abbiamo un processo strutturato per selezionare nuovi collaboratori.',
    'Le persone in azienda conoscono chiaramente ruoli, responsabilità e a chi rispondere.',
    'Organizziamo momenti di squadra per curare il clima aziendale.',
    'Misuriamo il benessere e la soddisfazione delle persone in azienda.',
    "Se un collaboratore chiave se ne andasse, l'azienda non si fermerebbe.",
  ] },
] as const;

const AI_STEPS: readonly RadarStep[] = [
  { id: 'ai#uso', kind: 'LIKERT', title: 'In azienda utilizziamo strumenti di intelligenza artificiale nel lavoro di tutti i giorni.' },
  { id: 'ai#casoUso', kind: 'AI_MULTI', title: 'Per cosa utilizzate principalmente l’intelligenza artificiale?', options: ['Contenuti e marketing', 'Amministrazione e reportistica', 'Servizio clienti', 'Analisi dati e decisioni', 'Non la utilizziamo ancora', 'Altro'] },
  { id: 'ai#leva', kind: 'LIKERT', title: "Penso che l'intelligenza artificiale possa aiutarci a rendere l'azienda meno dipendente da me." },
  { id: 'ai#pronti', kind: 'LIKERT', title: "Io e il mio team ci sentiamo preparati a introdurre l'AI nei processi aziendali." },
] as const;

export function radarSteps(): RadarStep[] {
  const areaSteps = RADAR_AREAS.flatMap((area) => area.questions.map((title, index) => ({
    id: `${area.id}#${index}`,
    kind: 'LIKERT' as const,
    title,
    areaId: area.id,
    autonomy: index === 4,
  })));
  return [...areaSteps, { id: 'qualificazione#stagionale', kind: 'SEASONAL', title: 'L’attività della tua azienda ha carattere stagionale?' }, ...AI_STEPS];
}
function score100(mean: number): number {
  return Math.round(((mean - 1) / 4) * 100);
}

function numericAnswer(answers: RadarAnswers, key: string): number {
  const value = answers[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : 3;
}

export function calculateRadarScores(answers: RadarAnswers): RadarScores {
  const areas: RadarAreaScore[] = RADAR_AREAS.map((area) => {
    const mean = area.questions.reduce((sum, _, index) => sum + numericAnswer(answers, `${area.id}#${index}`), 0) / area.questions.length;
    return { id: area.id, label: area.label, score: score100(mean) };
  });
  const ownerAutonomy = score100(RADAR_AREAS.reduce((sum, area) => sum + numericAnswer(answers, `${area.id}#4`), 0) / RADAR_AREAS.length);
  const organizationalMaturity = Math.round(areas.reduce((sum, area) => sum + area.score, 0) / areas.length);
  const ai = score100((numericAnswer(answers, 'ai#uso') + numericAnswer(answers, 'ai#leva') + numericAnswer(answers, 'ai#pronti')) / 3);
  const ordered = [...areas].sort((left, right) => right.score - left.score);
  return {
    areas,
    ownerAutonomy,
    organizationalMaturity,
    global: Math.round((ownerAutonomy + organizationalMaturity) / 2),
    autonomyGap: organizationalMaturity - ownerAutonomy,
    ai,
    seasonal: answers['qualificazione#stagionale'] === 1,
    strongestArea: ordered[0]!,
    weakestArea: ordered.at(-1)!,
  };
}
