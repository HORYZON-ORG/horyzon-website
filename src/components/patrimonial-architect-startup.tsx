'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import header from './patrimonial-architect-header.module.css';
import styles from './patrimonial-architect-startup.module.css';

type Status = 'idle' | 'sending' | 'success' | 'error';

export function ArchitectStartupPresentation({ videoUrl }: { videoUrl: string }) {
  const [token, setToken] = useState('');
  const [gateReady, setGateReady] = useState(false);
  const [watchAcknowledged, setWatchAcknowledged] = useState(false);
  const [gateProblem, setGateProblem] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const readToken = () => {
      const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
      setToken(match?.[1] ?? '');
      setGateReady(false);
      setWatchAcknowledged(false);
      setGateProblem(false);
      setStatus('idle');
      setNotice('');
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, []);

  useEffect(() => {
    if (!token || !videoUrl) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function verifyServerGate() {
      if (!active) return;
      try {
        const response = await fetch('/api/architect-startup/video-gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(15000),
        });
        const result: { ok?: boolean; remainingSeconds?: number } = await response.json();
        if (!active) return;
        if (!response.ok || result.ok !== true ||
            typeof result.remainingSeconds !== 'number' ||
            !Number.isInteger(result.remainingSeconds) ||
            result.remainingSeconds < 0 || result.remainingSeconds > 661) {
          setGateProblem(true);
          retry = setTimeout(() => void verifyServerGate(), 15000);
          return;
        }
        setGateProblem(false);
        if (result.remainingSeconds === 0) {
          setGateReady(true);
          return;
        }
        setGateReady(false);
        // The server owns the start time. This timeout is only a UI refresh;
        // it does not authorize confirmation or persist elapsed time.
        retry = setTimeout(() => void verifyServerGate(),
          result.remainingSeconds * 1000 + 1200);
      } catch {
        if (!active) return;
        setGateProblem(true);
        retry = setTimeout(() => void verifyServerGate(), 15000);
      }
    }

    void verifyServerGate();
    return () => {
      active = false;
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [token, videoUrl]);

  async function confirmInterest() {
    if (!gateReady || !watchAcknowledged || !videoUrl || !token || status === 'sending' || status === 'success') return;
    setStatus('sending'); setNotice('');
    try {
      const response = await fetch('/api/architect-startup/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(15000),
      });
      const result: { ok?: boolean; message?: string } = await response.json();
      if (!response.ok || result.ok !== true) {
        setStatus('error');
        setNotice(result.message ?? 'Conferma non registrata. Riprova.');
        return;
      }
      setStatus('success');
      setNotice('Grazie. La tua richiesta di ricontatto è stata registrata nella Selezione Architetti Horyzon, con data e ora della conferma.');
    } catch {
      setStatus('error');
      setNotice('Connessione non disponibile: riprova, senza inviare una nuova candidatura.');
    }
  }

  return <div className={styles.page}>
    <header className={header.band}>
      <div className={header.inner}>
        <a className={header.brand} href="/candidature/architetti-patrimoniali" aria-label="Horyzon Consulting · Benessere Patrimoniale">
          <span className={header.logoWrap}><Image className={header.logo} src="/horyzon-logo-canonical.png" width={1670} height={390} sizes="190px" alt="Horyzon Consulting" /></span>
          <span className={header.rule} aria-hidden="true" />
          <span className={header.division}>BENESSERE PATRIMONIALE</span>
        </a>
        <button className={styles.headerTag} type="button" onClick={() => document.getElementById('startup-video')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Vai al video Startup Horyzon">STARTUP HORYZON <span aria-hidden="true">↗</span></button>
      </div>
    </header>

    <main>
      <section className={styles.hero} aria-labelledby="startup-title">
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroLines} aria-hidden="true"><span /><span /><span /></div>
        <div className={styles.heroInner}>
          <div className={styles.kicker}><span className={styles.kickerDot} /> PRESENTAZIONE STARTUP HORYZON</div>
          <h1 id="startup-title">Prima di scegliere un percorso,<br /><em>conosci chi lo sta costruendo.</em></h1>
          <p>Una presentazione di Horyzon Consulting: la visione, il progetto e il ruolo delle persone che ne faranno parte. Guarda il video, poi decidi liberamente se vuoi proseguire.</p>
          <div className={styles.heroMeta}>
            <span>01 / Conosci Horyzon</span>
            <span>02 / Ascolta la presentazione</span>
            <span>03 / Conferma la tua scelta</span>
          </div>
        </div>
      </section>

      <section id="startup-video" className={styles.presentation} aria-labelledby="startup-video-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>LA PRESENTAZIONE</span>
          <h2 id="startup-video-title">Un progetto da conoscere.<br /><span>Una scelta da fare consapevolmente.</span></h2>
          <p>Guarda la presentazione completa. Alla fine potrai decidere se chiedere al team Horyzon di contattarti.</p>
        </div>

        <div className={styles.videoWrap}>
          <div className={styles.videoHeader}>
            <span className={styles.videoLed} aria-hidden="true" />
            <span>HORYZON CONSULTING / STARTUP</span>
            <span className={styles.videoNote}>PRESENTAZIONE</span>
          </div>
          {videoUrl ? (
            <video key={videoUrl} className={styles.video} src={videoUrl} controls playsInline preload="metadata"
              poster="/benessere-patrimoniale/percorso-architetto/skyline.jpg"
              onError={() => setVideoError(true)}
              aria-label="Presentazione della startup Horyzon Consulting">
              Il browser non supporta la riproduzione del video.
            </video>
          ) : (
            <div className={styles.videoPlaceholder}>
              <span className={styles.playSymbol} aria-hidden="true">▶</span>
              <strong>Startup Horyzon</strong>
              <p>Qui sarà inserito il video ufficiale della presentazione.</p>
              <small>La conferma sarà disponibile quando arriverà il video. I recapiti temporanei scadono dopo 7 giorni; non viene ancora creata alcuna scheda nell’Hub.</small>
            </div>
          )}
        </div>

        {videoError && <p className={styles.error} role="alert">Il video non è disponibile al momento. Non è stata registrata alcuna conferma.</p>}

        <div className={styles.confirmPanel}>
          <div className={styles.confirmIntro}>
            <span className={styles.eyebrow}>LA TUA DECISIONE</span>
            <h2>Ti riconosci in questo progetto?</h2>
          </div>
          <div className={styles.confirmAction}>
            {status === 'success' ? (
              <div className={styles.success} role="status">
                <strong>✓ Richiesta di ricontatto registrata</strong>
                <p>{notice}</p>
              </div>
            ) : !watchAcknowledged ? (
              <>
                <button
                  className={styles.confirmButton}
                  type="button"
                  disabled={!videoUrl || !gateReady || !token}
                  onClick={() => setWatchAcknowledged(true)}>
                  <span className={styles.confirmButtonText}>Ho completato la visione del video e vado avanti</span>
                  <span className={styles.confirmArrow} aria-hidden="true">↗</span>
                </button>
                {gateReady && token && videoUrl ? (
                  <p className={styles.readyNote} role="status"><span aria-hidden="true">✓</span> Puoi confermare la visione e proseguire.</p>
                ) : (
                  <p className={styles.confirmHint}>
                    {!videoUrl ? 'La presentazione non è ancora disponibile.' :
                     !token ? 'Per proseguire completa prima il modulo di candidatura.' :
                     gateProblem ? 'Verifica temporaneamente non disponibile. La pagina riproverà automaticamente.' :
                     'Guarda la presentazione. Il pulsante si abiliterà automaticamente quando potrai proseguire.'}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className={styles.readyNote} role="status"><span aria-hidden="true">✓</span> Hai confermato la visione. Ora puoi scegliere se richiedere un ricontatto.</p>
                <button
                  className={styles.confirmButton}
                  type="button"
                  disabled={status === 'sending'}
                  onClick={() => void confirmInterest()}>
                  <span className={styles.confirmButtonText}>{status === 'sending'
                    ? 'Registrazione della richiesta…'
                    : 'Voglio essere ricontattato da un Architetto Patrimoniale Horyzon'}</span>
                  <span className={styles.confirmArrow} aria-hidden="true">↗</span>
                </button>
              </>
            )}
            {status === 'error' && <p className={styles.error} role="alert">{notice}</p>}
          </div>
        </div>
      </section>

      <section className={styles.values} aria-labelledby="startup-path-title">
        <div className={styles.valuesOrbit} aria-hidden="true" />
        <div className={styles.valuesInner}>
          <div className={styles.valuesHeading}>
            <span className={styles.valuesEyebrow}>IL PERCORSO HORYZON <span aria-hidden="true">/ 01—03</span></span>
            <h2 id="startup-path-title">Conosci il progetto.<br /><em>La scelta è tua.</em></h2>
          </div>
          <div className={styles.valuesSteps}>
            <div className={styles.valueStep}>
              <div className={styles.valueTop}><span className={styles.valueNumber}>01</span><span className={styles.valueLine} aria-hidden="true" /></div>
              <h3>Conosci la visione</h3>
              <p>Scopri le persone e le idee da cui nasce Horyzon.</p>
            </div>
            <div className={styles.valueStep}>
              <div className={styles.valueTop}><span className={styles.valueNumber}>02</span><span className={styles.valueLine} aria-hidden="true" /></div>
              <h3>Comprendi il percorso</h3>
              <p>Esplora il metodo e il ruolo dell’Architetto Patrimoniale.</p>
            </div>
            <div className={styles.valueStep}>
              <div className={styles.valueTop}><span className={styles.valueNumber}>03</span><span className={styles.valueLine} aria-hidden="true" /></div>
              <h3>Scegli consapevolmente</h3>
              <p>Decidi tu se fare il prossimo passo insieme a noi.</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <a className={styles.footerBrand} href="/candidature/architetti-patrimoniali" aria-label="Horyzon Consulting, pagina Architetti Patrimoniali">
          <span className={styles.footerLogoWrap}><Image src="/horyzon-logo-canonical.png" width={1670} height={390} sizes="190px" alt="Horyzon Consulting" /></span>
          <span className={styles.footerBrandRule} aria-hidden="true" />
          <span className={styles.footerDivision}>BENESSERE PATRIMONIALE</span>
        </a>
        <nav className={styles.footerNav} aria-label="Collegamenti Startup Horyzon">
          <button type="button" onClick={() => document.getElementById('startup-video')?.scrollIntoView({ behavior: 'smooth' })}>Rivedi la presentazione <span aria-hidden="true">↗</span></button>
          <a href="/privacy-policy">Privacy <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      <div className={styles.footerBase}>
        <span>HORYZON CONSULTING</span>
        <span>Visione. Persone. Futuro.</span>
      </div>
    </footer>
  </div>;
}
