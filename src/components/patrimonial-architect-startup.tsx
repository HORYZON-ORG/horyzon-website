'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import header from './patrimonial-architect-header.module.css';
import styles from './patrimonial-architect-startup.module.css';
import { IndeedStartupCallbackForm, useIndeedCallbackSession } from './patrimonial-architect-indeed-callback';
import { architectIndeedIntroPath, INDEED_PROVINCE_LABELS, type IndeedProvince } from '@/lib/public-leads/architect-indeed-provinces';

const VIDEO_DURATION_SECONDS = 660.73;
const VIDEO_SPEEDS = [1, 1.1, 1.25, 1.5] as const;
const displayVideoTime = (seconds: number) => {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
};

type Status = 'idle' | 'sending' | 'success' | 'error';

export function ArchitectStartupPresentation({ videoUrl, fromIndeed = false, indeedCallbackEnabled = false, indeedProvince = 'bari' }: {
  videoUrl: string; fromIndeed?: boolean; indeedCallbackEnabled?: boolean; indeedProvince?: IndeedProvince;
}) {
  const [token, setToken] = useState('');
  const [gateReady, setGateReady] = useState(false);
  const [watchAcknowledged, setWatchAcknowledged] = useState(false);
  const [gateProblem, setGateProblem] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [indeedVideoCompleted, setIndeedVideoCompleted] = useState(false);
  const indeedSession = useIndeedCallbackSession(fromIndeed && indeedCallbackEnabled, indeedProvince);
  const homePath = fromIndeed ? architectIndeedIntroPath(indeedProvince) : '/candidature/architetti-patrimoniali';
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackButtonRef = useRef<HTMLButtonElement>(null);
  const verifiedPositionRef = useRef(0);
  const maxPlayedRef = useRef(0);
  const lastPingRef = useRef(0);
  const progressQueueRef = useRef<Promise<void>>(Promise.resolve());
  const playbackRateRef = useRef(1);
  const tokenRef = useRef('');

  useEffect(() => {
    if (watchAcknowledged) callbackButtonRef.current?.focus();
  }, [watchAcknowledged]);

  useEffect(() => {
    if (fromIndeed) return;
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
      setVideoEnded(false);
      setVideoSeconds(0);
      maxPlayedRef.current = 0;
      verifiedPositionRef.current = 0;
      setStatus('idle');
      setNotice('');
      if (!match) void resumeFromCookie();
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => { active = false; window.removeEventListener('hashchange', readToken); };
  }, [fromIndeed]);

  useEffect(() => { tokenRef.current = token; }, [token]);

  // Recover durable progress after a reload or a return within seven days.
  // No elapsed-time countdown: only the server's completed-video receipt
  // can enable the next step.
  useEffect(() => {
    if (fromIndeed || !token || !videoUrl) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/architect-startup/video-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(15000),
        });
        const data: { ok?: boolean; completed?: boolean; positionSeconds?: number } = await response.json();
        if (!active) return;
        if (!response.ok || !data.ok || typeof data.positionSeconds !== 'number') {
          setGateProblem(true);
          return;
        }
        verifiedPositionRef.current = data.positionSeconds;
        maxPlayedRef.current = data.positionSeconds;
        setVideoSeconds(data.positionSeconds);
        setGateReady(data.completed === true);
        setVideoEnded(data.completed === true);
        setGateProblem(false);
        const video = videoRef.current;
        if (video && video.readyState >= 1 && !data.completed && data.positionSeconds > 1)
          video.currentTime = Math.max(0, data.positionSeconds - 0.5);
      } catch {
        if (active) setGateProblem(true);
      }
    })();
    return () => { active = false; };
  }, [fromIndeed, token, videoUrl]);

  function recordProgress(positionSeconds: number, complete = false) {
    if (fromIndeed || !tokenRef.current || !videoUrl) return Promise.resolve();
    const capturedToken = tokenRef.current;
    const position = Math.max(0, Math.min(662, positionSeconds));
    const rate = playbackRateRef.current;
    const send = async () => {
      try {
        const response = await fetch('/api/architect-startup/video-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            token: capturedToken, positionSeconds: position,
            playbackRate: rate, complete,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const data: { ok?: boolean; completed?: boolean; positionSeconds?: number } = await response.json();
        if (tokenRef.current !== capturedToken) return;
        if (!response.ok || !data.ok || typeof data.positionSeconds !== 'number') {
          setGateProblem(true);
          return;
        }
        verifiedPositionRef.current = Math.max(verifiedPositionRef.current, data.positionSeconds);
        setGateReady(data.completed === true);
        setGateProblem(false);
      } catch {
        if (tokenRef.current === capturedToken) setGateProblem(true);
      }
    };
    // Requests are serial so the final onEnded receipt cannot overtake the
    // previous playback checkpoint.
    progressQueueRef.current = progressQueueRef.current.then(send, send);
    return progressQueueRef.current;
  }

  function handleVideoTimeUpdate() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.currentTime)) return;
    if (video.seeking) return;
    const position = video.currentTime;
    maxPlayedRef.current = Math.max(maxPlayedRef.current, position);
    setVideoSeconds(position);
    if (video.paused || videoEnded) return;
    if (position >= lastPingRef.current + 2.5) {
      lastPingRef.current = position;
      void recordProgress(position);
    }
  }

  function handleVideoSeeking() {
    const video = videoRef.current;
    if (!video) return;
    // Neither touch, keyboard nor browser-native seeking may jump forward.
    // The only user-initiated time jump is the -10s button below.
    if (video.currentTime > maxPlayedRef.current + 1.25) {
      video.currentTime = maxPlayedRef.current;
    }
  }

  function changeVideoSpeed(rate: number) {
    if (!VIDEO_SPEEDS.some(value => value === rate)) return;
    playbackRateRef.current = rate;
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  async function startPresentation() {
    const player = videoRef.current;
    if (!player || !videoUrl) return;
    if (videoEnded && player.ended) {
      player.currentTime = 0;
      setVideoEnded(false);
    }
    try {
      await player.play();
      setVideoError(false);
      lastPingRef.current = player.currentTime;
      void recordProgress(player.currentTime);
    } catch {
      setVideoError(true);
    }
  }

  function pausePresentation() {
    const player = videoRef.current;
    if (!player) return;
    void recordProgress(player.currentTime);
    player.pause();
  }

  function rewindPresentation() {
    const player = videoRef.current;
    if (!player) return;
    void recordProgress(player.currentTime);
    player.currentTime = Math.max(0, player.currentTime - 10);
    setVideoSeconds(player.currentTime);
  }

  function handleVideoEnded() {
    const player = videoRef.current;
    if (!player) return;
    setVideoPlaying(false);
    setVideoEnded(true);
    setVideoSeconds(player.duration || VIDEO_DURATION_SECONDS);
    if (fromIndeed) {
      setIndeedVideoCompleted(true);
      return;
    }
    if (player.currentTime >= VIDEO_DURATION_SECONDS - 0.6)
      void recordProgress(player.currentTime, true);
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
        <Link className={header.brand} href={homePath} aria-label="Horyzon Consulting · Benessere Patrimoniale">
          <span className={header.logoWrap}><Image className={header.logo} src="/horyzon-logo-canonical.png" width={1670} height={390} sizes="190px" alt="Horyzon Consulting" /></span>
          <span className={header.rule} aria-hidden="true" />
          <span className={header.division}>BENESSERE PATRIMONIALE</span>
        </Link>
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
            <>
            <div className={styles.videoStage}>
              <video
                ref={videoRef}
                key={videoUrl}
                className={styles.video}
                src={videoUrl}
                controls={false}
                playsInline
                disablePictureInPicture
                preload="metadata"
                tabIndex={-1}
                onContextMenu={event => event.preventDefault()}
                onKeyDown={event => {
                  if (['ArrowRight', 'End', 'PageDown'].includes(event.key)) event.preventDefault();
                }}
                onLoadedMetadata={() => {
                  const player = videoRef.current;
                  if (player && verifiedPositionRef.current > 1 && !gateReady)
                    player.currentTime = Math.max(0, verifiedPositionRef.current - 0.5);
                }}
                onTimeUpdate={handleVideoTimeUpdate}
                onSeeking={handleVideoSeeking}
                onRateChange={() => {
                  const player = videoRef.current;
                  if (player && player.playbackRate !== playbackRateRef.current)
                    player.playbackRate = playbackRateRef.current;
                }}
                onPlay={() => {
                  setVideoPlaying(true);
                  setVideoError(false);
                  if (fromIndeed) void indeedSession.begin();
                }}
                onPause={() => { setVideoPlaying(false); void recordProgress(videoRef.current?.currentTime ?? 0); }}
                onEnded={handleVideoEnded}
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
            <div className={styles.videoControls} role="group" aria-label="Comandi video Horyzon">
              <div className={styles.playbackActions}>
                <button type="button" className={styles.playbackButton}
                  onClick={() => videoPlaying ? pausePresentation() : void startPresentation()}
                  aria-label={videoPlaying ? 'Metti in pausa il video' : 'Riprendi la riproduzione'}>
                  <span aria-hidden="true">{videoPlaying ? '❚❚' : '▶'}</span>
                  {videoPlaying ? 'Pausa' : 'Riproduci'}
                </button>
                <button type="button" className={styles.playbackButton}
                  onClick={rewindPresentation} aria-label="Torna indietro di 10 secondi">
                  <span aria-hidden="true">↶</span> 10 s
                </button>
              </div>
              <div className={styles.videoTimeline} role="progressbar"
                aria-label="Avanzamento della presentazione"
                aria-valuemin={0} aria-valuemax={Math.ceil(VIDEO_DURATION_SECONDS)}
                aria-valuenow={Math.min(Math.ceil(VIDEO_DURATION_SECONDS), Math.round(videoSeconds))}>
                <span style={{ width: `${Math.min(100, videoSeconds / VIDEO_DURATION_SECONDS * 100)}%` }} />
              </div>
              <span className={styles.videoClock} aria-live="off">
                {displayVideoTime(videoSeconds)} / 11:01
              </span>
              <div className={styles.speedControl} role="group" aria-label="Velocità di riproduzione">
                <span className={styles.speedLabel}>VELOCITÀ</span>
                {VIDEO_SPEEDS.map(rate => (
                  <button key={rate} type="button"
                    className={`${styles.speedButton} ${playbackRate === rate ? styles.speedButtonActive : ''}`}
                    aria-pressed={playbackRate === rate}
                    aria-label={`Riproduzione a ${String(rate).replace('.', ',')} volte`}
                    onClick={() => changeVideoSpeed(rate)}>
                    {String(rate).replace('.', ',')}×
                  </button>
                ))}
              </div>
            </div>
            </>
          ) : (
            <div className={styles.videoPlaceholder}>
              <span className={styles.playSymbol} aria-hidden="true">▶</span>
              <strong>Startup Horyzon</strong>
              <p>Qui sarà inserito il video ufficiale della presentazione.</p>
              {!fromIndeed && <small>La conferma sarà disponibile quando arriverà il video. I recapiti temporanei scadono dopo 7 giorni; non viene ancora creata alcuna scheda nell’Hub.</small>}
            </div>
          )}
        </div>

        {videoError && <p className={styles.error} role="alert">Il video non è disponibile al momento.{!fromIndeed && ' Non è stata registrata alcuna conferma.'}</p>}

        <div className={styles.confirmPanel}>
          <div className={styles.confirmIntro}>
            <span className={styles.eyebrow}>{fromIndeed
              ? `DOPO LA STARTUP${indeedProvince === 'bari' ? '' : ` · ${INDEED_PROVINCE_LABELS[indeedProvince].toUpperCase()}`}`
              : 'LA TUA DECISIONE'}</span>
            <h2>{fromIndeed ? 'Prepariamo il colloquio di selezione' : 'Ti riconosci in questo progetto?'}</h2>
            <p>{fromIndeed
              ? 'La presentazione ci aiuta a partire da una base comune sul mercato e sul progetto. Al termine puoi confermare la visione e chiedere di fissare il colloquio online.'
              : 'Prima di scegliere un percorso, conosci chi lo sta costruendo. Poi decidi se proseguire.'}</p>
          </div>
          <div className={styles.confirmAction}>
            {fromIndeed ? (
              !videoUrl ? <p className={styles.confirmHint}>La presentazione non è ancora disponibile.</p>
                : !indeedCallbackEnabled ? <p className={styles.confirmHint}>La conferma online non è disponibile in questo momento.</p>
                : indeedSession.sessionError ? <p className={styles.error} role="alert">Non è stato possibile preparare la conferma. Metti in pausa e riprendi la riproduzione per riprovare.</p>
                : !indeedVideoCompleted ? <p className={styles.confirmHint}>Completa la Startup per poter confermare qui la visione. Non dovrai ricaricare il CV né tornare su Indeed.</p>
                : !indeedSession.token ? <p className={styles.confirmHint} role="status">Preparazione della conferma…</p>
                : <IndeedStartupCallbackForm token={indeedSession.token} province={indeedProvince} />
            ) : status === 'success' ? (
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
                  <span className={styles.confirmButtonText}>Ho completato la visione del video</span>
                  <span className={styles.confirmArrow} aria-hidden="true">↗</span>
                </button>
                {gateReady && token && videoUrl ? (
                  <p className={styles.readyNote} role="status"><span aria-hidden="true">✓</span> Puoi confermare di aver completato la visione.</p>
                ) : (
                  <p className={styles.confirmHint}>
                    {!videoUrl ? 'La presentazione non è ancora disponibile.' :
                     !token ? <Link href="/candidature/architetti-patrimoniali#richiesta">Non hai ancora inviato i recapiti? Compila il modulo per proseguire.</Link> :
                     gateProblem ? 'Verifica della visione temporaneamente non disponibile. Puoi riprovare.' :
                     videoEnded ? 'Fine del video raggiunta. Verifica in corso: se il tasto rimane grigio, riprova qui sotto.' :
                     'Completa la presentazione per attivare il pulsante. Puoi mettere in pausa, tornare indietro e cambiare velocità.'}
                  </p>
                )}
                {videoUrl && token && !gateReady && (videoEnded || gateProblem) && (
                  <button className={styles.gateRefreshButton} type="button"
                    onClick={() => videoEnded
                      ? void recordProgress(videoRef.current?.currentTime ?? VIDEO_DURATION_SECONDS, true)
                      : void recordProgress(videoRef.current?.currentTime ?? 0)}>
                    <span aria-hidden="true">↻</span> Verifica completamento video
                  </button>
                )}
              </>
            ) : (
              <>
                <p className={styles.readyNote} role="status"><span aria-hidden="true">✓</span> Hai confermato la visione. Ora puoi scegliere se richiedere un ricontatto.</p>
                <button
                  ref={callbackButtonRef}
                  className={styles.confirmButton}
                  type="button"
                  disabled={status === 'sending'}
                  onClick={() => void confirmInterest()}>
                  <span className={styles.confirmButtonText}>{status === 'sending'
                    ? 'Registrazione della richiesta…'
                    : 'Voglio essere ricontattato da un responsabile HORYZON'}</span>
                  <span className={styles.confirmArrow} aria-hidden="true">↗</span>
                </button>
                <p className={styles.confirmHint}>Un responsabile HORYZON ti contatterà per una breve chiamata di orientamento sui prossimi passi della selezione.</p>
              </>
            )}
            {status === 'error' && <p className={styles.error} role="alert">{notice}</p>}
          </div>
        </div>
      </section>

    </main>

    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link className={styles.footerBrand} href={homePath} aria-label="Horyzon Consulting, pagina Architetti Patrimoniali">
          <span className={styles.footerLogoWrap}><Image src="/horyzon-logo-canonical.png" width={1670} height={390} sizes="190px" alt="Horyzon Consulting" /></span>
          <span className={styles.footerBrandRule} aria-hidden="true" />
          <span className={styles.footerDivision}>BENESSERE PATRIMONIALE</span>
        </Link>
        <nav className={styles.footerNav} aria-label="Collegamenti Startup Horyzon">
          <button type="button" onClick={() => document.getElementById('startup-video')?.scrollIntoView({ behavior: 'smooth' })}>Rivedi la presentazione <span aria-hidden="true">↗</span></button>
          <a href="https://www.iubenda.com/privacy-policy/64704330" target="_blank" rel="noopener noreferrer">Privacy <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      <div className={styles.footerBase}>
        <span>HORYZON CONSULTING</span>
        <span>Visione. Persone. Futuro.</span>
      </div>
    </footer>
  </div>;
}
