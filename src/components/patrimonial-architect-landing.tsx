'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { PatrimonialLeadForm } from './patrimonial-lead-form';
import { architectProfiles, architectDefaultCopy, type ArchitectProfileKey } from '@/content/patrimonial-architect-session';
import { PATRIMONIAL_V2 } from '@/lib/public-leads/patrimonial-contract';
import styles from './patrimonial-architect.module.css';
import header from './patrimonial-architect-header.module.css';
import { PatrimonialThemeToggle } from './patrimonial-theme-frame';

export function ArchitectLanding({ durableCandidateIntake = false }: { durableCandidateIntake?: boolean }) {
  const [profile, setProfile] = useState<ArchitectProfileKey | null>(null);
  const selected = profile ? architectProfiles[profile] : null;
  const heroRef = useRef<HTMLElement>(null), formRef = useRef<HTMLElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    if (!heroRef.current || !formRef.current || !('IntersectionObserver' in window)) return;
    let heroVisible = true, formVisible = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === heroRef.current) heroVisible = entry.isIntersecting;
        if (entry.target === formRef.current) formVisible = entry.isIntersecting;
      }
      setStickyVisible(!heroVisible && !formVisible);
    });
    observer.observe(heroRef.current); observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);
  const chooseValue = (value: string) => setProfile((Object.keys(architectProfiles) as ArchitectProfileKey[]).find(key => architectProfiles[key].value === value) ?? null);
  return <div className={[styles.page, styles.s001].filter(Boolean).join(" ")}>


  <header className={header.band}>
    <div className={header.inner}>
      <a className={header.brand} href="#" aria-label="Horyzon Consulting · Architetti Patrimoniali, torna all'inizio">
        <span className={header.logoWrap}><Image className={header.logo} src="/horyzon-logo-canonical.png" alt="" width={1670} height={390} sizes="190px" preload /></span>
        <span className={header.rule} aria-hidden="true"></span>
        <span className={header.division}>ARCHITETTI PATRIMONIALI</span>
      </a>
      <div className={header.actions}>
        <PatrimonialThemeToggle className={header.toggle} />
        <a className={header.cta} href="#richiesta">Candidati</a>
      </div>
    </div>
  </header>

  <div className={[styles['m-topbar'], styles.s002].filter(Boolean).join(" ")}>
    <span className={styles['m-hide']}>PERCORSO ARCHITETTO PATRIMONIALE</span>
    <span className={styles['m-hide']} aria-hidden="true">·</span>
    <span>SELEZIONE APERTA</span>
    <a className={[styles.s003].filter(Boolean).join(" ")} href="#richiesta">Candidati ora →</a>
  </div>


  <section ref={heroRef} className={[styles.s004, styles['bp']].filter(Boolean).join(" ")}>
    <svg className={[styles.s005].filter(Boolean).join(" ")} aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs><linearGradient id="hzHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--accent-stroke)', stopOpacity: 0.16 }}></stop><stop offset="1" style={{ stopColor: 'var(--accent-stroke)', stopOpacity: 0 }}></stop></linearGradient></defs>
      <path d="M-60 900 C 300 520, 1140 520, 1500 900 Z" fill="url(#hzHaze)" stroke="none"></path>
      <path d="M-60 900 C 300 520, 1140 520, 1500 900" fill="none" style={{ stroke: 'var(--accent-stroke-18)' }} strokeWidth="26"></path>
      <path className={[styles['horizon']].filter(Boolean).join(" ")} d="M-60 900 C 300 520, 1140 520, 1500 900" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="3.5" strokeLinecap="round"></path>
      <path d="M-60 930 C 300 600, 1140 600, 1500 930" fill="none" style={{ stroke: 'var(--accent-stroke-25)' }} strokeWidth="1.4" strokeDasharray="6 10"></path>
    </svg>
    <div className={[styles.s006].filter(Boolean).join(" ")}>

      <div className={[styles['m-hero'], styles.s012].filter(Boolean).join(" ")}>
        <div className={[styles.s013].filter(Boolean).join(" ")}>
          <div className={[styles.s014].filter(Boolean).join(" ")}>PERCORSO ARCHITETTO PATRIMONIALE · SELEZIONE APERTA</div>
          <h1 className={[styles.s015].filter(Boolean).join(" ")}>Le persone si fidano di te.<br /><span className={[styles.s016].filter(Boolean).join(" ")}>Se diventasse la tua professione?</span></h1>


          <p className={[styles.s021].filter(Boolean).join(" ")}>{architectDefaultCopy.sub}</p>

          <div className={[styles.s022].filter(Boolean).join(" ")}>
            <a className={[styles['m-cta-full'], styles.s023].filter(Boolean).join(" ")} href="#richiesta"><span>Vai alla candidatura</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
            <div className={[styles.s024].filter(Boolean).join(" ")}>Gratuito · online · senza impegno</div>
          </div>
        </div>

        <div className={[styles.s025].filter(Boolean).join(" ")}>
          <div className={[styles.s026].filter(Boolean).join(" ")}><Image width={2048} height={1144} quality={100} sizes="(max-width: 767px) 180vw, (max-width: 1199px) 145vw, 900px" preload className={[styles['cover']].filter(Boolean).join(" ")} style={{ objectPosition: '48% 50%' }} src="/benessere-patrimoniale/percorso-architetto/hero-telefono.jpg" alt="Una professionista sorride al telefono mentre lavora al portatile nel suo studio" /></div>
        </div>
      </div>
    </div>
  </section>




  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>01 · DA DOVE PARTI</div>
      <h2 className={[styles['m-reveal'], styles.s044].filter(Boolean).join(" ")}>Forse ti è già successo.</h2>
      <div className={[styles['m-only'], styles.swipeHint].join(" ")}>SCORRI LE SCHEDE →</div>
      <div data-carousel="scenes" role="region" aria-label="Scene da scorrere" tabIndex={0} className={[styles['m-swipe'], styles.s045].filter(Boolean).join(" ")}>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'domenica' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="domenica">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-domenica.jpg" alt="Immagine AI provvisoria: Un uomo pensieroso, solo al tavolo della cucina di sera" />

                <div hidden={selected?.scene !== 'domenica'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>DOMENICA, 22:40</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Il tuo lavoro lo fai bene. <strong>Ma non ti chiedi più se ti somiglia.</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'caffe' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="caffe">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-caffe.jpg" alt="Immagine AI provvisoria: Due amici al bar: uno racconta, l’altro ascolta con attenzione" />

                <div hidden={selected?.scene !== 'caffe'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>UN CAFFÈ CHE DIVENTA UN’ORA</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Un amico ti chiede un parere su risparmi e futuro. <strong>Perché non è il tuo lavoro?</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'opportunita' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="opportunita">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-opportunita.jpg" alt="Immagine AI provvisoria: Una mano chiude con decisione un portatile, accanto a una brochure" />

                <div hidden={selected?.scene !== 'opportunita'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>L’ENNESIMA “OPPORTUNITÀ”</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Hai detto di no più di una volta. <strong>Ti chiedevano solo di vendere.</strong></p>
            </figcaption>
          </figure>

      </div>
      <p className={[styles.s051].filter(Boolean).join(" ")}>Se almeno una di queste scene ti suona familiare, non ti manca il talento.<br /><span className={[styles.s052].filter(Boolean).join(" ")}>Ti manca il posto giusto in cui usarlo.</span><br /><span style={{ display: 'inline-block', marginTop: 20 }}>Oggi quel talento può diventare una professione moderna, costruita sulle persone.</span></p>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s065].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>02 · IL RUOLO</div>
      <h2 className={[styles['m-reveal'], styles.s066].filter(Boolean).join(" ")}>Cosa fa un architetto patrimoniale?</h2>
      <p className={[styles.s067].filter(Boolean).join(" ")}>Fa cultura: aiuta le persone a prendere confidenza con il denaro e a capire come farlo lavorare per i propri obiettivi.</p>

      <div className={[styles['m-col'], styles.s068].filter(Boolean).join(" ")}>
        <div className={[styles.s069].filter(Boolean).join(" ")}>
          <div className={[styles.s070].filter(Boolean).join(" ")}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="1.2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"></path><path d="M17.5 4.5l1.5-1.5M19 7h2" strokeLinecap="round"></path></svg>
          </div>
          <div className={[styles.s071].filter(Boolean).join(" ")}>PUNTO DI PARTENZA</div>
          <div className={[styles.s072].filter(Boolean).join(" ")}>Persone e famiglie</div>
          <div className={[styles.s073].filter(Boolean).join(" ")}>Domande sul denaro e poca confidenza con le scelte.</div>
        </div>
        <div className={[styles['m-vline'], styles.s074, styles['flowline']].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s075].filter(Boolean).join(" ")}>
          <div className={[styles.s076, styles['pulse']].filter(Boolean).join(" ")}>
            <div className={[styles.s077].filter(Boolean).join(" ")}>TU</div>
            <div className={[styles.s078].filter(Boolean).join(" ")}>Architetto<br />Patrimoniale</div>
          </div>
          <div className={[styles.s079].filter(Boolean).join(" ")}>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Fa cultura</span>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Dà confidenza</span>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Mette in contatto</span>
          </div>
        </div>
        <div className={[styles['m-vline'], styles.s074, styles['flowline']].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s069].filter(Boolean).join(" ")}>
          <div className={[styles.s081].filter(Boolean).join(" ")}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="1.2" aria-hidden="true"><path d="M3 20h18M5 20V10l7-6 7 6v10"></path><path d="M9 20v-6h6v6"></path></svg>
          </div>
          <div className={[styles.s071].filter(Boolean).join(" ")}>PUNTO DI ARRIVO</div>
          <div className={[styles.s072].filter(Boolean).join(" ")}>Obiettivi chiari</div>
          <div className={[styles.s073].filter(Boolean).join(" ")}>Il denaro che lavora per i propri obiettivi, con i professionisti giusti.</div>
        </div>
      </div>
      <p className={[styles.s082].filter(Boolean).join(" ")}><strong>Perimetro del ruolo.</strong> L&apos;Architetto Patrimoniale svolge un&apos;attività di ascolto, orientamento e divulgazione di carattere generale. Non presta consulenza in materia di investimenti né altri servizi o attività di investimento riservati dal D.Lgs. 58/1998 (TUF), non promuove né colloca strumenti o prodotti finanziari, non svolge distribuzione assicurativa (D.Lgs. 209/2005), mediazione creditizia o agenzia in attività finanziaria (D.Lgs. 385/1993) e non riceve denaro, titoli od ordini dai clienti. Per questo il ruolo non richiede l&apos;iscrizione all&apos;albo OCF, al RUI o agli elenchi OAM. Ogni scelta su prodotti o servizi regolamentati spetta esclusivamente a intermediari e professionisti autorizzati, con i quali l&apos;Architetto può mettere in contatto la persona.</p>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s083].filter(Boolean).join(" ")}>
    <Image width={2000} height={1131} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s084, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/blueprint.jpg" alt="" aria-hidden="true" />
    <div className={[styles.s085].filter(Boolean).join(" ")} aria-hidden="true"></div>
    <div className={[styles.s086].filter(Boolean).join(" ")}>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>03 · IL PERCORSO</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>Costruiamo insieme la tua professionalità.</h2>
        <p className={[styles.s089].filter(Boolean).join(" ")}>Formazione e affiancamento, passo dopo passo. Ogni elemento regge il successivo.</p>
      </div>

      <figure className={[styles['m-reveal'], styles['m-fig'], styles.s090].filter(Boolean).join(" ")} role="img" aria-label="Tavola: Formazione come fondamenta; Affiancamento, Metodo e Rete come colonne; il ruolo di Architetto Patrimoniale come tetto">
        <div className={[styles['m-build'], styles.s091].filter(Boolean).join(" ")}>
          <div className={[styles.s092].filter(Boolean).join(" ")}>
            <div className={[styles.s093].filter(Boolean).join(" ")}>Architetto<br />Patrimoniale</div>
            <div className={[styles.s094].filter(Boolean).join(" ")}>
              <div className={[styles.s095].filter(Boolean).join(" ")}>AFFIANCAMENTO</div>
              <div className={[styles.s095].filter(Boolean).join(" ")}>METODO</div>
              <div className={[styles.s095].filter(Boolean).join(" ")}>RETE</div>
            </div>
            <div className={[styles.s096].filter(Boolean).join(" ")}>FORMAZIONE</div>
          </div>
        </div>
      </figure>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s101].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>04 · IL PROSSIMO PASSO, INSIEME</div>
      <h2 className={[styles['m-reveal'], styles.s102].filter(Boolean).join(" ")}>Non devi scegliere oggi. Devi solo fare il primo passo.</h2>
      <div className={[styles.s103].filter(Boolean).join(" ")}>
        <div className={[styles['m-track'], styles.s104].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles['m-prog'], styles.s105].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <ol className={[styles['m-steps'], styles.s106].filter(Boolean).join(" ")}>
          <li>
            <div className={[styles.s107, styles['pulse']].filter(Boolean).join(" ")}></div>
            <div className={[styles.s108].filter(Boolean).join(" ")}>SEI QUI</div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Conosci il progetto</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Scopri il ruolo e il percorso, qui su questa pagina.</p>
          </li>
          <li>
            <div className={[styles.s111].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Invia la candidatura</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>I tuoi recapiti e qualche informazione su di te.</p>
          </li>
          <li>
            <div className={[styles.s111].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Presentazione e colloquio</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Se ci sono i presupposti, la presentazione di 30 minuti e poi un colloquio.</p>
          </li>
          <li>
            <div className={[styles.s113].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Inizia il percorso</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Formazione e affiancamento, dopo una conferma reciproca.</p>
          </li>
        </ol>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s114].filter(Boolean).join(" ")}>
      <div className={[styles.s115].filter(Boolean).join(" ")}>
        <Image width={700} height={1050} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 680px" className={[styles.s116, styles['cover']].filter(Boolean).join(" ")} style={{ objectPosition: '50% 16%' }} src="/people/angelo.webp" alt="Angelo Ria Chetta, fondatore di Horyzon" />
        <div className={[styles.s117].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s118].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <button disabled title="Video del fondatore da fornire" className={[styles.s119, styles['pulse']].filter(Boolean).join(" ")} type="button" aria-label="Video del fondatore — placeholder non disponibile"><svg width="28" height="28" viewBox="0 0 24 24" fill="#07171D" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></button>
        <div className={[styles.s120].filter(Boolean).join(" ")}><span>PERCHÉ NASCE QUESTA DIVISIONE</span><span>1:30</span></div>
      </div>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>05 · PERCHÉ LO FACCIAMO</div>
        <h2 className={[styles['m-reveal'], styles.s121].filter(Boolean).join(" ")}>Perché nasce questa divisione.</h2>
        <p className={[styles.s122].filter(Boolean).join(" ")}>Nel video Angelo racconta il progetto e il percorso. Link YouTube in arrivo.</p>
        <div className={[styles.s123].filter(Boolean).join(" ")}>
          <div className={[styles.s124].filter(Boolean).join(" ")}></div>
          <div><div className={[styles.s125].filter(Boolean).join(" ")}>Angelo Ria Chetta</div><div className={[styles.s126].filter(Boolean).join(" ")}>Horyzon Consulting</div></div>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>06 · CHI HA GIÀ INIZIATO</div>
      <h2 className={[styles['m-reveal'], styles.s127].filter(Boolean).join(" ")}>Sono partiti da dove sei tu.</h2>
      <div className={[styles['m-only'], styles.swipeHint].join(" ")}>SCORRI LE SCHEDE →</div>
      <div data-carousel="stories" role="region" aria-label="Testimonianze da scorrere" tabIndex={0} className={[styles['m-swipe'], styles.s045].filter(Boolean).join(" ")}>

          <figure className={[styles['m-reveal'], styles['story'], (selected?.story === 0 ? styles['is-mine'] : '')].filter(Boolean).join(" ")} data-story="0">
            <div className={[styles.s128].filter(Boolean).join(" ")}>
              <Image width={1400} height={1045} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/story-1.jpg" alt="Immagine AI provvisoria: Ritratto di un’ex commerciale, oggi Architetta" />
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: commerciale</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: Architetto</span></div>
            </div>
            <div className={[styles.s048].filter(Boolean).join(" ")}>
              <svg width="28" height="22" viewBox="0 0 28 22" fill="#5F7010" aria-hidden="true"><path d="M0 22V12C0 5 4 1 11 0l1 3C8 4 6 7 6 10h5v12H0zm16 0V12c0-7 4-11 11-12l1 3c-4 1-6 4-6 7h5v12H16z"></path></svg>
              <blockquote className={[styles.s132].filter(Boolean).join(" ")}>[Testimonianza reale: cosa faceva prima, perché ha scelto il percorso, cosa è cambiato.]</blockquote>
              <div className={[styles.s133].filter(Boolean).join(" ")}><strong className={[styles.s134].filter(Boolean).join(" ")}>[Nome]</strong> · [Città]</div>
            </div>
          </figure>

          <figure className={[styles['m-reveal'], styles['story'], (selected?.story === 1 ? styles['is-mine'] : '')].filter(Boolean).join(" ")} data-story="1">
            <div className={[styles.s128].filter(Boolean).join(" ")}>
              <Image width={1400} height={1045} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/story-2.jpg" alt="Immagine AI provvisoria: Ritratto di un ex imprenditore nel suo studio" />
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: imprenditore</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: Architetto</span></div>
            </div>
            <div className={[styles.s048].filter(Boolean).join(" ")}>
              <svg width="28" height="22" viewBox="0 0 28 22" fill="#5F7010" aria-hidden="true"><path d="M0 22V12C0 5 4 1 11 0l1 3C8 4 6 7 6 10h5v12H0zm16 0V12c0-7 4-11 11-12l1 3c-4 1-6 4-6 7h5v12H16z"></path></svg>
              <blockquote className={[styles.s132].filter(Boolean).join(" ")}>[Testimonianza reale: cosa faceva prima, perché ha scelto il percorso, cosa è cambiato.]</blockquote>
              <div className={[styles.s133].filter(Boolean).join(" ")}><strong className={[styles.s134].filter(Boolean).join(" ")}>[Nome]</strong> · [Città]</div>
            </div>
          </figure>

          <figure className={[styles['m-reveal'], styles['story'], (selected?.story === 2 ? styles['is-mine'] : '')].filter(Boolean).join(" ")} data-story="2">
            <div className={[styles.s128].filter(Boolean).join(" ")}>
              <Image width={1400} height={1045} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/story-3.jpg" alt="Immagine AI provvisoria: Ritratto di un ex dipendente alla finestra" />
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: dipendente</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: in formazione</span></div>
            </div>
            <div className={[styles.s048].filter(Boolean).join(" ")}>
              <svg width="28" height="22" viewBox="0 0 28 22" fill="#5F7010" aria-hidden="true"><path d="M0 22V12C0 5 4 1 11 0l1 3C8 4 6 7 6 10h5v12H0zm16 0V12c0-7 4-11 11-12l1 3c-4 1-6 4-6 7h5v12H16z"></path></svg>
              <blockquote className={[styles.s132].filter(Boolean).join(" ")}>[Testimonianza reale: cosa faceva prima, perché ha scelto il percorso, cosa è cambiato.]</blockquote>
              <div className={[styles.s133].filter(Boolean).join(" ")}><strong className={[styles.s134].filter(Boolean).join(" ")}>[Nome]</strong> · [Città]</div>
            </div>
          </figure>

      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s101].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>07 · SELEZIONE</div>
      <h2 className={[styles['m-reveal'], styles.s127].filter(Boolean).join(" ")} style={{ marginBottom: 16 }}>Non è per tutti.</h2>
      <p className={[styles.s145].filter(Boolean).join(" ")} style={{ marginBottom: 48, maxWidth: 720 }}>È per chi vuole costruirsi una professione autonoma, remunerativa e gratificante.</p>
      <div className={[styles.s135].filter(Boolean).join(" ")}>
        <div className={[styles.s136].filter(Boolean).join(" ")}>
          <h3 className={[styles.s137].filter(Boolean).join(" ")}>È il tuo percorso se…</h3>
          <ul className={[styles.s138].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Ti piace lavorare con le persone e sai costruire relazioni</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Vuoi imparare prima di proporre</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Cerchi crescita personale e professionale</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-stroke)' }} strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Sei disposto a dedicare tempo alla formazione</span></li>
          </ul>
        </div>
        <div className={[styles.s140].filter(Boolean).join(" ")}>
          <h3 className={[styles.s141].filter(Boolean).join(" ")}>Non è il tuo percorso se…</h3>
          <ul className={[styles.s142].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Cerchi un guadagno rapido o garantito</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Vuoi semplicemente vendere un prodotto</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Cerchi un&#x27;attività completamente passiva</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Vuoi saltare la conoscenza reciproca e la selezione</span></li>
          </ul>
        </div>
      </div>
    </div>
  </section>






  <section ref={formRef} className={[styles['m-sec'], styles.s162].filter(Boolean).join(" ")} id="richiesta">
    <div className={[styles.s163].filter(Boolean).join(" ")}>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>08 · CANDIDATI</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>Candidati al Percorso Architetto Patrimoniale.</h2>
          <div className={[styles.s017].filter(Boolean).join(" ")} style={{ margin: '8px 0 20px' }}>
          <div className={[styles.s018].filter(Boolean).join(" ")} id="profilo">Da dove parti oggi? <span className={[styles.s019].filter(Boolean).join(" ")}>Scegli il profilo che ti descrive meglio.</span></div>
          <div className={[styles.s020].filter(Boolean).join(" ")} role="group" aria-label="Il tuo profilo">
            <button aria-pressed={profile === "commerciale"} onClick={() => setProfile("commerciale")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="commerciale">Commerciale</button>
              <button aria-pressed={profile === "imprenditore"} onClick={() => setProfile("imprenditore")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="imprenditore">Imprenditore</button>
              <button aria-pressed={profile === "dipendente"} onClick={() => setProfile("dipendente")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="dipendente">Dipendente</button>
              <button aria-pressed={profile === "professionista"} onClick={() => setProfile("professionista")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="professionista">Professionista</button>
              <button aria-pressed={profile === "altro"} onClick={() => setProfile("altro")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="altro">Sto esplorando</button>
          </div>
        </div>
        <p className={[styles.s164].filter(Boolean).join(" ")}><span data-bind="sub">{selected?.sub ?? 'Lo useremo per conoscerti meglio e per la tua candidatura.'}</span></p>
        <div className={[styles.s170].filter(Boolean).join(" ")}>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Ricevi la conferma che la candidatura è stata registrata</span></div>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Il team valuta il profilo e le informazioni che hai inviato</span></div>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Se ci sono i presupposti, ricevi la presentazione e fissiamo un colloquio</span></div>
        </div>
      </div>

      <PatrimonialLeadForm mode="architect-path" presentation="architect" contractVersion={durableCandidateIntake ? PATRIMONIAL_V2 : undefined} selectedProfile={selected?.value ?? ""} onProfileChange={chooseValue} />
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s173].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>09 · DOMANDE FREQUENTI</div>
      <h2 className={[styles['m-reveal'], styles.s174].filter(Boolean).join(" ")}>Le domande che ci fanno tutti.</h2>
      <div className={[styles.s175].filter(Boolean).join(" ")}>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Devo investire soldi per entrare nel percorso?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>No, devi investire coraggio, tempo e impegno. L&#x27;ingresso nel percorso è gratuito; restano i normali costi di un&#x27;attività autonoma.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>In quanto tempo posso iniziare?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Il percorso di preparazione dura circa 90 giorni.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Posso iniziare part-time?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Sì. Puoi lavorare full-time oppure part-time, se hai un altro impiego e vuoi provare sul campo. Verifichiamo insieme eventuali incompatibilità.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Come viene remunerata l&#x27;attività?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Con provvigioni secondo l&#x27;incarico. Modalità e percentuali vengono chiarite prima dell&#x27;avvio.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Serve la partita IVA?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Sì. Il trattamento fiscale dipende dalla tua situazione individuale.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Quale formazione serve?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Te la diamo noi: un breve percorso formativo, con l&#x27;affiancamento di un senior.</p></details>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s180].filter(Boolean).join(" ")}>
    <Image width={2400} height={1029} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s181, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/skyline.jpg" alt="" aria-hidden="true" />
    <div className={[styles.s182].filter(Boolean).join(" ")} aria-hidden="true"></div>
    <div className={[styles.s183].filter(Boolean).join(" ")}>
      <h2 className={[styles['m-reveal'], styles.s184].filter(Boolean).join(" ")}>Ogni orizzonte comincia da una conversazione.</h2>
      <p className={[styles.s185].filter(Boolean).join(" ")}>Se ti riconosci in questo percorso, il primo passo è la tua candidatura.</p>
      <a className={[styles.s186].filter(Boolean).join(" ")} href="#richiesta">Candidati al percorso</a>
      <p className={[styles.s187].filter(Boolean).join(" ")}><strong className={[styles.s188].filter(Boolean).join(" ")}>P.S.</strong> Se sei arrivato fin qui, qualcosa ti ha incuriosito. Non decidere niente adesso: inviaci solo la candidatura. Nel peggiore dei casi avrai capito un mestiere nuovo.</p>
      <p className={[styles.s188].filter(Boolean).join(" ")} style={{ marginTop: 40, fontSize: 13, letterSpacing: '0.12em' }}>HORYZON CONSULTING — DIVISIONE BENESSERE PATRIMONIALE</p>
    </div>
  </section>

  <footer className={[styles.s189].filter(Boolean).join(" ")}>
    <div className={[styles.s190].filter(Boolean).join(" ")}>
      <div><strong className={[styles.s191].filter(Boolean).join(" ")}>Horyzon Benessere Patrimoniale</strong><p className={styles.pilotNotice}>PILOT · Dati e testimonianze da confermare. Alcune immagini sono provvisorie e generate con AI; le foto non ritraggono il team reale.</p><br />FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P. IVA 05120660757</div>
      <div className={[styles.s192].filter(Boolean).join(" ")}><a href="https://www.iubenda.com/privacy-policy/64704330">Privacy</a><a href="https://www.iubenda.com/privacy-policy/64704330/cookie-policy">Cookie</a><a href="mailto:info@horyzon.it">info@horyzon.it</a></div>
    </div>
  </footer>


  <div aria-hidden={!stickyVisible} inert={!stickyVisible} className={[styles.s193, styles.stickyBar, (!stickyVisible ? styles['is-hidden'] : '')].filter(Boolean).join(" ")} id="stickyBar">
    <div className={[styles['m-sticky'], styles.s194].filter(Boolean).join(" ")}>
      <div className={[styles.s195].filter(Boolean).join(" ")}><span className={[styles.s029, styles['pulse']].filter(Boolean).join(" ")}></span><span>Percorso <span className={[styles.s016].filter(Boolean).join(" ")}>Architetto Patrimoniale</span></span></div>
      <a className={[styles.s196].filter(Boolean).join(" ")} href="#richiesta">Candidati</a>
    </div>
  </div>
</div>;
}
