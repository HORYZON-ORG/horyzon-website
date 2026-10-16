'use client';
import Image from 'next/image';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PatrimonialLeadForm } from './patrimonial-lead-form';
import { architectSession, architectSessionSnapshot, architectProfiles, architectDefaultCopy, type ArchitectProfileKey } from '@/content/patrimonial-architect-session';
import styles from './patrimonial-architect.module.css';

const SessionContext = createContext(architectSessionSnapshot(null));
function SessionProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (architectSession.status !== 'CONFIRMED' || !architectSession.sessionDate) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <SessionContext value={architectSessionSnapshot(now)}>{children}</SessionContext>;
}
function SessionValue({ name }: { name: string }) {
  const state = useContext(SessionContext);
  if (name.startsWith('cd.')) return state.cd[name.slice(3) as keyof typeof state.cd];
  if (name === 'sessionLabel') return state.sessionLabel;
  if (name === 'seatsTotal') return state.seatsTotal;
  if (name === 'seatsTaken') return state.seatsTaken;
  return state.seatsLeft;
}
function SeatBar() {
  const session = useContext(SessionContext);
  return <div id="seatBar" className={styles.seatBar} style={{ width: `${session.seatPercent}%` }} aria-hidden="true" />;
}
export function ArchitectLanding() {
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
  return <SessionProvider><div className={[styles.page, styles.s001].filter(Boolean).join(" ")}>


  <div className={[styles['m-topbar'], styles.s002].filter(Boolean).join(" ")}>
    <span className={styles['m-hide']}>PILOT / PLACEHOLDER · PROSSIMA PRESENTAZIONE LIVE · <span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span></span>
    <span className={styles['m-hide']} aria-hidden="true">·</span>
    <span>CHIUSURA DA CONFERMARE · <span data-bind="cd.d"><SessionValue name="cd.d" /></span>G <span data-bind="cd.h"><SessionValue name="cd.h" /></span>H <span data-bind="cd.m"><SessionValue name="cd.m" /></span>M</span>
    <a className={[styles.s003].filter(Boolean).join(" ")} href="#richiesta">Riserva il tuo posto →</a>
  </div>


  <section ref={heroRef} className={[styles.s004, styles['bp']].filter(Boolean).join(" ")}>
    <svg className={[styles.s005].filter(Boolean).join(" ")} aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <path d="M-40 905 C 360 815, 1080 815, 1480 905" fill="none" stroke="rgba(216,255,66,.18)" strokeWidth="14"></path>
      <path className={[styles['horizon']].filter(Boolean).join(" ")} d="M-40 905 C 360 815, 1080 815, 1480 905" fill="none" stroke="#D8FF42" strokeWidth="1.6"></path>
      <path d="M-40 935 C 360 860, 1080 860, 1480 935" fill="none" stroke="rgba(216,255,66,.25)" strokeWidth="1" strokeDasharray="4 8"></path>
    </svg>
    <div className={[styles.s006].filter(Boolean).join(" ")}>
      <nav className={[styles.s007].filter(Boolean).join(" ")}>
        <div className={[styles.s008].filter(Boolean).join(" ")}>
          <span className={[styles.s009].filter(Boolean).join(" ")}>HORYZON</span>
          <span className={[styles.s010].filter(Boolean).join(" ")}>BENESSERE PATRIMONIALE</span>
        </div>
        <a className={[styles.s011].filter(Boolean).join(" ")} href="#richiesta">Riserva il posto</a>
      </nav>

      <div className={[styles['m-hero'], styles.s012].filter(Boolean).join(" ")}>
        <div className={[styles.s013].filter(Boolean).join(" ")}>
          <div className={[styles.s014].filter(Boolean).join(" ")}>PERCORSO ARCHITETTO PATRIMONIALE · SELEZIONE APERTA</div>
          <h1 className={[styles.s015].filter(Boolean).join(" ")}>Le persone si fidano di te.<br /><span className={[styles.s016].filter(Boolean).join(" ")}>E se diventasse il tuo lavoro?</span></h1>


          <div className={[styles.s017].filter(Boolean).join(" ")}>
            <div className={[styles.s018].filter(Boolean).join(" ")} id="profilo">Da dove parti oggi? <span className={[styles.s019].filter(Boolean).join(" ")}>Scegli e la pagina si adatta a te.</span></div>
            <div className={[styles.s020].filter(Boolean).join(" ")} role="group" aria-label="Il tuo profilo">
              <button aria-pressed={profile === "commerciale"} onClick={() => setProfile("commerciale")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="commerciale">Commerciale</button>
                <button aria-pressed={profile === "imprenditore"} onClick={() => setProfile("imprenditore")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="imprenditore">Imprenditore</button>
                <button aria-pressed={profile === "dipendente"} onClick={() => setProfile("dipendente")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="dipendente">Dipendente</button>
                <button aria-pressed={profile === "professionista"} onClick={() => setProfile("professionista")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="professionista">Professionista</button>
                <button aria-pressed={profile === "altro"} onClick={() => setProfile("altro")} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile="altro">Sto esplorando</button>
            </div>
          </div>
          <p className={[styles.s021].filter(Boolean).join(" ")}><span data-bind="sub">{selected?.sub ?? architectDefaultCopy.sub}</span></p>

          <div className={[styles.s022].filter(Boolean).join(" ")}>
            <a className={[styles['m-cta-full'], styles.s023].filter(Boolean).join(" ")} href="#richiesta"><span data-bind="cta">{selected?.cta ?? architectDefaultCopy.cta}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
            <div className={[styles.s024].filter(Boolean).join(" ")}>Gratuita · online · 30 minuti<br /><span className={[styles.s016].filter(Boolean).join(" ")}><span data-bind="seatsLeft"><SessionValue name="seatsLeft" /></span> posti liberi su <span data-bind="seatsTotal"><SessionValue name="seatsTotal" /></span></span></div>
          </div>
        </div>

        <div className={[styles.s025].filter(Boolean).join(" ")}>
          <div className={[styles.s026].filter(Boolean).join(" ")}><Image width={1400} height={1750} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" preload className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/hero.jpg" alt="Una professionista studia con attenzione un progetto stampato, alla luce del sole" /></div>
          <div className={[styles['m-ticket'], styles.s027].filter(Boolean).join(" ")}>
            <div className={[styles.s028].filter(Boolean).join(" ")}><span className={[styles.s029, styles['pulse']].filter(Boolean).join(" ")}></span>PRESENTAZIONE LIVE</div>
            <div className={[styles.s030].filter(Boolean).join(" ")}><span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span></div>
            <div className={[styles.s031].filter(Boolean).join(" ")}>
              <div className={[styles.s032].filter(Boolean).join(" ")}><div className={[styles.s033].filter(Boolean).join(" ")}><span data-bind="cd.d"><SessionValue name="cd.d" /></span></div><div className={[styles.s034].filter(Boolean).join(" ")}>GIORNI</div></div>
              <div className={[styles.s032].filter(Boolean).join(" ")}><div className={[styles.s033].filter(Boolean).join(" ")}><span data-bind="cd.h"><SessionValue name="cd.h" /></span></div><div className={[styles.s034].filter(Boolean).join(" ")}>ORE</div></div>
              <div className={[styles.s032].filter(Boolean).join(" ")}><div className={[styles.s033].filter(Boolean).join(" ")}><span data-bind="cd.m"><SessionValue name="cd.m" /></span></div><div className={[styles.s034].filter(Boolean).join(" ")}>MIN</div></div>
              <div className={[styles.s035].filter(Boolean).join(" ")}><div className={[styles.s033].filter(Boolean).join(" ")}><span data-bind="cd.s"><SessionValue name="cd.s" /></span></div><div className={[styles.s034].filter(Boolean).join(" ")}>SEC</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles.s036].filter(Boolean).join(" ")}>
    <div className={[styles['m-stats'], styles.s037].filter(Boolean).join(" ")}>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>[N]</div><div className={[styles.s040].filter(Boolean).join(" ")}>persone alle presentazioni</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>[N]</div><div className={[styles.s040].filter(Boolean).join(" ")}>Architetti in formazione</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>[N]%</div><div className={[styles.s040].filter(Boolean).join(" ")}>delle candidature accolte</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>Milano</div><div className={[styles.s040].filter(Boolean).join(" ")}>sede · FELICITÀ srl</div></div>
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
              <p className={[styles.s050].filter(Boolean).join(" ")}>Pensi già al lunedì. Il tuo lavoro lo fai bene, nessuno può dire il contrario. <strong>Ma è da tanto che non ti chiedi più se ti somiglia.</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'caffe' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="caffe">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-caffe.jpg" alt="Immagine AI provvisoria: Due amici al bar: uno racconta, l’altro ascolta con attenzione" />

                <div hidden={selected?.scene !== 'caffe'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>UN CAFFÈ CHE DIVENTA UN’ORA</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Un amico ti chiede un parere su risparmi, figli, futuro. Lo ascolti, lo aiuti a mettere ordine. Poi torni a casa e pensi: <strong>perché questo non è il mio lavoro?</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'opportunita' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="opportunita">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-opportunita.jpg" alt="Immagine AI provvisoria: Una mano chiude con decisione un portatile, accanto a una brochure" />

                <div hidden={selected?.scene !== 'opportunita'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>L’ENNESIMA “OPPORTUNITÀ”</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Quest’anno hai già detto no più di una volta. Non per paura: <strong>nessuno ti chiedeva di imparare. Ti chiedevano solo di vendere.</strong></p>
            </figcaption>
          </figure>

      </div>
      <p className={[styles.s051].filter(Boolean).join(" ")}>Se almeno una di queste scene ti suona familiare, non ti manca il talento.<br /><span className={[styles.s052].filter(Boolean).join(" ")}>Ti manca il posto giusto in cui usarlo.</span></p>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>02 · LA DIFFERENZA</div>
      <h2 className={[styles['m-reveal'], styles.s055].filter(Boolean).join(" ")}>Un venditore parte dal prodotto.<br /><span className={[styles.s016].filter(Boolean).join(" ")}>Un Architetto parte dalla persona.</span></h2>
      <div className={[styles.s056].filter(Boolean).join(" ")}>
        <div className={[styles.s057].filter(Boolean).join(" ")}>
          <div className={[styles.s058].filter(Boolean).join(" ")}>IL MODELLO CHE CONOSCI</div>
          <ol className={[styles.s059].filter(Boolean).join(" ")}>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>01</span><span>Hai un prodotto e un obiettivo di vendita</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>02</span><span>Cerchi qualcuno a cui proporlo</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>03</span><span>Il cliente si chiude, tu insisti</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>04</span><span>Ricominci da capo il mese dopo</span></li>
          </ol>
        </div>
        <div className={[styles.s062].filter(Boolean).join(" ")}>
          <div className={[styles.s063].filter(Boolean).join(" ")}>IL MODELLO HORYZON</div>
          <ol className={[styles.s064].filter(Boolean).join(" ")}>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>01</span><span>Ascolti la persona e la sua storia</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>02</span><span>Mettete ordine insieme: obiettivi, timori, priorità</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>03</span><span>La accompagni verso scelte consapevoli</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>04</span><span>Nasce una relazione che dura nel tempo</span></li>
          </ol>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s065].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>03 · IL RUOLO</div>
      <h2 className={[styles['m-reveal'], styles.s066].filter(Boolean).join(" ")}>Che cosa fa, davvero, un Architetto Patrimoniale.</h2>
      <p className={[styles.s067].filter(Boolean).join(" ")}>Sta nel punto in cui oggi nessuno sta: tra le domande di una persona sul proprio patrimonio e le scelte che dovrà fare.</p>

      <div className={[styles['m-col'], styles.s068].filter(Boolean).join(" ")}>
        <div className={[styles.s069].filter(Boolean).join(" ")}>
          <div className={[styles.s070].filter(Boolean).join(" ")}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="1.2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"></path><path d="M17.5 4.5l1.5-1.5M19 7h2" strokeLinecap="round"></path></svg>
          </div>
          <div className={[styles.s071].filter(Boolean).join(" ")}>PUNTO DI PARTENZA</div>
          <div className={[styles.s072].filter(Boolean).join(" ")}>Persona o imprenditore</div>
          <div className={[styles.s073].filter(Boolean).join(" ")}>Domande sparse, obiettivi confusi, timori sul futuro.</div>
        </div>
        <div className={[styles['m-vline'], styles.s074, styles['flowline']].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s075].filter(Boolean).join(" ")}>
          <div className={[styles.s076, styles['pulse']].filter(Boolean).join(" ")}>
            <div className={[styles.s077].filter(Boolean).join(" ")}>TU</div>
            <div className={[styles.s078].filter(Boolean).join(" ")}>Architetto<br />Patrimoniale</div>
          </div>
          <div className={[styles.s079].filter(Boolean).join(" ")}>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Comprendere</span>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Accompagnare</span>
            <span className={[styles.s080].filter(Boolean).join(" ")}>Crescere</span>
          </div>
        </div>
        <div className={[styles['m-vline'], styles.s074, styles['flowline']].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s069].filter(Boolean).join(" ")}>
          <div className={[styles.s081].filter(Boolean).join(" ")}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="1.2" aria-hidden="true"><path d="M3 20h18M5 20V10l7-6 7 6v10"></path><path d="M9 20v-6h6v6"></path></svg>
          </div>
          <div className={[styles.s071].filter(Boolean).join(" ")}>PUNTO DI ARRIVO</div>
          <div className={[styles.s072].filter(Boolean).join(" ")}>Scelte consapevoli</div>
          <div className={[styles.s073].filter(Boolean).join(" ")}>Priorità chiare e i professionisti giusti per i passi successivi.</div>
        </div>
      </div>
      <p className={[styles.s082].filter(Boolean).join(" ")}>[NOTA DI CONFORMITÀ: perimetro del ruolo rispetto alla consulenza finanziaria regolamentata]</p>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s083].filter(Boolean).join(" ")}>
    <Image width={2000} height={1131} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s084, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/blueprint.jpg" alt="" aria-hidden="true" />
    <div className={[styles.s085].filter(Boolean).join(" ")} aria-hidden="true"></div>
    <div className={[styles.s086].filter(Boolean).join(" ")}>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>04 · COME TI SOSTENIAMO</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>Un percorso costruito come un edificio.</h2>
        <p className={[styles.s089].filter(Boolean).join(" ")}>Nessuno ti lascia da solo con un manuale. Ogni elemento regge il successivo: senza fondamenta non si costruisce, senza colonne non si sale.</p>
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
          <div className={[styles['m-annot'], styles.s097].filter(Boolean).join(" ")}>
            <div className={[styles.s098].filter(Boolean).join(" ")}><div className={[styles.s099].filter(Boolean).join(" ")}>↑ TETTO</div>Il ruolo che costruisci</div>
            <div className={[styles.s098].filter(Boolean).join(" ")}><div className={[styles.s099].filter(Boolean).join(" ")}>↕ COLONNE</div>Un senior accanto a te, un metodo replicabile, una rete di colleghi</div>
            <div className={[styles.s098].filter(Boolean).join(" ")}><div className={[styles.s099].filter(Boolean).join(" ")}>↓ FONDAMENTA</div>Contenuti e strumenti da zero · [DURATA]</div>
          </div>
        </div>
        <figcaption className={[styles.s100].filter(Boolean).join(" ")}><span>TAV. 01 — STRUTTURA DEL PERCORSO</span><span>HORYZON</span></figcaption>
      </figure>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s101].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>05 · IL PROSSIMO PASSO, INSIEME</div>
      <h2 className={[styles['m-reveal'], styles.s102].filter(Boolean).join(" ")}>Non devi scegliere oggi. Devi solo fare il primo passo.</h2>
      <div className={[styles.s103].filter(Boolean).join(" ")}>
        <div className={[styles['m-track'], styles.s104].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles['m-prog'], styles.s105].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <ol className={[styles['m-steps'], styles.s106].filter(Boolean).join(" ")}>
          <li>
            <div className={[styles.s107, styles['pulse']].filter(Boolean).join(" ")}></div>
            <div className={[styles.s108].filter(Boolean).join(" ")}>SEI QUI</div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Conosci il progetto</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Presentazione live, 30 minuti. <span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span>.</p>
          </li>
          <li>
            <div className={[styles.s111].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Raccontaci chi sei</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Esperienza, obiettivi e cosa stai cercando.</p>
          </li>
          <li>
            <div className={[styles.s111].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Colloquio individuale</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Solo se ci sono i presupposti, da entrambe le parti.</p>
          </li>
          <li>
            <div className={[styles.s113].filter(Boolean).join(" ")}></div>
            <div className={[styles.s112].filter(Boolean).join(" ")}></div>
            <h3 className={[styles.s109].filter(Boolean).join(" ")}>Inizia il percorso</h3>
            <p className={[styles.s110].filter(Boolean).join(" ")}>Formazione e inserimento, se decidete di proseguire.</p>
          </li>
        </ol>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s114].filter(Boolean).join(" ")}>
      <div className={[styles.s115].filter(Boolean).join(" ")}>
        <Image width={1800} height={1018} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s116, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/founder.jpg" alt="Immagine AI provvisoria: Il fondatore di Horyzon parla in camera" />
        <div className={[styles.s117].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <div className={[styles.s118].filter(Boolean).join(" ")} aria-hidden="true"></div>
        <button disabled title="Video del fondatore da fornire" className={[styles.s119, styles['pulse']].filter(Boolean).join(" ")} type="button" aria-label="Video del fondatore — placeholder non disponibile"><svg width="28" height="28" viewBox="0 0 24 24" fill="#07171D" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></button>
        <div className={[styles.s120].filter(Boolean).join(" ")}><span>PERCHÉ NASCE QUESTA DIVISIONE</span><span>1:30</span></div>
      </div>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>06 · PERCHÉ LO FACCIAMO</div>
        <h2 className={[styles['m-reveal'], styles.s121].filter(Boolean).join(" ")}>&quot;[Frase del fondatore, in prima persona, sul perché del progetto.]&quot;</h2>
        <p className={[styles.s122].filter(Boolean).join(" ")}>[3–4 righe di storia vera: cosa ha visto nel mercato, quale vuoto vuole colmare, perché formare persone invece di vendere prodotti.]</p>
        <div className={[styles.s123].filter(Boolean).join(" ")}>
          <div className={[styles.s124].filter(Boolean).join(" ")}></div>
          <div><div className={[styles.s125].filter(Boolean).join(" ")}>[NOME FONDATORE]</div><div className={[styles.s126].filter(Boolean).join(" ")}>[Ruolo] · Horyzon</div></div>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>07 · CHI HA GIÀ INIZIATO</div>
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
      <div className={[styles.s043].filter(Boolean).join(" ")}>08 · NON È PER TUTTI</div>
      <h2 className={[styles['m-reveal'], styles.s127].filter(Boolean).join(" ")}>Preferiamo dirtelo subito.</h2>
      <div className={[styles.s135].filter(Boolean).join(" ")}>
        <div className={[styles.s136].filter(Boolean).join(" ")}>
          <h3 className={[styles.s137].filter(Boolean).join(" ")}>È il tuo percorso se…</h3>
          <ul className={[styles.s138].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Ti piace lavorare con le persone e sai costruire relazioni</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Hai esperienza commerciale, imprenditoriale o consulenziale</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Vuoi imparare prima di proporre</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Cerchi crescita personale e professionale</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Sei disposto a dedicare tempo alla formazione</span></li>
          </ul>
        </div>
        <div className={[styles.s140].filter(Boolean).join(" ")}>
          <h3 className={[styles.s141].filter(Boolean).join(" ")}>Non è il tuo percorso se…</h3>
          <ul className={[styles.s142].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Cerchi un guadagno rapido o garantito</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Vuoi semplicemente vendere un prodotto</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Non vuoi dedicare tempo alla formazione</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Cerchi un&#x27;attività completamente passiva</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Vuoi saltare la conoscenza reciproca e la selezione</span></li>
          </ul>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s143].filter(Boolean).join(" ")}>
      <div className={[styles.s144].filter(Boolean).join(" ")}>
        <div className={[styles.s043].filter(Boolean).join(" ")}>09 · LA PRESENTAZIONE</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>30 minuti che ti risparmiano mesi di dubbi.</h2>
        <p className={[styles.s145].filter(Boolean).join(" ")}>Live, con spazio per le tue domande. Alla fine sai se vale la pena fare il passo successivo.</p>
        <a className={[styles.s146].filter(Boolean).join(" ")} href="#richiesta">Riserva il mio posto</a>
      </div>
      <ol className={[styles.s147].filter(Boolean).join(" ")}>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>00–04&#x27;</span><span>Perché Horyzon sta aprendo questa divisione proprio adesso</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>04–09&#x27;</span><span>Il bisogno che quasi nessuno sta servendo nelle famiglie italiane</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>09–15&#x27;</span><span>Come funziona la formazione, passo per passo</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>15–19&#x27;</span><span>Le 3 caratteristiche che contano più dell&#x27;esperienza</span></li>
        <li className={[styles.s150].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>19–25&#x27;</span><span><strong>Una giornata tipo dell&#x27;Architetto</strong>, raccontata da chi la vive</span></li>
        <li className={[styles.s151].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>25–30&#x27;</span><span>Le tue domande, dal vivo</span></li>
      </ol>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>10 · TRA UN ANNO</div>
      <h2 className={[styles['m-reveal'], styles.s152].filter(Boolean).join(" ")}>Tra dodici mesi sarai in uno di questi due posti.</h2>
      <div className={[styles.s135].filter(Boolean).join(" ")}>
        <div className={[styles.s153].filter(Boolean).join(" ")}>
          <div className={[styles.s154].filter(Boolean).join(" ")}><Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s155, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/stuck.jpg" alt="Immagine AI provvisoria: Una scrivania d&#x27;ufficio vuota di sera" /></div>
          <div className={[styles.s156].filter(Boolean).join(" ")}>
            <div className={[styles.s157].filter(Boolean).join(" ")}>SE CHIUDI QUESTA PAGINA</div>
            <p className={[styles.s158].filter(Boolean).join(" ")}>Stessa scrivania, stesse domande della domenica sera. Continuerai ad aiutare gli amici gratis, chiedendoti ogni tanto &quot;e se…?&quot;</p>
          </div>
        </div>
        <div className={[styles.s159].filter(Boolean).join(" ")}>
          <div className={[styles.s154].filter(Boolean).join(" ")}><Image width={1400} height={935} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/conversazione.jpg" alt="Una professionista al portatile spiega un progetto a un cliente seduto di fronte a lei" /></div>
          <div className={[styles.s156].filter(Boolean).join(" ")}>
            <div className={[styles.s160].filter(Boolean).join(" ")}>SE DEDICHI 30 MINUTI</div>
            <p className={[styles.s161].filter(Boolean).join(" ")}>Scopri un mestiere che ti somiglia e le persone pronte a insegnartelo. <strong className={[styles.s016].filter(Boolean).join(" ")}>In ogni caso, avrai scelto tu.</strong></p>
          </div>
        </div>
      </div>
    </div>
  </section>


  <section ref={formRef} className={[styles['m-sec'], styles.s162].filter(Boolean).join(" ")} id="richiesta">
    <div className={[styles.s163].filter(Boolean).join(" ")}>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>11 · RISERVA IL TUO POSTO</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>Il tuo posto per <span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span>.</h2>
        <p className={[styles.s164].filter(Boolean).join(" ")}>Ogni richiesta viene letta da una persona del team, non da un algoritmo.</p>
        <div className={[styles.s165].filter(Boolean).join(" ")}>
          <div className={[styles.s166].filter(Boolean).join(" ")}><span>Posti riservati per questa sessione</span><strong className={[styles.s016].filter(Boolean).join(" ")}><span data-bind="seatsTaken"><SessionValue name="seatsTaken" /></span> / <span data-bind="seatsTotal"><SessionValue name="seatsTotal" /></span></strong></div>
          <div className={[styles.s167].filter(Boolean).join(" ")}><SeatBar /></div>
          <div className={[styles.s169].filter(Boolean).join(" ")}>Sessioni a numero chiuso, per rispondere a ogni domanda. Prossima data disponibile: [DATA SUCCESSIVA].</div>
        </div>
        <div className={[styles.s170].filter(Boolean).join(" ")}>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Ricevi subito link e promemoria in calendario</span></div>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Ti ricordiamo l&#x27;appuntamento il giorno prima e un&#x27;ora prima</span></div>
          <div className={[styles.s171].filter(Boolean).join(" ")}><span className={[styles.s172].filter(Boolean).join(" ")}>→</span><span>Dopo la presentazione decidi tu se proseguire</span></div>
        </div>
      </div>

      <PatrimonialLeadForm mode="architect-path" presentation="architect" selectedProfile={selected?.value ?? ""} onProfileChange={chooseValue} />
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s173].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>12 · DOMANDE FREQUENTI</div>
      <h2 className={[styles['m-reveal'], styles.s174].filter(Boolean).join(" ")}>Le domande che ci fanno tutti.</h2>
      <div className={[styles.s175].filter(Boolean).join(" ")}>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Devo investire dei soldi per entrare nel percorso?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>No. Entrare nel percorso non costa nulla: nessuna quota d&#x27;ingresso, nessun acquisto obbligatorio, nessun vincolo.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Serve un&#x27;abilitazione o un&#x27;iscrizione a un albo?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>No. Non serve alcuna abilitazione né iscrizione a un albo: l&#x27;Architetto lavora in partnership con fornitori regolamentati dalla legge.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Quanto tempo devo dedicare?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Puoi iniziare part-time o full-time: decidi tu quanto tempo dedicare, in base ai tuoi obiettivi.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Come viene riconosciuto economicamente il ruolo?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Con provvigioni sull&#x27;attività di divulgazione che svolgi: la meritocrazia fa la differenza. Non promettiamo guadagni.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>E se non posso esserci live?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Nessun problema: la presentazione viene registrata e dopo la diretta hai 48 ore per rivederla online, gratuitamente.</p></details>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s180].filter(Boolean).join(" ")}>
    <Image width={2400} height={1029} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s181, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/skyline.jpg" alt="" aria-hidden="true" />
    <div className={[styles.s182].filter(Boolean).join(" ")} aria-hidden="true"></div>
    <div className={[styles.s183].filter(Boolean).join(" ")}>
      <h2 className={[styles['m-reveal'], styles.s184].filter(Boolean).join(" ")}>Ogni orizzonte comincia da una conversazione.</h2>
      <p className={[styles.s185].filter(Boolean).join(" ")}>30 minuti, online. Restano <span data-bind="seatsLeft"><SessionValue name="seatsLeft" /></span> posti per <span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span>.</p>
      <a className={[styles.s186].filter(Boolean).join(" ")} href="#richiesta">Riserva il mio posto</a>
      <p className={[styles.s187].filter(Boolean).join(" ")}><strong className={[styles.s188].filter(Boolean).join(" ")}>P.S.</strong> Se sei arrivato fin qui, qualcosa ti ha incuriosito. Non decidere niente adesso: riserva solo il posto. Nel peggiore dei casi avrai capito un mestiere nuovo. Le iscrizioni a questa sessione chiudono tra <span data-bind="cd.d"><SessionValue name="cd.d" /></span> giorni.</p>
    </div>
  </section>

  <footer className={[styles.s189].filter(Boolean).join(" ")}>
    <div className={[styles.s190].filter(Boolean).join(" ")}>
      <div><strong className={[styles.s191].filter(Boolean).join(" ")}>Horyzon Benessere Patrimoniale</strong><p className={styles.pilotNotice}>PILOT · Data, disponibilità e testimonianze da confermare. Alcune immagini sono provvisorie e generate con AI; le foto non ritraggono il team reale.</p><br />FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P. IVA 05120660757</div>
      <div className={[styles.s192].filter(Boolean).join(" ")}><a href="https://www.iubenda.com/privacy-policy/64704330">Privacy</a><a href="https://www.iubenda.com/privacy-policy/64704330/cookie-policy">Cookie</a><a href="mailto:info@horyzon.it">info@horyzon.it</a></div>
    </div>
  </footer>


  <div aria-hidden={!stickyVisible} inert={!stickyVisible} className={[styles.s193, styles.stickyBar, (!stickyVisible ? styles['is-hidden'] : '')].filter(Boolean).join(" ")} id="stickyBar">
    <div className={[styles['m-sticky'], styles.s194].filter(Boolean).join(" ")}>
      <div className={[styles.s195].filter(Boolean).join(" ")}><span className={[styles.s029, styles['pulse']].filter(Boolean).join(" ")}></span><span><span className={styles['m-hide']}><span data-bind="sessionLabel"><SessionValue name="sessionLabel" /></span> · </span><span className={[styles.s016].filter(Boolean).join(" ")}><span data-bind="seatsLeft"><SessionValue name="seatsLeft" /></span> posti liberi</span></span></div>
      <a className={[styles.s196].filter(Boolean).join(" ")} href="#richiesta">Riserva il posto</a>
    </div>
  </div>
</div></SessionProvider>;
}
