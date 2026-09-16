export const RADAR_URL = 'https://hub.horyzon.it/radar' as const;

export type CapabilityState = 'available' | 'configured' | 'direction';

export type ProductCapability = {
  state: CapabilityState;
  title: string;
  description: string;
};

export const capabilityLabels: Record<CapabilityState, string> = {
  available: 'Disponibile oggi',
  configured: 'Configurato nel percorso',
  direction: 'Direzione evolutiva',
};

export const productCapabilities: readonly ProductCapability[] = [
  { state: 'available', title: 'Radar d’Impresa', description: 'Qualificazione pubblica e lettura di cinque reparti, maturità dei processi, autonomia del titolare e adozione dell’AI.' },
  { state: 'available', title: 'Discovery e Blueprint', description: 'Hub raccoglie evidenze, organizza lo studio operativo e produce un Blueprint versionato da riesaminare.' },
  { state: 'available', title: 'Governance in Platform', description: 'Dashboard tenant, KPI, report, snapshot, stato delle sincronizzazioni ed evidenze di attivazione.' },
  { state: 'configured', title: 'Organizzazione obiettivo', description: 'Ruoli, responsabilità, reparto prioritario, procedure, indicatori e strumenti vengono definiti nello specifico percorso aziendale.' },
  { state: 'configured', title: 'Attivazione verificata', description: 'Blueprint, piano di attivazione e sincronizzazioni avanzano dopo revisione, accessi e prove.' },
  { state: 'direction', title: 'Autonomia progressiva', description: 'L’impresa può diventare meno dipendente dal titolare attraverso responsabilità condivise e processi ripetibili, senza promesse di tempi o risultati garantiti.' },
  { state: 'direction', title: 'AI governata', description: 'L’AI sostiene il lavoro delle persone senza sostituire responsabilità, verifica e decisione umana.' },
] as const;
