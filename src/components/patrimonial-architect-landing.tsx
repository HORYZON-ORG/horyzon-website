'use client';
import Image from 'next/image';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PatrimonialLeadForm } from './patrimonial-lead-form';
import { architectSession, architectSessionSnapshot, architectProfiles, architectDefaultCopy, type ArchitectProfileKey } from '@/content/patrimonial-architect-session';
import { architectAllocation, architectClients, architectInstruments, architectKnownLine, architectTools } from '@/content/patrimonial-architect-content';
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
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [slice, setSlice] = useState<string>('immobili');
  const curSlice = architectAllocation.find(item => item.id === slice) ?? architectAllocation[1];
  const knownCount = Object.keys(known).length;
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
          <h1 className={[styles.s015].filter(Boolean).join(" ")}>Quello che le banche non dicono, qualcuno deve dirlo.<br /><span className={[styles.s016].filter(Boolean).join(" ")}>Può diventare il tuo lavoro.</span></h1>


          <div className={[styles.s017].filter(Boolean).join(" ")}>
            <div className={[styles.s018].filter(Boolean).join(" ")} id="profilo">Da dove parti oggi? <span className={[styles.s019].filter(Boolean).join(" ")}>Scegli e la pagina si adatta a te.</span></div>
            <div className={[styles.s020].filter(Boolean).join(" ")} role="group" aria-label="Il tuo profilo">
              {(Object.keys(architectProfiles) as ArchitectProfileKey[]).map(key => <button key={key} aria-pressed={profile === key} onClick={() => setProfile(key)} className={[styles['chip']].filter(Boolean).join(" ")} type="button" data-profile={key}>{architectProfiles[key].label}</button>)}
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
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>11 anni</div><div className={[styles.s040].filter(Boolean).join(" ")}>di esperienza sul campo</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>10.000+</div><div className={[styles.s040].filter(Boolean).join(" ")}>consulenze patrimoniali</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>Centinaia</div><div className={[styles.s040].filter(Boolean).join(" ")}>di seminari e serate in aula</div></div>
      <div className={[styles.s038].filter(Boolean).join(" ")}><div className={[styles.s039].filter(Boolean).join(" ")}>Milano</div><div className={[styles.s040].filter(Boolean).join(" ")}>sede · FELICITÀ srl</div></div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>01 · DA DOVE PARTI</div>
      <h2 className={[styles['m-reveal'], styles.s044].filter(Boolean).join(" ")}>Forse lo stai vivendo adesso.</h2>
      <div className={[styles['m-only'], styles.swipeHint].join(" ")}>SCORRI LE SCHEDE →</div>
      <div data-carousel="scenes" role="region" aria-label="Scene da scorrere" tabIndex={0} className={[styles['m-swipe'], styles.s045].filter(Boolean).join(" ")}>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'domenica' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="domenica">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-domenica.jpg" alt="Immagine AI provvisoria: Un uomo pensieroso, solo al tavolo della cucina di sera" />

                <div hidden={selected?.scene !== 'domenica'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>DOMENICA, 22:40</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Pensi già al lunedì: obiettivi, classifiche, telefonate. Oppure il lunedì non ce l’hai, e mandi curriculum che nessuno legge. <strong>In entrambi i casi ti chiedi: è tutto qui?</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'caffe' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="caffe">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-caffe.jpg" alt="Immagine AI provvisoria: Due amici al bar: uno racconta, l’altro ascolta con attenzione" />

                <div hidden={selected?.scene !== 'caffe'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>LA DOMANDA SENZA RISPOSTA</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Un cliente ti chiede dell’oro fisico, di un immobile a reddito, di come proteggere quello che ha. La risposta la conosci. <strong>Ma nel tuo listino non c’è.</strong></p>
            </figcaption>
          </figure>

          <figure className={[styles['m-reveal'], styles['scene'], (selected ? selected.scene === 'opportunita' ? styles['is-mine'] : styles['is-dim'] : '')].filter(Boolean).join(" ")} data-scene="opportunita">
            <div className={[styles.s046].filter(Boolean).join(" ")}>
              <Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/scene-opportunita.jpg" alt="Immagine AI provvisoria: Una mano chiude con decisione un portatile, accanto a una brochure" />

                <div hidden={selected?.scene !== 'opportunita'} className={[styles.s047, styles['badge']].filter(Boolean).join(" ")}>PROBABILMENTE È LA TUA</div>

            </div>
            <figcaption className={[styles.s048].filter(Boolean).join(" ")}>
              <div className={[styles.s049].filter(Boolean).join(" ")}>IL PRODOTTO DEL MESE</div>
              <p className={[styles.s050].filter(Boolean).join(" ")}>Arriva la campagna: un fondo della casa da collocare entro fine trimestre. Sai che a quel cliente non serve. <strong>Lo proponi lo stesso, perché il budget è il budget.</strong></p>
            </figcaption>
          </figure>

      </div>
      <p className={[styles.s051].filter(Boolean).join(" ")}>Se almeno una di queste scene ti suona familiare, non ti manca la competenza.<br /><span className={[styles.s052].filter(Boolean).join(" ")}>Ti manca un posto in cui usarla tutta.</span></p>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.aClients].join(" ")} data-architect-section="clients">
    <div className={styles.s042}>
      <div className={styles.aKicker}>02 · LE PERSONE CHE AIUTERAI</div>
      <h2 className={[styles['m-reveal'], styles.aTitle].join(" ")}>Ogni settimana incontrerai una di queste quattro persone.</h2>
      <p className={styles.aLead}>Sono le stesse che vengono alle serate Horyzon «Quello che le banche non dicono». A ognuna manca qualcosa di diverso. Il tuo lavoro è capire cosa, e portarglielo.</p>
      <div className={[styles['m-only'], styles.swipeHint].join(" ")}>SCORRI LE SCHEDE →</div>
      <div className={[styles['m-swipe'], styles.aClientGrid].join(" ")}>
        {architectClients.map((client, index) => <figure key={client.id} className={styles.aClient}>
          <div className={styles.aClientImg}><Image src={client.img} alt={client.alt} fill sizes="(max-width: 700px) 84vw, 300px" className={styles.cover} /><span className={styles.aClientNum}>0{index + 1}</span><span className={styles.aClientLabel}>{client.label}</span></div>
          <figcaption className={styles.aClientBody}>
            <p className={styles.aClientPain}>{client.pain}</p>
            <div className={styles.aClientTool}><span>GLI PORTI</span><strong>{client.tool}</strong><p>{client.give}</p></div>
          </figcaption>
        </figure>)}
      </div>
      <div className={styles.aBridge}><span className={styles.aBridgeDot} /><p>Non devi cercarle una a una: chi partecipa alle serate può chiedere <strong>40 minuti di confronto con un Architetto Patrimoniale</strong>. Quei 40 minuti sono il tuo primo incontro.</p></div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>03 · LA DIFFERENZA</div>
      <h2 className={[styles['m-reveal'], styles.s055].filter(Boolean).join(" ")}>Un venditore parte dal prodotto.<br /><span className={[styles.s016].filter(Boolean).join(" ")}>Un Architetto parte dalla persona.</span></h2>
      <div className={[styles.s056].filter(Boolean).join(" ")}>
        <div className={[styles.s057].filter(Boolean).join(" ")}>
          <div className={[styles.s058].filter(Boolean).join(" ")}>IL MODELLO CHE CONOSCI</div>
          <ol className={[styles.s059].filter(Boolean).join(" ")}>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>01</span><span>Il prodotto lo sceglie la sede, non il cliente</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>02</span><span>Budget e classifiche ogni trimestre</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>03</span><span>Puoi parlare solo della metà finanziaria</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>04</span><span>Al primo calo il cliente se ne va</span></li>
          </ol>
        </div>
        <div className={[styles.s062].filter(Boolean).join(" ")}>
          <div className={[styles.s063].filter(Boolean).join(" ")}>IL MODELLO HORYZON</div>
          <ol className={[styles.s064].filter(Boolean).join(" ")}>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>01</span><span>Parti dalla persona e dal suo mese: regola 70-10-10-10</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>02</span><span>Guardate insieme tutta la mappa, non solo metà</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>03</span><span>Ogni strumento al suo posto, con il suo perché</span></li>
            <li className={[styles.s060].filter(Boolean).join(" ")}><span className={[styles.s061].filter(Boolean).join(" ")}>04</span><span>La relazione dura anni, non un trimestre</span></li>
          </ol>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.aMap].join(" ")} data-architect-section="map">
    <div className={styles.s042}>
      <div className={styles.aKicker}>04 · LA METÀ CHE MANCA</div>
      <h2 className={[styles['m-reveal'], styles.aTitle].join(" ")}>In banca ti hanno fatto vedere metà della mappa.</h2>
      <p className={styles.aLead}>I grandi patrimoni ragionano 50/50: metà in beni reali, metà in beni finanziari. Chi viene dal settore conosce bene la seconda metà. Un Architetto Patrimoniale le sa usare tutte e due.</p>
    </div>
    <div className={styles.aSplitHero}>
      <Image src="/benessere-patrimoniale/evento/diversificazione.jpg" alt="Composizione divisa a metà da una linea di luce: a sinistra lingotti e una piccola casa, a destra un globo d'oro e colonne crescenti" fill sizes="(max-width: 1280px) 100vw, 1232px" className={styles.aSplitImg} />
      <div className={[styles.aHalfTag, styles.aHalfLeft].join(" ")}><strong>50%</strong><span>Beni reali · quello che in filiale non trovi</span></div>
      <div className={[styles.aHalfTag, styles.aHalfRight].join(" ")}><strong>50%</strong><span>Beni finanziari · quello che conosci già</span></div>
    </div>
    <div className={styles.aSplitBody}>
      <div className={styles.aAlloc} role="group" aria-label="La mappa 50/50: tocca una parte">
        {(['reali', 'finanziari'] as const).map(half => <div key={half} className={styles.aAllocHalf}>
          {architectAllocation.filter(item => item.half === half).map(item => <button type="button" key={item.id} aria-pressed={slice === item.id} aria-label={`${item.name} ${item.share}%`} onClick={() => setSlice(item.id)} className={[styles.aAllocSeg, slice === item.id ? styles.aOn : ''].join(" ")} style={{ width: `${item.share * 2}%` }}><span className={styles.aAllocFill} style={{ background: item.color }} /><span className={styles.aAllocPct}>{item.share}%</span></button>)}
        </div>)}
      </div>
      <div className={styles.aAllocScale}><span>Beni reali · la metà nuova</span><span>Beni finanziari · la metà che conosci</span></div>
      <div className={styles.aAllocGrid}>
        <div className={styles.aAllocList}>
          {architectAllocation.map(item => <button type="button" key={item.id} aria-pressed={slice === item.id} onClick={() => setSlice(item.id)} className={[styles.aLegend, slice === item.id ? styles.aOn : ''].join(" ")}><span className={styles.aSwatch} style={{ background: item.color }} /><span>{item.name}</span><strong>{item.share}%</strong></button>)}
        </div>
        <div className={styles.aWhy} style={{ borderColor: curSlice.color }}>
          <div className={styles.aWhyShare} style={{ color: curSlice.color }}>{curSlice.share}%</div>
          <strong>{curSlice.name}</strong>
          <span>{curSlice.why}</span>
          <span className={styles.aWhyNote}>{curSlice.half === 'reali' ? 'È la metà che nella formazione impari da zero: come si sceglie, come si spiega, quando ha senso.' : 'È la metà che probabilmente conosci già. Nel percorso impari a metterla in equilibrio con l’altra.'}</span>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s065].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>05 · IL RUOLO</div>
      <h2 className={[styles['m-reveal'], styles.s066].filter(Boolean).join(" ")}>Che cosa fa, davvero, un Architetto Patrimoniale.</h2>
      <p className={[styles.s067].filter(Boolean).join(" ")}>Sta nel punto in cui oggi nessuno sta: tra le domande di una persona sul proprio patrimonio e le scelte che dovrà fare.</p>

      <div className={[styles['m-col'], styles.s068].filter(Boolean).join(" ")}>
        <div className={[styles.s069].filter(Boolean).join(" ")}>
          <div className={[styles.s070].filter(Boolean).join(" ")}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="1.2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"></path><path d="M17.5 4.5l1.5-1.5M19 7h2" strokeLinecap="round"></path></svg>
          </div>
          <div className={[styles.s071].filter(Boolean).join(" ")}>PUNTO DI PARTENZA</div>
          <div className={[styles.s072].filter(Boolean).join(" ")}>Famiglia o imprenditore</div>
          <div className={[styles.s073].filter(Boolean).join(" ")}>Risparmi fermi, prodotti non capiti, metà della mappa scoperta.</div>
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
          <div className={[styles.s073].filter(Boolean).join(" ")}>Un piano su tutta la mappa e i professionisti giusti per i passi successivi.</div>
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
        <div className={[styles.s054].filter(Boolean).join(" ")}>06 · COME TI FORMIAMO</div>
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
            <div className={[styles.s098].filter(Boolean).join(" ")}><div className={[styles.s099].filter(Boolean).join(" ")}>↓ FONDAMENTA</div>Regola 70-10-10-10, mappa 50/50, le 8 famiglie di strumenti · [DURATA]</div>
          </div>
        </div>
        <figcaption className={[styles.s100].filter(Boolean).join(" ")}><span>TAV. 01 — STRUTTURA DEL PERCORSO</span><span>HORYZON</span></figcaption>
      </figure>

      <div className={styles.aTools}>
        <div className={styles.aToolsHead}><span className={styles.aKicker}>LA TUA CASSETTA DEGLI ATTREZZI</span><p>Gli stessi strumenti che le famiglie scoprono alle serate Horyzon. Tu impari a usarli, uno per uno.</p></div>
        <div className={[styles['m-swipe'], styles.aToolGrid].join(" ")}>
          {architectTools.map(tool => <article key={tool.id} className={styles.aTool}>
            <div className={styles.aToolImg}><Image src={tool.img} alt="" fill sizes="(max-width: 700px) 84vw, 300px" className={styles.cover} /></div>
            <div className={styles.aToolBody}><span>{tool.kicker}</span><h3>{tool.name}</h3><p>{tool.text}</p></div>
          </article>)}
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.aQuiz].join(" ")} data-architect-section="quiz">
    <div className={styles.s042}>
      <div className={styles.aKicker}>07 · IL TUO PUNTO DI PARTENZA</div>
      <h2 className={[styles['m-reveal'], styles.aTitle].join(" ")}>Quante di queste sapresti già spiegare a un cliente?</h2>
      <p className={styles.aLead}>Tocca quelle che conosci. Tocca di nuovo per toglierle. Non è un esame: serve a capire da dove parti.</p>
      <div className={styles.aTiles}>
        {architectInstruments.map(item => <button type="button" key={item.id} aria-pressed={!!known[item.id]} onClick={() => setKnown(prev => { const next = { ...prev }; if (next[item.id]) delete next[item.id]; else next[item.id] = true; return next; })} className={[styles.aTile, known[item.id] ? styles.aOn : ''].join(" ")}>
          <span className={styles.aTileImg}><Image src={item.img} alt="" fill sizes="(max-width: 700px) 45vw, 280px" className={styles.cover} /></span>
          <span className={styles.aTileCheck} aria-hidden="true">{known[item.id] ? '✓' : '+'}</span>
          {known[item.id] && <span className={styles.aTileHint}>Tocca per togliere</span>}
          <span className={styles.aTileName}>{item.name}</span>
          <span className={styles.aTileBest}>Il migliore: {item.best} · {item.ten}</span>
        </button>)}
      </div>
      <div className={styles.aScore} aria-live="polite">
        <div className={styles.aScoreBar}><span style={{ width: `${knownCount / architectInstruments.length * 100}%` }} /></div>
        <div className={styles.aScoreRow}><strong>{knownCount}<small>/{architectInstruments.length}</small></strong><p>{architectKnownLine(knownCount, architectInstruments.length)}</p></div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s101].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>08 · IL PROSSIMO PASSO, INSIEME</div>
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
            <p className={[styles.s110].filter(Boolean).join(" ")}>Da dove vieni, cosa sai già e cosa stai cercando.</p>
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
            <p className={[styles.s110].filter(Boolean).join(" ")}>Formazione, affiancamento sul campo e i primi incontri dalle serate Horyzon.</p>
          </li>
        </ol>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s114].filter(Boolean).join(" ")}>
      <div className={[styles.s115, styles.aFrankBox].join(" ")}>
        <Image fill sizes="(max-width: 767px) 100vw, 620px" className={[styles.aFrankImg, styles['cover']].join(" ")} src="/people/frank-no-badge.png" alt="Frank Cannoletta, Imprenditore e Strategista Horyzon" />
        <div className={styles.aFrankShade} aria-hidden="true"></div>
        <div className={[styles.s120, styles.aFrankCap].join(" ")}><span>FRANK CANNOLETTA</span><span>STRATEGISTA HORYZON</span></div>
      </div>
      <div className={[styles.s087].filter(Boolean).join(" ")}>
        <div className={[styles.s054].filter(Boolean).join(" ")}>09 · PERCHÉ LO FACCIAMO</div>
        <h2 className={[styles['m-reveal'], styles.s121].filter(Boolean).join(" ")}>&quot;Ho perso un anno di lavoro perché il mio consulente non sapeva leggere il mercato. Oggi formo le persone che avrei voluto incontrare io.&quot;</h2>
        <p className={[styles.s122].filter(Boolean).join(" ")}>Mi ero affidato a un consulente che non ha saputo leggere il mercato, e a me mancavano le competenze per accorgermene in tempo. Da lì ho studiato come ragionano i grandi patrimoni e in 11 anni ho seguito oltre 10.000 consulenze. Le famiglie che vengono alle nostre serate cercano proprio quello che a me è mancato: qualcuno che sappia leggere tutta la mappa. Per questo non cerchiamo venditori. Cerchiamo Architetti.</p>
        <div className={[styles.s123].filter(Boolean).join(" ")}>
          <div className={[styles.s124].filter(Boolean).join(" ")}></div>
          <div><div className={[styles.s125].filter(Boolean).join(" ")}>Frank Cannoletta</div><div className={[styles.s126].filter(Boolean).join(" ")}>Imprenditore e Strategista · Horyzon</div></div>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s041].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s043].filter(Boolean).join(" ")}>10 · CHI HA GIÀ INIZIATO</div>
      <h2 className={[styles['m-reveal'], styles.s127].filter(Boolean).join(" ")}>Sono partiti da dove sei tu.</h2>
      <div className={[styles['m-only'], styles.swipeHint].join(" ")}>SCORRI LE SCHEDE →</div>
      <div data-carousel="stories" role="region" aria-label="Testimonianze da scorrere" tabIndex={0} className={[styles['m-swipe'], styles.s045].filter(Boolean).join(" ")}>

          <figure className={[styles['m-reveal'], styles['story'], (selected?.story === 0 ? styles['is-mine'] : '')].filter(Boolean).join(" ")} data-story="0">
            <div className={[styles.s128].filter(Boolean).join(" ")}>
              <Image width={1400} height={1045} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/story-1.jpg" alt="Immagine AI provvisoria: Ritratto di un’ex commerciale, oggi Architetta" />
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: consulente in banca</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: Architetto</span></div>
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
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: agente assicurativo</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: Architetto</span></div>
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
              <div className={[styles.s129].filter(Boolean).join(" ")}><span className={[styles.s130].filter(Boolean).join(" ")}>PRIMA: in cerca di lavoro</span><span className={[styles.s131].filter(Boolean).join(" ")}>OGGI: in formazione</span></div>
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
      <div className={[styles.s043].filter(Boolean).join(" ")}>11 · NON È PER TUTTI</div>
      <h2 className={[styles['m-reveal'], styles.s127].filter(Boolean).join(" ")}>Preferiamo dirtelo subito.</h2>
      <div className={[styles.s135].filter(Boolean).join(" ")}>
        <div className={[styles.s136].filter(Boolean).join(" ")}>
          <h3 className={[styles.s137].filter(Boolean).join(" ")}>È il tuo percorso se…</h3>
          <ul className={[styles.s138].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Vieni da banca, assicurazioni, consulenza o vendita e vuoi smettere di spingere il prodotto del mese</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Sei senza lavoro o vuoi cambiarlo, e cerchi un mestiere nuovo che ti stimoli</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Vuoi imparare prima di proporre</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Ti piace lavorare con le persone e sai costruire relazioni</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8FF42" strokeWidth="2.2" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span>Sei disposto a dedicare tempo alla formazione</span></li>
          </ul>
        </div>
        <div className={[styles.s140].filter(Boolean).join(" ")}>
          <h3 className={[styles.s141].filter(Boolean).join(" ")}>Non è il tuo percorso se…</h3>
          <ul className={[styles.s142].filter(Boolean).join(" ")}>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Cerchi un guadagno rapido o garantito</span></li>
            <li className={[styles.s139].filter(Boolean).join(" ")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41545A" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg><span>Vuoi continuare a vendere un prodotto, solo con un nome diverso</span></li>
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
        <div className={[styles.s043].filter(Boolean).join(" ")}>12 · LA PRESENTAZIONE</div>
        <h2 className={[styles['m-reveal'], styles.s088].filter(Boolean).join(" ")}>30 minuti che ti risparmiano mesi di dubbi.</h2>
        <p className={[styles.s145].filter(Boolean).join(" ")}>Live, con spazio per le tue domande. Alla fine sai cosa fa un Architetto Patrimoniale, come ti formiamo e se vale la pena fare il passo successivo.</p>
        <a className={[styles.s146].filter(Boolean).join(" ")} href="#richiesta">Riserva il mio posto</a>
      </div>
      <ol className={[styles.s147].filter(Boolean).join(" ")}>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>00–04&#x27;</span><span>Frank: perché Horyzon cerca Architetti, non venditori</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>04–09&#x27;</span><span>Quello che le banche non dicono: la metà della mappa che manca</span></li>
        <li className={[styles.s150].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>09–15&#x27;</span><span><strong>Le quattro persone che incontrerai</strong> e cosa porti a ognuna</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>15–19&#x27;</span><span>La formazione: regola 70-10-10-10, mappa 50/50, Radar Patrimoniale</span></li>
        <li className={[styles.s148].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>19–25&#x27;</span><span>Da dove arrivano le persone: le serate e i 40 minuti di confronto</span></li>
        <li className={[styles.s151].filter(Boolean).join(" ")}><span className={[styles.s149].filter(Boolean).join(" ")}>25–30&#x27;</span><span>Le tue domande, dal vivo</span></li>
      </ol>
    </div>
    <div className={styles.s042}>
      <div className={styles.aBonus}>
        <div className={styles.aKicker}>PARTECIPANDO RICEVI</div>
        <div className={styles.aBonusGrid}>
          <div><span>01</span><strong>Le slide «Quello che le banche non dicono»</strong><p>La stessa presentazione che vedono le famiglie alle serate.</p></div>
          <div><span>02</span><strong>La mappa 50/50 e la regola 70-10-10-10</strong><p>In una pagina, da tenere sulla scrivania.</p></div>
          <div><span>03</span><strong>Un colloquio individuale</strong><p>Con un Architetto senior, se ci sono i presupposti da entrambe le parti.</p></div>
        </div>
      </div>
    </div>
  </section>


  <section className={[styles['m-sec'], styles.s053, styles['bp']].filter(Boolean).join(" ")}>
    <div className={[styles.s042].filter(Boolean).join(" ")}>
      <div className={[styles.s054].filter(Boolean).join(" ")}>13 · TRA UN ANNO</div>
      <h2 className={[styles['m-reveal'], styles.s152].filter(Boolean).join(" ")}>Tra dodici mesi sarai in uno di questi due posti.</h2>
      <div className={[styles.s135].filter(Boolean).join(" ")}>
        <div className={[styles.s153].filter(Boolean).join(" ")}>
          <div className={[styles.s154].filter(Boolean).join(" ")}><Image width={1400} height={930} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 80vw, 620px" className={[styles.s155, styles['cover']].filter(Boolean).join(" ")} src="/benessere-patrimoniale/percorso-architetto/stuck.jpg" alt="Immagine AI provvisoria: Una scrivania d&#x27;ufficio vuota di sera" /></div>
          <div className={[styles.s156].filter(Boolean).join(" ")}>
            <div className={[styles.s157].filter(Boolean).join(" ")}>SE CHIUDI QUESTA PAGINA</div>
            <p className={[styles.s158].filter(Boolean).join(" ")}>Stesso budget, stesso prodotto del mese, o lo stesso annuncio di lavoro da rileggere. E la stessa domanda della domenica sera: &quot;e se…?&quot;</p>
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
        <div className={[styles.s054].filter(Boolean).join(" ")}>14 · RISERVA IL TUO POSTO</div>
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
      <div className={[styles.s043].filter(Boolean).join(" ")}>15 · DOMANDE FREQUENTI</div>
      <h2 className={[styles['m-reveal'], styles.s174].filter(Boolean).join(" ")}>Le domande che ci fanno tutti.</h2>
      <div className={[styles.s175].filter(Boolean).join(" ")}>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Lavoro in banca: devo lasciare subito il mio lavoro?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>No. Alla presentazione capisci come funziona il percorso. Tempi e modi di un eventuale passaggio si valutano insieme nel colloquio individuale.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Non vengo dal settore. Posso candidarmi?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Sì. La formazione parte dalle basi: la regola 70-10-10-10, la mappa 50/50, le otto famiglie di strumenti. Contano di più ascolto, costanza e voglia di imparare.</p></details>
        <details className={[styles.s176].filter(Boolean).join(" ")}><summary className={[styles.s177].filter(Boolean).join(" ")}>Devo portare un mio portafoglio clienti?<span className={[styles.s178, styles['plus']].filter(Boolean).join(" ")}>+</span></summary><p className={[styles.s179].filter(Boolean).join(" ")}>Non è un requisito. Chi partecipa alle serate Horyzon può chiedere 40 minuti di confronto con un Architetto: è da lì che partono molti incontri. [DETTAGLI DA CONFERMARE.]</p></details>
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
      <p className={[styles.s187].filter(Boolean).join(" ")}><strong className={[styles.s188].filter(Boolean).join(" ")}>P.S.</strong> Se sei arrivato fin qui, qualcosa ti ha incuriosito. Non decidere niente adesso: riserva solo il posto. Nel peggiore dei casi avrai visto la mappa intera, e capito un mestiere nuovo. Le iscrizioni a questa sessione chiudono tra <span data-bind="cd.d"><SessionValue name="cd.d" /></span> giorni.</p>
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
