'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import header from './patrimonial-architect-header.module.css';
import styles from './patrimonial-architect-startup.module.css';

type Status = 'idle' | 'sending' | 'success' | 'error';

export function ArchitectStartupPresentation({ videoUrl }: { videoUrl: string }) {
  const [token, setToken] = useState('');
  const [ended, setEnded] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const readToken = () => {
      const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
      setToken(match?.[1] ?? '');
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, []);

  async function confirmInterest() {
    if (!ended || !videoUrl || !token || status === 'sending' || status === 'success') return;
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
      setNotice('La tua conferma è stata registrata. Il team Horyzon potrà contattarti per valutare insieme i prossimi passi.');
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
        <span className={styles.headerTag}>STARTUP HORYZON</span>
      </div>
    </header>

    <main>
      <section className={styles.hero} aria-labelledby="startup-title">
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroLines} aria-hidden="true"><span /><span /><span /></div>
        <div className={styles.heroInner}>
          <div className={styles.kicker}><span className={styles.kickerDot} /> FASE FINALE DELLA CANDIDATURA</div>
          <h1 id="startup-title">Prima di scegliere un percorso,<br /><em>conosci chi lo sta costruendo.</em></h1>
          <p>Una presentazione di Horyzon Consulting: la visione, il progetto e il ruolo delle persone che ne faranno parte. Guarda il video, poi decidi liberamente se vuoi proseguire.</p>
          <div className={styles.heroMeta}>
            <span>01 / Conosci Horyzon</span>
            <span>02 / Ascolta la presentazione</span>
            <span>03 / Conferma la tua scelta</span>
          </div>
        </div>
      </section>

      <section className={styles.presentation} aria-labelledby="startup-video-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>LA PRESENTAZIONE</span>
          <h2 id="startup-video-title">Un progetto da conoscere.<br /><span>Una scelta da fare consapevolmente.</span></h2>
          <p>Questo passaggio ti permette di conoscere la startup Horyzon prima che il nostro team ti ricontatti per un eventuale colloquio.</p>
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
              onEnded={() => setEnded(true)} onError={() => setVideoError(true)}
              aria-label="Presentazione della startup Horyzon Consulting">
              Il browser non supporta la riproduzione del video.
            </video>
          ) : (
            <div className={styles.videoPlaceholder}>
              <span className={styles.playSymbol} aria-hidden="true">▶</span>
              <strong>Startup Horyzon</strong>
              <p>Qui sarà inserito il video ufficiale della presentazione.</p>
              <small>Il percorso di conferma sarà attivato con il video definitivo.</small>
            </div>
          )}
        </div>

        {videoError && <p className={styles.error} role="alert">Il video non è disponibile al momento. Non è stata registrata alcuna conferma.</p>}

        <div className={styles.confirmPanel}>
          <div className={styles.confirmIntro}>
            <span className={styles.eyebrow}>LA TUA DECISIONE</span>
            <h2>Ti riconosci in questo progetto?</h2>
            <p>Confermare significa dichiarare il tuo interesse a essere contattato, non essere già stato selezionato o assunto. La valutazione del profilo resta a cura del team Horyzon.</p>
          </div>
          <div className={styles.confirmAction}>
            {status === 'success' ? (
              <div className={styles.success} role="status">
                <strong>✓ Candidatura completata</strong>
                <p>{notice}</p>
              </div>
            ) : videoUrl && ended && token ? (
              <>
                <button className={styles.confirmButton} type="button" disabled={status === 'sending'} onClick={() => void confirmInterest()}>
                  {status === 'sending' ? 'Registrazione della conferma…' : 'Ho preso visione della startup. Voglio proseguire con Horyzon'}
                  <span aria-hidden="true">↗</span>
                </button>
                <small>Riceveremo la conferma nella scheda della tua candidatura.</small>
              </>
            ) : (
              <div className={styles.locked}>
                <span aria-hidden="true">◷</span>
                <p>{!videoUrl ? 'Presentazione in preparazione.' : !token ? 'Per confermare torna al modulo iniziale e completa la candidatura.' : 'Il pulsante di conferma comparirà al termine del video.'}</p>
              </div>
            )}
            {status === 'error' && <p className={styles.error} role="alert">{notice}</p>}
          </div>
        </div>
      </section>

      <section className={styles.values} aria-label="I tre passaggi del percorso">
        <div><span>01</span><h3>Conosci la visione</h3><p>Scopri da dove nasce il progetto e quali obiettivi vuole perseguire.</p></div>
        <div><span>02</span><h3>Comprendi il percorso</h3><p>Approfondisci il modello, il metodo e il ruolo dell’Architetto Patrimoniale.</p></div>
        <div><span>03</span><h3>Scegli consapevolmente</h3><p>Se ti riconosci in quello che hai ascoltato, comunica il tuo interesse al team.</p></div>
      </section>
    </main>

    <footer className={styles.footer}><span>HORYZON CONSULTING · BENESSERE PATRIMONIALE</span><a href="/privacy-policy">Privacy</a></footer>
  </div>;
}
