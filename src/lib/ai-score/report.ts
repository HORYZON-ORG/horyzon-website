import type { FreeAuditResult, RemediationItem } from './types';

export function priorityItems(audit: FreeAuditResult): RemediationItem[] {
  const rank = { critical: 0, important: 1, optimization: 2 };
  return [...(audit.details?.remediationSummary ?? [])].sort((a, b) => rank[a.priority] - rank[b.priority] || b.scoreImpact - a.scoreImpact || a.checkId.localeCompare(b.checkId));
}

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
  } catch { /* A malformed source remains visible as text, never as a link. */ }
}

export function reportLimits(audit: FreeAuditResult): { title: string; description: string }[] {
  const limits: { title: string; description: string }[] = [];
  const details = audit.details;
  if (!details) return [{ title: 'Dettagli non disponibili', description: 'Questo report contiene il riepilogo di una scansione precedente. I controlli dettagliati non erano inclusi nel risultato: non possono essere ricostruiti senza una nuova analisi.' }];
  limits.push({ title: 'Campione del sito', description: `${details.crawlSummary.pagesFetched} ${details.crawlSummary.pagesFetched === 1 ? 'pagina analizzata' : 'pagine analizzate'}, con un limite di ${details.crawlSummary.requestedLimit}. ${details.crawlSummary.pagesFailed} tentativi non riusciti. La scansione legge l’HTML ricevuto e non esegue il codice JavaScript: non verifica tutte le pagine o tutti i comportamenti del sito.` });
  const unknown = details.checks.filter(check => !check.measured && check.status !== 'not_applicable');
  if (unknown.length) limits.push({ title: `${unknown.length} controlli non misurati`, description: unknown.map(check => check.label).join('; ') + '. Non equivalgono a controlli falliti.' });
  const coverage = audit.visibility.coverageDetail;
  if (audit.visibility.state !== 'measured') limits.push({ title: audit.visibility.score === null ? 'Visibilità AI non misurata' : 'Visibilità AI parziale', description: `${coverage ? `${coverage.successfulObservations} osservazioni valide su ${coverage.plannedPrompts} ricerche previste; copertura ${coverage.value}%. ` : ''}${audit.visibility.blocker ?? 'Il campione disponibile non copre tutte le misure previste.'}` });
  const measuredProviders = new Set((audit.visibility.observations ?? audit.visibility.evidence).filter(item => item.status === 'SUCCESS' || item.status === 'PARTIAL').map(item => item.providerId ?? item.provider));
  const missing = (audit.visibility.providerCandidates ?? []).filter(provider => !measuredProviders.has(provider.id));
  if (missing.length) limits.push({ title: 'Servizi AI non osservati', description: missing.map(provider => provider.label).join(', ') + '. Non possiamo dedurre come rispondano questi servizi dai risultati degli altri.' });
  if (details.externalBrandFootprint.state !== 'measured') limits.push({ title: 'Presenza esterna ' + (details.externalBrandFootprint.state === 'partial' ? 'parziale' : 'non misurata'), description: details.externalBrandFootprint.blocker ?? 'Non sono disponibili evidenze complete sulle menzioni e sulle fonti esterne indipendenti.' });
  if (details.potentialScore.state !== 'calculated') limits.push({ title: 'Punteggio dopo gli interventi non calcolato', description: 'Gli interventi proposti non sono stati eseguiti e verificati. Il loro effetto richiede una verifica successiva: non mostriamo un punteggio futuro come se fosse già misurato.' });
  return limits;
}
