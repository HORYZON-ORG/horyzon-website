'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
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
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recheckGateRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    const resumeFromCookie = async () => {
      try {
        const response = await fetch('/api/architect-startup/resume', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok || !active || window.location.hash) return;
        const result: { ok?: boolean; token?: string } = await response.json();
        if (!active || result.ok !== true ||
          !result.token || !/^[A-Za-z0-9_-]{43}$/.test(result.token) ||
          window.location.hash) return;
        // Fragment keeps the bearer token out of HTTP requests and Referer.
        window.history.replaceState(window.history.state, '',
          `${window.location.pathname}${window.location.search}#token=${result.token}`);
        setToken(result.token);
      } catch {
        // Recovery is optional: the original private link remains supported.
      }
    };
    const readToken = () => {
      const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
      setToken(match?.[1] ?? '');
      setGateReady(false);
      setWatchAcknowledged(false);
      setGateProblem(false);
      setStatus('idle');
      setNotice('');
      if (!match) void resumeFromCookie();
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => { active = false; window.removeEventListener('hashchange', readToken); };
  }, []);

  useEffect(() => {
    recheckGateRef.current = () => {};
    if (!token || !videoUrl) return;
    let active = true;
    let inFlight = false;
    let unlocked = false;

    async function verifyServerGate() {
      if (!active || inFlight || unlocked) return;
      inFlight = true;
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
          return;
        }
        setGateProblem(false);
        if (result.remainingSeconds === 0) {
          unlocked = true;
          setGateReady(true);
          return;
        }
        setGateReady(false);
      } catch {
        if (active) setGateProblem(true);
      } finally {
        inFlight = false;
      }
    }

    // The server remains authoritative. A single 11-minute setTimeout can
    // be delayed indefinitely when video goes fullscreen, the screen locks,
    // or the browser throttles a background tab. Re-check repeatedly and
    // immediately on return, so a mature gate cannot remain grey indefinitely.
    const recheck = () => { void verifyServerGate(); };
    recheckGateRef.current = recheck;
    const interval = setInterval(recheck, 10_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', onVisibility);
    const player = videoRef.current;
    player?.addEventListener('ended', recheck);
    recheck();
    return () => {
      active = false;
      recheckGateRef.current = () => {};
      clearInterval(interval);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', onVisibility);
      player?.removeEventListener('ended', recheck);
    };
  }, [token, videoUrl]);

  async function startPresentation() {
    const player = videoRef.current;
    if (!player || !videoUrl) return;
    try {
      await player.play();
      setVideoError(false);
    } catch {
      setVideoError(true);
    }
  }

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
      <section className={styles.intro} aria-labelledby="startup-video-title">
        <div className={styles.introInner}>
          <span className={styles.introKicker}><span aria-hidden="true" className={styles.kickerDot} /> STARTUP HORYZON <span className={styles.introSeparator} aria-hidden="true" /> PRESENTAZIONE</span>
          <h1 id="startup-video-title">Un progetto da conoscere.<br /><em>Una scelta da fare consapevolmente.</em></h1>
        </div>
      </section>

      <section id="startup-video" className={styles.presentation} aria-label="Video Startup Horyzon">
        <div className={styles.videoWrap}>
          <div className={styles.videoHeader}>
            <span className={styles.videoLed} aria-hidden="true" />
            <span>HORYZON CONSULTING / STARTUP</span>
            <span className={styles.videoNote}>PRESENTAZIONE</span>
          </div>
          {videoUrl ? (
            <div className={styles.videoStage}>
              <video
                ref={videoRef}
                key={videoUrl}
                className={styles.video}
                src={videoUrl}
                controls={videoPlaying}
                playsInline
                preload="metadata"
                onPlay={() => { setVideoPlaying(true); setVideoError(false); }}
                onPause={() => setVideoPlaying(false)}
                onEnded={() => setVideoPlaying(false)}
                onError={() => { setVideoError(true); setVideoPlaying(false); }}
                aria-label="Presentazione della Startup Horyzon Consulting">
                Il browser non supporta la riproduzione del video.
              </video>
              {!videoPlaying && (
                <button className={styles.videoCover} type="button"
                  onClick={() => void startPresentation()}
                  aria-label="Riproduci la presentazione Startup Horyzon">
                  <span className={styles.videoCoverOrbit} aria-hidden="true" />
                  <span className={styles.videoCoverBrand}>
                    <span className={styles.videoCoverLogo}>
                      <Image src="/horyzon-logo-canonical.png" width={1670} height={390}
                        sizes="(max-width: 600px) 220px, 340px" alt="" />
                    </span>
                    <span className={styles.videoCoverRule} aria-hidden="true" />
                    <span className={styles.videoCoverDivision}>BENESSERE PATRIMONIALE</span>
                  </span>
                  <span className={styles.videoPlay} aria-hidden="true"><span className={styles.videoPlayTriangle} /></span>
                  <span className={styles.videoPlayCaption}>GUARDA LA PRESENTAZIONE</span>
                </button>
              )}
            </div>
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
            <p>Prima di scegliere un percorso, conosci chi lo sta costruendo. Poi decidi se proseguire.</p>
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
                {videoUrl && token && !gateReady && (
                  <button className={styles.gateRefreshButton} type="button"
                    onClick={() => recheckGateRef.current()}>
                    <span aria-hidden="true">↻</span> Verifica se puoi proseguire
                  </button>
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
