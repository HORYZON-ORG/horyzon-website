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
  const driveEmbed = /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview$/.test(videoUrl);
  const driveViewUrl = driveEmbed ? videoUrl.replace(/\/preview$/, '/view') : '';

  useEffect(() => {
    const readToken = () => {
      const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
      setToken(match?.[1] ?? '');
      setEnded(false);
      setStatus('idle');
      setNotice('');
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
        <a className={styles.headerTag} href="#startup-video" aria-label="Vai al video Startup Horyzon">STARTUP HORYZON <span aria-hidden="true">↗</span></a>
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
          {videoUrl ? driveEmbed ? (
            <iframe key={videoUrl} className={styles.video} src={videoUrl}
              title="Video della Startup Horyzon Consulting"
              referrerPolicy="no-referrer"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen loading="eager" />
          ) : (
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
              <small>La conferma sarà disponibile quando arriverà il video. I recapiti temporanei scadono dopo 7 giorni; non viene ancora creata alcuna scheda nell’Hub.</small>
            </div>
          )}
        </div>

        {driveEmbed && <p className={styles.videoFallback}>Se il video non si apre, <a href={driveViewUrl} target="_blank" rel="noopener noreferrer">guardalo direttamente su Google Drive</a> e torna qui per confermare.</p>}
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
            ) : (
              <>
                {driveEmbed && videoUrl && token && (
                  <label className={`${styles.watchAttestation} ${ended ? styles.watchAttestationReady : ''}`}>
                    <input type="checkbox" checked={ended} disabled={status === 'sending'}
                      onChange={event => setEnded(event.target.checked)} />
                    <span>Ho terminato di vedere il video della Startup.</span>
                  </label>
                )}
                {ended && videoUrl && token && (
                  <p className={styles.readyNote} role="status"><span aria-hidden="true">✓</span> Hai completato questo passaggio. Ora puoi inviare la tua adesione.</p>
                )}
                <button
                  className={styles.confirmButton}
                  type="button"
                  disabled={!videoUrl || !ended || !token || status === 'sending'}
                  onClick={() => void confirmInterest()}
                  aria-label="Ho preso visione della Startup Horyzon. Voglio essere ricontattato">
                  <span className={styles.confirmButtonText}>{status === 'sending' ? 'Registrazione della conferma…' : 'Ho preso visione della Startup Horyzon. Voglio essere ricontattato'}</span>
                  <span className={styles.confirmArrow} aria-hidden="true">↗</span>
                </button>
                {videoUrl && token && !ended && (
                  <p className={styles.confirmHint}>{driveEmbed
                    ? 'Al termine del video, conferma qui sopra di averlo visto per attivare il pulsante.'
                    : 'Il pulsante si attiverà automaticamente alla fine del video.'}</p>
                )}
                {!videoUrl && <p className={styles.confirmHint}>La presentazione non è ancora disponibile.</p>}
                {!token && videoUrl && <p className={styles.confirmHint}>Per confermare, completa prima il modulo di candidatura.</p>}
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
          <a href="#startup-video">Rivedi la presentazione <span aria-hidden="true">↗</span></a>
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
