import { operatingJourney } from './site-narrative';
import { capabilityLabels, productCapabilities, RADAR_URL } from './product-truth';

// Also rendered visibly on /radar-impresa: one source for HTML and Markdown.
export const radarAnswers = [
 { question: 'Che cos’è il Radar d’Impresa?', answer: 'È una prima autovalutazione guidata di Amministrazione, Produzione, Commerciale, Marketing e Persone. Rende leggibili maturità dei processi, autonomia dal titolare e adozione dell’AI.' },
 { question: 'Il risultato è già un piano operativo?', answer: 'No. Il risultato orienta un confronto: il debrief interpreta il profilo, mentre evidenze, responsabilità e priorità vengono approfondite nel percorso Horyzon.' },
 { question: 'Qual è la differenza tra Hub e Platform?', answer: 'Hub raccoglie le evidenze della discovery e produce un Blueprint versionato da riesaminare. Platform rende leggibili KPI, snapshot, report e stato delle attivazioni. I sistemi approvati svolgono il lavoro operativo.' },
 { question: 'Le integrazioni sono già attive per ogni azienda?', answer: 'No. Accessi, autorizzazioni, configurazione e prove devono essere verificati per la singola azienda prima dell’attivazione. La presenza di una capacità non dimostra che sia già operativa nel suo contesto.' },
] as const;

export const publicGuideLinks = [
 ['Horyzon', '/horyzon', 'Identità e visione'],
 ['Metodo', '/metodo', 'Dagli obiettivi alla verifica'],
 ['Radar d’Impresa', '/radar-impresa', 'Che cosa misura e quali sono i limiti'],
 ['Sistema impresa', '/le-tre-aree', 'Cinque reparti e tre discipline'],
 ['Platform', '/piattaforma', 'Governance, indicatori ed evidenze'],
 ['Persone', '/persone', 'Profili e responsabilità'],
 ['Frank Cannoletta', '/frank', 'Persona, impresa e patrimonio'],
 ['Contatti', '/contatti', 'Radar, debrief e confronto'],
] as const;

export function publicGuideMarkdown() {
 return [
  '# Horyzon Consulting',
  '> Guida ai contenuti pubblici. Le pagine collegate sono le fonti di riferimento; questa sintesi non certifica attivazioni presso singole aziende.',
  'Horyzon collega organizzazione, responsabilità e progresso misurabile. Il nucleo è il benessere organizzativo; il digitale abilita e governa il lavoro, mentre la continuità finanziaria protegge il valore costruito.',
  '## Domande sul percorso',
  ...radarAnswers.map(({ question, answer }) => `### ${question}\n\n${answer}`),
  '## Metodo',
  ...operatingJourney.map((stage, index) => `${index + 1}. **${stage.title}** — ${stage.description}`),
  '## Capacità e limiti',
  ...productCapabilities.map(item => `- **${item.title}** (${capabilityLabels[item.state]}) — ${item.description}`),
  '## Pagine di riferimento',
  ...publicGuideLinks.map(([name, path, description]) => `- [${name}](https://horyzon.it${path}): ${description}.`),
  `- [Apri il Radar in Horyzon Hub](${RADAR_URL}).`,
  '## Contatti',
  'Horyzon Consulting · FELICITÀ srl · P. IVA 05120660757. Contatto pubblico: info@horyzon.it. Dati societari: https://horyzon.it/contatti.',
  '## Uso della sintesi',
  'Usare le pagine pubbliche collegate per contestualizzare le informazioni. Non interpretare descrizioni, esempi o direzioni evolutive come risultati garantiti o integrazioni già attivate. Questa sintesi non sostituisce le informative pubblicate né concede licenze ulteriori.',
 ].join('\n\n') + '\n';
}
