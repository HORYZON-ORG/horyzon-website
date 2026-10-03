"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_PAYMENT_VERIFY_ATTEMPTS,
  PAYMENT_VERIFY_POLL_MS,
  PAYMENT_VERIFY_TIMEOUT_MESSAGE,
  fetchAnnunci10xFulfillmentStatus,
  fetchAnnunci10xPremiumOutput,
  generateAnnunci10xPremiumOutput,
  isAnnunci10xPaymentVerificationStopState,
  requestAnnunci10xPremiumEdit,
  shouldPollAnnunci10xPaymentVerification,
  shouldReturnToAnnunci10xCreate,
  type PremiumCheckoutNotice,
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

export function Annunci10xFulfillmentPanel({
  checkoutNotice,
  onCreateReturn,
}: {
  checkoutNotice: PremiumCheckoutNotice;
  onCreateReturn?: () => void;
}) {
  const [status, setStatus] = useState<PremiumFulfillmentStatus | null>(null);
  const [output, setOutput] = useState<PremiumOutput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [manualRetryAvailable, setManualRetryAvailable] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [paymentVerifyTimedOut, setPaymentVerifyTimedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const generatedForCycle = useRef(false);
  const createReturnNotified = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  const notifyCreateReturn = useCallback((nextStatus: PremiumFulfillmentStatus) => {
    if (!shouldReturnToAnnunci10xCreate(checkoutNotice, nextStatus.flow) || createReturnNotified.current) return;
    createReturnNotified.current = true;
    onCreateReturn?.();
  }, [checkoutNotice, onCreateReturn]);

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
    setPaymentVerifyTimedOut(false);
    try {
      const result = await generateAnnunci10xPremiumOutput();
      setOutput(result);
      setStatus((current) => current ? { ...current, state: result.validationState === 'READY' || result.validationState === 'READY_WITH_WARNINGS' ? 'READY' : 'NEEDS_REVIEW', canGenerate: false, outputAvailable: true } : current);
      await refresh();
    } catch (cause) {
      const safe = generationMessage(cause);
      setMessage(safe.message);
      setManualRetryAvailable(Boolean(safe.retry));
      if (safe.state) {
        const nextState = safe.state;
        setPollTimedOut(false);
        setStatus((current) => current ? { ...current, state: nextState, canGenerate: false } : current);
      }
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
      refresh(checkoutNotice === 'success')
        .then((nextStatus) => {
          if (cancelled) return;
          notifyCreateReturn(nextStatus);
        })
        .catch(() => {
          if (!cancelled) setMessage('Serve aiuto? Scrivi a info@horyzon.it');
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkoutNotice, notifyCreateReturn, refresh]);

  useEffect(() => {
    if (checkoutNotice === 'cancelled' || status?.state !== 'READY_TO_GENERATE' || !status.canGenerate || generatedForCycle.current) return;
    generatedForCycle.current = true;
    void startGeneration();
  }, [checkoutNotice, startGeneration, status?.canGenerate, status?.state]);

  useEffect(() => {
    if (!shouldPollAnnunci10xPaymentVerification(checkoutNotice, status?.state)) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pollPayment() {
      attempts += 1;
      try {
        const nextStatus = await fetchAnnunci10xFulfillmentStatus();
        if (cancelled) return;
        setStatus(nextStatus);
        notifyCreateReturn(nextStatus);
        if (isAnnunci10xPaymentVerificationStopState(nextStatus.state)) {
          setPaymentVerifyTimedOut(false);
          if (checkoutNotice === 'success') focusPanel(panelRef.current);
          if (nextStatus.state === 'READY' || nextStatus.state === 'NEEDS_REVIEW') {
            const nextOutput = await fetchAnnunci10xPremiumOutput();
            if (!cancelled) setOutput(nextOutput);
          }
          return;
        }
      } catch {
        // Payment reconciliation can be briefly delayed after Stripe redirects.
      }
      if (!cancelled && attempts < MAX_PAYMENT_VERIFY_ATTEMPTS) timer = setTimeout(pollPayment, PAYMENT_VERIFY_POLL_MS);
      if (!cancelled && attempts >= MAX_PAYMENT_VERIFY_ATTEMPTS) setPaymentVerifyTimedOut(true);
    }

    timer = setTimeout(pollPayment, PAYMENT_VERIFY_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkoutNotice, notifyCreateReturn, status?.state]);

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
  const state = status?.state ?? 'NONE';
  if (state === 'NONE' && checkoutNotice !== 'success' && checkoutNotice !== 'cancelled') return null;
  const checkoutCancelledBeforeGeneration = checkoutNotice === 'cancelled' && state === 'READY_TO_GENERATE';

  async function copyAd() {
    const text = primarySections.map((section) => [section.title, section.body].filter((part) => part.trim().length > 0).join('\n')).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopyMessage('Annuncio copiato.');
  }

  const reviseSection = useCallback(async (sectionId: string, instruction: string): Promise<PremiumEditResult> => {
    const result = await requestAnnunci10xPremiumEdit({ editRequest: instruction, targetSectionId: sectionId });
    if (result.status === 'REVISION_APPLIED' && result.output) {
      setOutput(result.output);
      setStatus((current) => current ? { ...current, state: 'READY', outputAvailable: true, canGenerate: false } : current);
    }
    return result;
  }, []);

  return <section ref={panelRef} tabIndex={-1} className={styles.fulfillmentPanel} aria-labelledby="annunci10x-fulfillment-title" aria-live="polite">
    {state === 'PAYMENT_CONFIRMED' && <StatusBlock title="Pagamento registrato" body="Il tuo Annuncio 10x è al sicuro. La generazione è temporaneamente non disponibile. Non perderai il tuo acquisto." />}
    {checkoutNotice === 'success' && state === 'NONE' && <StatusBlock title="Stiamo ancora verificando il pagamento" body="Non sblocchiamo nulla dal browser: aggiorniamo lo stato appena il server conferma." loaderLabel="Verifichiamo il pagamento" />}
    {checkoutCancelledBeforeGeneration && <StatusBlock title="Pagamento annullato" body="Non è stata avviata alcuna generazione." />}
    {state === 'READY_TO_GENERATE' && !checkoutCancelledBeforeGeneration && <PreparingBlock loading={loading} />}
    {state === 'PREPARING' && <PreparingBlock loading />}
    {state === 'READY' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Pronto da usare" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} canRevise={canClientRevise} onRevise={reviseSection} />}
    {state === 'NEEDS_REVIEW' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Da verificare prima della pubblicazione" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} canRevise={false} onRevise={reviseSection} />}
    {checkoutNotice === 'cancelled' && state === 'NONE' && <StatusBlock title="Pagamento annullato" body="Non è stato completato alcun acquisto." />}
    {message && <p className={styles.fulfillmentMessage}>{message}</p>}
    {manualRetryAvailable && <div className={styles.fulfillmentActions}><button type="button" onClick={() => void startGeneration()} disabled={loading}>Riprova</button></div>}
    {paymentVerifyTimedOut && <div className={styles.fulfillmentTimeout}><p>{PAYMENT_VERIFY_TIMEOUT_MESSAGE}</p><button type="button" onClick={() => { setPaymentVerifyTimedOut(false); void refresh(true); }}>Aggiorna stato</button></div>}
    {pollTimedOut && <div className={styles.fulfillmentTimeout}><p>La preparazione sta richiedendo più del previsto.</p><button type="button" onClick={() => { setPollTimedOut(false); void refresh(true); }}>Aggiorna stato</button></div>}
  </section>;
}

function StatusBlock({ title, body, loaderLabel }: { title: string; body: string; loaderLabel?: string }) {
  return <div><p className={styles.fulfillmentEyebrow}>Annuncio 10x</p><h2 id="annunci10x-fulfillment-title">{title}</h2><span>{body}</span>{loaderLabel && <Annunci10xLoader variant="compact" indeterminate label={loaderLabel} />}</div>;
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
    <p className={styles.guaranteeNote}>Garanzia: rimborso integrale entro 14 giorni dalla consegna secondo le condizioni di vendita.</p>
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
  if (/temporaneamente non disponibile|GENERATION_BLOCKED/i.test(`${message} ${code}`)) return { message: 'Il tuo acquisto è registrato. Riprova più tardi: il credito non viene perso.', retry: true };
  if (/PAYMENT_REQUIRED|Generazione Annunci 10x non autorizzata/i.test(`${message} ${code}`)) return { message: 'Stiamo ancora verificando il pagamento.', refetch: true };
  return { message: 'Serve aiuto? Scrivi a info@horyzon.it' };
}

function focusPanel(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
