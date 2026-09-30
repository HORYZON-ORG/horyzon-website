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
  shouldPollAnnunci10xPaymentVerification,
  shouldReturnToAnnunci10xCreate,
  type PremiumCheckoutNotice,
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

  const primarySections = useMemo(() => outputSections(output), [output]);
  const state = status?.state ?? 'NONE';
  if (state === 'NONE' && checkoutNotice !== 'success' && checkoutNotice !== 'cancelled') return null;
  const checkoutCancelledBeforeGeneration = checkoutNotice === 'cancelled' && state === 'READY_TO_GENERATE';

  async function copyAd() {
    const text = primarySections.map((section) => [section.title, section.body].filter((part) => part.trim().length > 0).join('\n')).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopyMessage('Annuncio copiato.');
  }

  return <section ref={panelRef} tabIndex={-1} className={styles.fulfillmentPanel} aria-labelledby="annunci10x-fulfillment-title" aria-live="polite">
    {state === 'PAYMENT_CONFIRMED' && <StatusBlock title="Pagamento registrato" body="Il tuo Annuncio 10x è al sicuro. La generazione è temporaneamente non disponibile. Non perderai il tuo acquisto." />}
    {checkoutNotice === 'success' && state === 'NONE' && <StatusBlock title="Stiamo ancora verificando il pagamento" body="Non sblocchiamo nulla dal browser: aggiorniamo lo stato appena il server conferma." loaderLabel="Verifichiamo il pagamento" />}
    {checkoutCancelledBeforeGeneration && <StatusBlock title="Pagamento annullato" body="Non è stata avviata alcuna generazione." />}
    {state === 'READY_TO_GENERATE' && !checkoutCancelledBeforeGeneration && <PreparingBlock loading={loading} />}
    {state === 'PREPARING' && <PreparingBlock loading />}
    {state === 'READY' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Pronto da usare" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} />}
    {state === 'NEEDS_REVIEW' && output && <OutputBlock output={output} title="Il tuo Annuncio 10x è pronto" badge="Da verificare prima della pubblicazione" sections={primarySections} copyMessage={copyMessage} onCopy={copyAd} />}
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
}: {
  output: PremiumOutput;
  title: string;
  badge: string;
  sections: PremiumSection[];
  copyMessage: string;
  onCopy: () => void;
}) {
  const needsReview = output.validationState === 'NEEDS_VERIFICATION' || output.validationState === 'BLOCKED';
  return <div className={styles.fulfillmentOutput}>
    <div className={styles.fulfillmentHead}>
      <div><p className={styles.fulfillmentEyebrow}>Annuncio 10x</p><h2 id="annunci10x-fulfillment-title">{title}</h2></div>
      <span data-review={needsReview}>{badge}</span>
    </div>
    {output.channelVariant && <p className={styles.channelBadge}>Canale: {output.channelVariant.channel}</p>}
    {needsReview && <p className={styles.fulfillmentMessage}>Il testo richiede una verifica prima di essere pubblicato.</p>}
    <div className={styles.outputSections}>{sections.map((section) => <article key={section.id}><h3>{section.title}</h3>{section.body.trim() && <p>{section.body}</p>}</article>)}</div>
    {needsReview && output.checklist.length > 0 && <div className={styles.reviewChecklist}><h3>Prima della pubblicazione</h3><ul>{output.checklist.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {output.rationale.length > 0 && <div className={styles.reviewChecklist}><h3>Perché è costruito così</h3><ul>{output.rationale.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div className={styles.fulfillmentActions}><button type="button" onClick={onCopy}>Copia annuncio</button><span aria-live="polite">{copyMessage}</span></div>
    <p className={styles.guaranteeNote}>Garanzia: rimborso integrale entro 14 giorni dalla consegna secondo le condizioni di vendita.</p>
  </div>;
}

function outputSections(output: PremiumOutput | null): PremiumSection[] {
  if (!output) return [];
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
