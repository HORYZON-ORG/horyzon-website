"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANNUNCI10X_FULFILLMENT_REFRESH_EVENT,
  fetchAnnunci10xFulfillmentStatus,
  fetchAnnunci10xPremiumOutput,
  generateAnnunci10xPremiumOutput,
  requestAnnunci10xPremiumEdit,
  type PremiumEditResult,
  type PremiumFulfillmentState,
  type PremiumFulfillmentStatus,
  type PremiumOutput,
  type PremiumSection,
} from './annunci-10x-premium-client';
import { Annunci10xLoader } from './annunci-10x-loader';
import styles from './annunci-10x.module.css';

const POLL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

export function Annunci10xFulfillmentPanel() {
  const [status, setStatus] = useState<PremiumFulfillmentStatus | null>(null);
  const [output, setOutput] = useState<PremiumOutput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [manualRetryAvailable, setManualRetryAvailable] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const generatedForCycle = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async (focus = false) => {
    const nextStatus = await fetchAnnunci10xFulfillmentStatus();
    setStatus(nextStatus);
    if (nextStatus.outputAvailable) setOutput(await fetchAnnunci10xPremiumOutput());
    if (focus && nextStatus.state !== 'NONE') focusPanel(panelRef.current);
    return nextStatus;
  }, []);

  const startGeneration = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setManualRetryAvailable(false);
    setPollTimedOut(false);
    try {
      const result = await generateAnnunci10xPremiumOutput();
      setOutput(result);
      setStatus((current) => current ? { ...current, state: result.validationState === 'READY' || result.validationState === 'READY_WITH_WARNINGS' ? 'READY' : 'NEEDS_REVIEW', canGenerate: false, outputAvailable: true } : current);
      await refresh();
    } catch (cause) {
      const safe = generationMessage(cause);
      setMessage(safe.message);
      setManualRetryAvailable(Boolean(safe.retry));
      if (safe.state) setStatus((current) => current ? { ...current, state: safe.state!, canGenerate: false } : current);
      if (safe.refetch) {
        try {
          await refresh();
        } catch {
          // The visible message already gives the customer-safe next step.
        }
      }
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      refresh().catch(() => {
        if (!cancelled) setMessage('Serve aiuto? Scrivi a info@horyzon.it');
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const handleRefresh = () => {
      generatedForCycle.current = true;
      void refresh(true);
    };
    window.addEventListener(ANNUNCI10X_FULFILLMENT_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(ANNUNCI10X_FULFILLMENT_REFRESH_EVENT, handleRefresh);
  }, [refresh]);

  useEffect(() => {
    if (status?.state !== 'READY_TO_GENERATE' || !status.canGenerate || generatedForCycle.current) return;
    generatedForCycle.current = true;
    void startGeneration();
  }, [startGeneration, status?.canGenerate, status?.state]);

  useEffect(() => {
    if (status?.state !== 'PREPARING') return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      attempts += 1;
      try {
        const nextStatus = await fetchAnnunci10xFulfillmentStatus();
        if (cancelled) return;
        setStatus(nextStatus);
        if (nextStatus.state === 'READY' || nextStatus.state === 'NEEDS_REVIEW') {
          setOutput(await fetchAnnunci10xPremiumOutput());
          return;
        }
      } catch {
        // Keep polling until the bounded retry budget is exhausted.
      }
      if (!cancelled && attempts < MAX_POLL_ATTEMPTS) timer = setTimeout(poll, POLL_MS);
      if (!cancelled && attempts >= MAX_POLL_ATTEMPTS) setPollTimedOut(true);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [status?.state]);

  const canClientRevise = status?.flow === 'CREATE';
  const primarySections = useMemo(() => outputSections(output, canClientRevise), [output, canClientRevise]);

  const reviseSection = useCallback(async (sectionId: string, instruction: string): Promise<PremiumEditResult> => {
    const result = await requestAnnunci10xPremiumEdit({ editRequest: instruction, targetSectionId: sectionId });
    if (result.status === 'REVISION_APPLIED' && result.output) {
      setOutput(result.output);
      setStatus((current) => current ? { ...current, state: 'READY', outputAvailable: true, canGenerate: false } : current);
    }
    return result;
  }, []);

  const state = status?.state ?? 'NONE';
  if (state === 'NONE') return null;

  async function copyAd() {
    const text = primarySections.map((section) => [section.title, section.body].filter((part) => part.trim().length > 0).join('\n')).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopyMessage('Annuncio copiato.');
  }

  return <section ref={panelRef} tabIndex={-1} className={styles.fulfillmentPanel} aria-labelledby="annunci10x-fulfillment-title" aria-live="polite">
    {state === 'READY_TO_GENERATE' && <PreparingBlock loading={loading} />}
    {state === 'PREPARING' && <PreparingBlock loading />}
    {state === 'READY' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Pronto da usare" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} canRevise={canClientRevise} onRevise={reviseSection} />}
    {state === 'NEEDS_REVIEW' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Da verificare prima della pubblicazione" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} canRevise={false} onRevise={reviseSection} />}
    {message && <p className={styles.fulfillmentMessage}>{message}</p>}
    {manualRetryAvailable && <div className={styles.fulfillmentActions}><button type="button" onClick={() => void startGeneration()} disabled={loading}>Riprova</button></div>}
    {pollTimedOut && <div className={styles.fulfillmentTimeout}><p>La preparazione sta richiedendo più del previsto.</p><button type="button" onClick={() => { setPollTimedOut(false); void refresh(true); }}>Aggiorna stato</button></div>}
  </section>;
}

function PreparingBlock({ loading }: { loading: boolean }) {
  return <div>
    <p className={styles.fulfillmentEyebrow}>Annuncio 10x</p>
    <h2 id="annunci10x-fulfillment-title">Stiamo preparando il tuo Annuncio 10x</h2>
    <span>{loading ? 'La generazione è in corso. Non chiudere questa pagina se puoi.' : 'Avvio generazione in corso.'}</span>
    <Annunci10xLoader variant="panel" indeterminate label={loading ? 'Riscriviamo il testo' : 'Prepariamo la generazione'} />
    <ol className={styles.fulfillmentSteps}><li>Costruiamo il testo</li><li>Verifichiamo i fatti</li><li>Adattiamo il canale</li></ol>
  </div>;
}

function OutputBlock({
  output,
  title,
  badge,
  sections,
  copyMessage,
  onCopy,
  canRevise,
  onRevise,
}: {
  output: PremiumOutput;
  title: string;
  badge: string;
  sections: PremiumSection[];
  copyMessage: string;
  onCopy: () => void;
  canRevise: boolean;
  onRevise: (sectionId: string, instruction: string) => Promise<PremiumEditResult>;
}) {
  const needsReview = output.validationState === 'NEEDS_VERIFICATION' || output.validationState === 'BLOCKED';
  const revisionLimit = output.clientRevisionLimit || 3;
  const revisionCount = Math.min(output.clientRevisionCount || 0, revisionLimit);
  const revisionRemaining = Math.max(0, revisionLimit - revisionCount);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [revisionMessage, setRevisionMessage] = useState('');
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    if (selectedSectionId && !sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(null);
      setInstruction('');
    }
  }, [sections, selectedSectionId]);

  async function submitRevision(sectionId: string) {
    const request = instruction.trim();
    if (!request || revising) return;
    setRevising(true);
    setRevisionMessage('');
    try {
      const result = await onRevise(sectionId, request);
      if (result.status === 'REVISION_APPLIED') {
        const used = result.revisionCount ?? revisionCount + 1;
        setRevisionMessage(`Modifica applicata · ${used}/${result.revisionLimit ?? revisionLimit} utilizzate.`);
        setSelectedSectionId(null);
        setInstruction('');
      } else if (result.status === 'REVISION_LIMIT_REACHED') {
        setRevisionMessage('Hai utilizzato le 3 modifiche incluse per questo annuncio.');
      } else if (result.status === 'REVISION_BLOCKED') {
        setRevisionMessage(result.reason || 'Questa modifica cambierebbe informazioni confermate. Prova a chiedere una modifica di tono o chiarezza.');
      } else {
        setRevisionMessage('Questa richiesta richiede una verifica diversa. Il testo attuale non è stato modificato.');
      }
    } catch {
      setRevisionMessage('Non siamo riusciti ad applicare la modifica. Il testo attuale è rimasto invariato.');
    } finally {
      setRevising(false);
    }
  }

  return <div className={styles.fulfillmentOutput}>
    <div className={styles.fulfillmentHead}>
      <div><p className={styles.fulfillmentEyebrow}>Annuncio 10x</p><h2 id="annunci10x-fulfillment-title">{title}</h2></div>
      <span data-review={needsReview}>{badge}</span>
    </div>
    {output.channelVariant && !canRevise && <p className={styles.channelBadge}>Canale: {output.channelVariant.channel}</p>}
    {needsReview && <p className={styles.fulfillmentMessage}>Il testo richiede una verifica prima di essere pubblicato.</p>}

    {canRevise && !needsReview && <div className={styles.revisionIntro}>
      <div>
        <strong>Rifiniscilo come vuoi.</strong>
        <p>Hai fino a 3 modifiche mirate incluse. Seleziona una sezione e dimmi cosa vuoi cambiare: i fatti confermati restano protetti.</p>
      </div>
      <span className={styles.revisionCounter} data-complete={revisionRemaining === 0}>{revisionCount}/{revisionLimit}</span>
    </div>}

    <div className={styles.outputSections}>{sections.map((section) => {
      const isEditing = selectedSectionId === section.id;
      return <article key={section.id} className={isEditing ? styles.outputSectionEditing : undefined}>
        <div className={styles.outputSectionHead}>
          <h3>{section.title}</h3>
          {canRevise && !needsReview && revisionRemaining > 0 && <button
            type="button"
            className={styles.sectionEditButton}
            aria-expanded={isEditing}
            onClick={() => {
              setSelectedSectionId(isEditing ? null : section.id);
              setInstruction('');
              setRevisionMessage('');
            }}
          >{isEditing ? 'Chiudi' : 'Modifica'}</button>}
        </div>
        {section.body.trim() && <p className={styles.outputSectionBody}>{section.body}</p>}
        {isEditing && <div className={styles.sectionRevisionEditor}>
          <label htmlFor={`annunci10x-revision-${section.id}`}>Cosa vuoi cambiare in questa sezione?</label>
          <textarea
            id={`annunci10x-revision-${section.id}`}
            value={instruction}
            maxLength={600}
            rows={4}
            autoFocus
            placeholder="Es. Rendila più diretta e discorsiva, senza cambiare le informazioni."
            onChange={(event) => setInstruction(event.target.value)}
          />
          <div className={styles.sectionRevisionActions}>
            <button type="button" onClick={() => void submitRevision(section.id)} disabled={revising || !instruction.trim()}>
              {revising ? 'Applico la modifica…' : 'Applica modifica'}
            </button>
            <button type="button" className={styles.sectionRevisionCancel} onClick={() => { setSelectedSectionId(null); setInstruction(''); }} disabled={revising}>Annulla</button>
          </div>
          <small>La modifica usa 1 delle {revisionLimit} revisioni incluse solo se viene applicata.</small>
        </div>}
      </article>;
    })}</div>

    {canRevise && revisionRemaining === 0 && <p className={styles.revisionLimitMessage}>Hai utilizzato le 3 modifiche incluse. Questo è il tuo testo finale.</p>}
    {revisionMessage && <p className={styles.revisionFeedback} aria-live="polite">{revisionMessage}</p>}
    {needsReview && output.checklist.length > 0 && <div className={styles.reviewChecklist}><h3>Prima della pubblicazione</h3><ul>{output.checklist.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {output.rationale.length > 0 && <div className={styles.reviewChecklist}><h3>Perché è costruito così</h3><ul>{output.rationale.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div className={styles.fulfillmentActions}><button type="button" onClick={onCopy}>Copia annuncio</button><span aria-live="polite">{copyMessage}</span></div>
    <p className={styles.guaranteeNote}>Generazione gratuita · nessuna carta di credito.</p>
  </div>;
}

function outputSections(output: PremiumOutput | null, preferMaster = false): PremiumSection[] {
  if (!output) return [];
  if (preferMaster) return output.master.sections;
  return output.channelVariant?.sections?.length ? output.channelVariant.sections : output.master.sections;
}

function generationMessage(cause: unknown): { message: string; state?: PremiumFulfillmentState; refetch?: boolean; retry?: boolean } {
  const message = cause instanceof Error ? cause.message : '';
  const code = typeof cause === 'object' && cause !== null && typeof (cause as { code?: unknown }).code === 'string' ? (cause as { code: string }).code : '';
  if (/già in preparazione/i.test(message)) return { message: '', state: 'PREPARING' };
  if (/temporaneamente non disponibile|GENERATION_BLOCKED/i.test(`${message} ${code}`)) return { message: 'La generazione è temporaneamente non disponibile. Riprova tra poco.', retry: true };
  if (/Generazione Annunci 10x non autorizzata|EMAIL_VERIFICATION_REQUIRED/i.test(`${message} ${code}`)) return { message: 'Verifica la tua email per generare gratuitamente l’annuncio.', refetch: true };
  return { message: 'Serve aiuto? Scrivi a info@horyzon.it' };
}

function focusPanel(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
