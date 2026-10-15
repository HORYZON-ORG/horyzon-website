'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { PatrimonialLeadForm } from './patrimonial-lead-form';
import { EventSessionProvider, EventSessionValue } from './patrimonial-event-clock';
import { eventSession } from '@/content/patrimonial-event-session';
import { eventScenes, eventFormTitle, eventCalculator } from '@/content/patrimonial-event-content';
import styles from './patrimonial-event.module.css';

// Existing event interactions with route-scoped presentation from the mobile reference.
// The clock has its own provider so second ticks only rerender session consumers.
export function PatrimonialEventLanding() {
  const [scene, setScene] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [amount, setAmount] = useState(100000);
  const cur = eventScenes.find(item => item.id === scene);
  const calc = eventCalculator(amount);
  const formTitle = eventFormTitle(selectedProfile);
  return <EventSessionProvider><div data-session-status={eventSession.status} data-availability={eventSession.status === 'PLACEHOLDER' ? 'demo' : 'confirmed'} className={[styles.s000, styles.page].join(' ')}>

<div data-event-section="urgency" className={[styles.s001].join(' ')}>
<span className={styles.s002}><span className={styles["live-dot"]} aria-hidden="true" />Iscrizioni aperte · restano <strong><EventSessionValue name="seatsLeft" /> posti su <EventSessionValue name="seatsTotal" /></strong> · <EventSessionValue name="eventLabel" /></span>
</div>

<div data-event-section="hero" className={[styles["hero"], styles.s004].join(' ')}>
<div className={[styles.s005].join(' ')}>
<div className={[styles.s006].join(' ')}>
<span className={[styles.s007].join(' ')}>HORYZON</span>
<span className={[styles.s008].join(' ')}>Benessere Patrimoniale</span>
</div>
<a href="#richiesta" className={[styles["cta"], styles["cta-ghost"], styles.s009].join(' ')}>Riserva il posto</a>
</div>
<div className={[styles["hero-inner"], styles.s010].join(' ')}>
<div className={[styles.s011].join(' ')}>
<div className={[styles["label"], styles["load-1"], styles.s012].join(' ')}>Evento online gratuito · Per chi ha risparmi, un&apos;impresa o una famiglia da proteggere</div>
<h1 className={[styles["load-2"], styles.s013].join(' ')}>Quello che le banche <span className={[styles["chip-lime"], styles.s014].join(' ')}>non</span> dicono.</h1>
<p className={[styles["load-3"], styles.s015].join(' ')}>Hai lavorato anni per mettere da parte qualcosa. In 90 minuti scopri <strong className={[styles.s003].join(' ')}>le 6 domande da fare prima di affidarlo a chiunque</strong>, e che ruolo può avere l&apos;oro fisico in un patrimonio davvero diversificato.</p>
<div className={[styles["load-4"], styles.s016].join(' ')}>
<div className={[styles.s017].join(' ')}>L&apos;INCONTRO INIZIA TRA</div>
<div className={[styles["cd-row"], styles.s018].join(' ')}>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.d" /></div><div className={[styles.s021].join(' ')}>GIORNI</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.h" /></div><div className={[styles.s021].join(' ')}>ORE</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.m" /></div><div className={[styles.s021].join(' ')}>MINUTI</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.accent, styles["sec-box"], styles.s020].join(' ')}><EventSessionValue name="cd.s" /></div><div className={[styles.s021].join(' ')}>SECONDI</div></div>
</div>
</div>
<div className={[styles["stack-m"], styles["load-4"], styles.s022].join(' ')}>
<a href="#richiesta" className={[styles.cta, styles.s023].join(' ')}>Sì, riservo il mio posto gratuito
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
<div className={[styles.s024].join(' ')}>
<div className={[styles.s025].join(' ')}>
<span className={[styles.s026].join(' ')}></span>
<span className={[styles.s027].join(' ')}></span>
<span className={[styles.s028].join(' ')}></span>
</div>
<span className={[styles.s029].join(' ')}><strong className={[styles.s003].join(' ')}><EventSessionValue name="seatsTaken" /> persone</strong> hanno già<br />riservato il loro posto</span>
</div>
</div>
<div className={[styles.s030].join(' ')}>Gratuito · Online · Nessuna vendita durante l&apos;incontro</div>
</div>
<div className={[styles["tile-d"], styles["hero-chip"], styles.s031].join(' ')}>
<div className={[styles.s032].join(' ')}><span>Posti occupati</span><strong className={[styles.s003].join(' ')}><EventSessionValue name="seatsTaken" /> / <EventSessionValue name="seatsTotal" /></strong></div>
<div className={[styles.s033].join(' ')}><div style={ { width: `${eventSession.seatsTaken / eventSession.seatsTotal * 100}%` }} className={[styles.s034].join(' ')}></div></div>
<div className={[styles.s035].join(' ')}>Limitati per rispondere a tutte le domande dal vivo.</div>
</div>
</div>
</div>

<div data-event-section="social-proof" className={[styles.s036].join(' ')}>
<div className={[styles.s037].join(' ')}>
<span><strong className={[styles.s038].join(' ')}>[000]+</strong> persone ai nostri incontri</span>
<span><strong className={[styles.s038].join(' ')}>[4,9/5]</strong> valutazione dei partecipanti</span>
<span><strong className={[styles.s038].join(' ')}>[00] anni</strong> tra impresa e patrimonio</span>
<span><strong className={[styles.s038].join(' ')}>0</strong> prodotti venduti durante l&apos;evento</span>
</div>
</div>

<div data-event-section="scenes" className={[styles.s039].join(' ')}>
<div className={[styles.s040].join(' ')}>
<div className={[styles.s041].join(' ')}>PRIMA DI TUTTO, PARLIAMO DI TE</div>
<h2 className={[styles.reveal, styles.s042].join(' ')}>In quale di queste scene <span className={styles["chip-ink"]}>ti rivedi?</span></h2>
<p className={[styles.s043].join(' ')}>Tocca quella che ti somiglia di più: ti diciamo cosa troverai, per te, nell&apos;incontro.</p>
<p className={`${styles["swipe-hint"]} ${styles.label}`}>Scorri le 4 scene →</p>
</div>
<div data-carousel="s044" role="region" aria-label="Le quattro scene" tabIndex={0} className={[styles["snap"], styles.s044].join(' ')}>
{eventScenes.map(item => (<button type="button" aria-pressed={scene === item.id} key={item.id} data-scene={item.id} onClick={() => { setScene(item.id); setSelectedProfile(item.profile); }} className={[styles.scene, scene === item.id ? styles.on : ''].join(' ')}>
<div className={[styles.s045].join(' ')}>
<Image src={item.img} alt={item.alt} width={1000} height={720} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s046].join(' ')} />
<span className={[styles["tick"], styles.s047].join(' ')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span>
<span className={[styles.s048].join(' ')}>{item.label}</span>
</div>
<div className={[styles.s049].join(' ')}>
<span className={[styles.s050].join(' ')}>{item.text}</span>
<span className={[styles.s051].join(' ')}>&quot;{item.thought}&quot;</span>
</div>
</button>))}
</div>
{cur && (<div className={[styles.s052].join(' ')}>
<div className={[styles.s053].join(' ')}>
<div className={[styles.s054].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}><span data-bind="cur.kicker">{cur.kicker}</span></div>
<div className={[styles.s055].join(' ')}><span data-bind="cur.answer">{cur.answer}</span></div>
<div className={[styles.s056].join(' ')}><span data-bind="cur.detail">{cur.detail}</span></div>
</div>
<a href="#richiesta" className={[styles.cta, styles.s057].join(' ')}><span data-bind="cur.cta">{cur.cta}</span>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
</div>
</div>)}
{!cur && (<div className={[styles.s052].join(' ')}>
<div className={[styles.s058].join(' ')}>
<span className={[styles.s059].join(' ')}>Non sei distratto, e non sei l&apos;unico: <em>nessuno ti ha mai spiegato le regole del gioco.</em></span>
<span className={[styles.s060].join(' ')}>↑ Scegli una scena per vedere cosa c&apos;è per te</span>
</div>
</div>)}
</div>

<div data-event-section="calculator" className={[styles.s061].join(' ')}>
<div className={[styles.s062].join(' ')}>
<div className={[styles.s063].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CAPITOLO 01 · IL NEMICO SILENZIOSO</div>
<h2 className={[styles.reveal, styles.s064].join(' ')}>Nessuno ti ha tolto un euro. <span className={[styles.accent].join(' ')}>Eppure ne hai di meno.</span></h2>
<p className={[styles.s065].join(' ')}>Tra il 2021 e il 2025 i prezzi in Italia sono saliti in media del 17,1%. Il saldo sul conto è rimasto lo stesso, ma quello che ci compri no. Prova con la tua cifra.</p>
</div>
<div className={[styles.s066].join(' ')}>

<div className={[styles.s067].join(' ')}>
<label htmlFor="capitale" className={[styles.s068].join(' ')}>Quanto avevi messo da parte nel 2021?</label>
<div className={[styles.accent, styles.s069].join(' ')}><span data-bind="calc.amount">{calc.amount}</span> €</div>
<input id="capitale" type="range" min="10000" max="1000000" step="10000" value={amount} onChange={event => setAmount(Number(event.target.value))} />
<div className={[styles.s070].join(' ')}>
{[50000, 100000, 250000, 500000].map(pr => (<button type="button" key={pr} data-preset={pr} onClick={() => setAmount(pr)} aria-pressed={amount === pr} className={[styles['chip-d'], amount === pr ? styles.on : ''].join(' ')}>{pr / 1000}k €</button>))}
</div>
<div className={[styles.s071].join(' ')}>
<div className={[styles.s072].join(' ')}><span className={[styles.s073].join(' ')}>Oggi vale come</span><span className={[styles.s074].join(' ')}><span data-bind="calc.real">{calc.real}</span> €</span></div>
<div className={[styles.s072].join(' ')}><span className={[styles.s073].join(' ')}>Potere d&apos;acquisto perso</span><span className={[styles.s075].join(' ')}>−<span data-bind="calc.lost">{calc.lost}</span> €</span></div>
</div>
<div className={[styles.s076].join(' ')}>In media sono circa <strong className={[styles.s077].join(' ')}><span data-bind="calc.perDay">{calc.perDay}</span> € al giorno</strong>, ogni giorno, per cinque anni. Anche oggi.</div>
<div className={[styles.s078].join(' ')}>Calcolo illustrativo su dati ISTAT: variazione cumulata dei prezzi al consumo 2021–2025 (+17,1%).</div>
</div>

<div className={[styles.s079].join(' ')}>
<div className={[styles.s080].join(' ')}>
<Image src="/benessere-patrimoniale/evento/coins.jpg" alt="Due colonne di monete d'oro: la seconda è più bassa e la parte mancante è un contorno luminoso" width={1400} height={1100} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s081].join(' ')} />
<div className={[styles.s082].join(' ')}>
<div className={[styles["tile-d"], styles["coin-tag"], styles.s083].join(' ')}><div className={[styles.s084].join(' ')}>2021</div><div className={[styles.s085].join(' ')}>{calc.amount} €</div></div>
</div>
<div className={[styles.s086].join(' ')}>
<div className={[styles["coin-tag"], styles.s087].join(' ')}><div className={[styles.s088].join(' ')}>EVAPORATO</div><div className={[styles.s089].join(' ')}>−{calc.lost} €</div></div>
</div>
<div className={[styles["coin-2025"], styles.s090].join(' ')}>
<div className={[styles["tile-d"], styles["coin-tag"], styles.s083].join(' ')}><div className={[styles.s084].join(' ')}>2025</div><div className={[styles.s085].join(' ')}>≈ {calc.real} €</div></div>
</div>
</div>
</div>
</div>
</div>
</div>

<div data-event-section="pyramid" className={[styles.s091].join(' ')}>
<div className={[styles.s092].join(' ')}>
<div className={[styles.s041].join(' ')}>CAPITOLO 02 · IL VERO PROBLEMA</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Mettere da parte soldi <span className={[styles.s094].join(' ')}>non è</span> proteggere valore.</h2>
<p className={[styles.s043].join(' ')}>Quasi tutti i patrimoni che vediamo poggiano su un solo piano: il conto corrente, o i prodotti della banca di fiducia. Funziona finché va tutto bene.</p>
<p className={[styles.s043].join(' ')}>Nell&apos;incontro ti mostriamo come ragionare <strong className={[styles.s038].join(' ')}>per livelli</strong>, così capisci da solo dove il tuo patrimonio è scoperto.</p>
<div className={[styles["pyr-list"], styles.s095].join(' ')}>
<div className={[styles.s096].join(' ')}><span className={[styles.s097].join(' ')}></span><span><strong>Riserva di valore</strong> — ciò che protegge quando il resto oscilla</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s098].join(' ')}></span><span><strong>Crescita</strong> — ciò che lavora per te nel tempo</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s099].join(' ')}></span><span><strong>Liquidità e sicurezza</strong> — ciò che ti serve domani</span></div>
</div>
</div>
<div className={[styles.s100].join(' ')}>
<Image src="/benessere-patrimoniale/evento/pyramid.jpg" alt="Tre livelli sovrapposti: una base scura, un livello color petrolio e in cima un lingotto d'oro" width={1400} height={1050} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s081].join(' ')} />
<div className={[styles["pyr-label"], styles.s101].join(' ')}><span className={[styles.s102].join(' ')}></span><span className={[styles.s103].join(' ')}></span><span className={[styles["tile-d"], styles.s104].join(' ')}><strong className={[styles.s105].join(' ')}>03 · Riserva di valore</strong><br />protegge quando il resto oscilla</span></div>
<div className={[styles["pyr-label"], styles.s106].join(' ')}><span className={[styles.s107].join(' ')}></span><span className={[styles.s108].join(' ')}></span><span className={[styles["tile-d"], styles.s104].join(' ')}><strong className={[styles.s109].join(' ')}>02 · Crescita</strong><br />lavora per te nel tempo</span></div>
<div className={[styles["pyr-label"], styles.s110].join(' ')}><span className={[styles.s111].join(' ')}></span><span className={[styles.s112].join(' ')}></span><span className={[styles["tile-d"], styles.s104].join(' ')}><strong>01 · Liquidità e sicurezza</strong><br />ciò che ti serve domani</span></div>
</div>
</div>

<div data-event-section="questions" className={[styles.s113].join(' ')}>
<div className={[styles.s114].join(' ')}>
<div className={[styles.s115].join(' ')}>
<div className={[styles.s041].join(' ')}>CAPITOLO 03 · COSA SCOPRIRAI</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>6 domande che quasi nessuno fa prima di firmare.</h2>
<p className={[styles.s043].join(' ')}>Le risposte le diamo dal vivo. Qui ti lasciamo solo le domande: prova a vedere a quante sapresti rispondere oggi.</p>
<p className={`${styles["swipe-hint"]} ${styles.label}`}>Scorri le 6 domande →</p>
</div>
<div data-carousel="s116" role="region" aria-label="Le sei domande" tabIndex={0} className={[styles["snap"], styles.s116].join(' ')}>
<div className={[styles["qcard"]].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>01</span><strong className={[styles.s118].join(' ')}>Qual è la differenza tra &quot;ho risparmiato&quot; e &quot;sono protetto&quot;?</strong><span className={[styles.s119].join(' ')}>Molti se ne accorgono solo quando è troppo tardi.</span></div>
<div className={[styles["qcard"]].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>02</span><strong className={[styles.s118].join(' ')}>Cosa significa davvero diversificare?</strong><span className={[styles.s119].join(' ')}>E perché 5 fondi della stessa banca spesso non lo sono.</span></div>
<div className={[styles["qcard"]].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>03</span><strong className={[styles.s118].join(' ')}>Quali rischi non compaiono in nessun estratto conto?</strong><span className={[styles.s119].join(' ')}>Ne vediamo tre, e come riconoscerli nel tuo patrimonio.</span></div>
<div className={[styles["qcard"]].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>04</span><strong className={[styles.s118].join(' ')}>Perché l&apos;oro fisico torna al centro della diversificazione?</strong><span className={[styles.s119].join(' ')}>Cosa fa bene, cosa non fa, e per chi non ha senso.</span></div>
<div className={[styles["qcard"]].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>05</span><strong className={[styles.s118].join(' ')}>Oro fisico od &quot;oro di carta&quot;: cosa possiedi davvero?</strong><span className={[styles.s119].join(' ')}>La distinzione che pochi spiegano con chiarezza.</span></div>
<div className={[styles["qcard"], styles.s120].join(' ')}><span className={[styles.accent, styles.s117].join(' ')}>06</span><strong className={[styles.s118].join(' ')}>Qual è la domanda da fare a qualunque consulente?</strong><span className={[styles.s121].join(' ')}>Prima di firmare qualsiasi cosa. La risposta ti dice quasi tutto.</span></div>
</div>
<div className={[styles.s122].join(' ')}>
<a href="#richiesta" className={[styles.cta, styles["cta-ink"], styles.s123].join(' ')}>Voglio le risposte: riservo il posto
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
</div>
</div>
</div>

<div data-event-section="gold-comparison" className={[styles.s120].join(' ')}>
<div className={[styles.s039].join(' ')}>
<div className={[styles.s115].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CAPITOLO 04 · UN&apos;ANTEPRIMA</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>&quot;Ho già l&apos;oro in portafoglio.&quot; <span className={styles["chip-lime"]}>Sicuro?</span></h2>
<p className={[styles.s065].join(' ')}>Possedere un lingotto e possedere un titolo che ne segue il prezzo sono due cose molto diverse.</p>
<p className={`${styles["swipe-hint"]} ${styles.label}`}>Scorri per confrontare →</p>
</div>
<div data-carousel="s124" role="region" aria-label="Confronto oro fisico e oro di carta" tabIndex={0} className={[styles["snap"], styles.s124].join(' ')}>
<div className={[styles.s125].join(' ')}>
<div className={[styles.s126].join(' ')}><Image src="/benessere-patrimoniale/evento/single.jpg" alt="Lingotto d'oro con punzonatura 999.9" width={1400} height={900} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s046].join(' ')} /><span className={[styles.s127].join(' ')}>ORO FISICO</span></div>
<div className={[styles.s128].join(' ')}>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Cosa possiedi</span><strong className={[styles.s131].join(' ')}>Il metallo, a tuo nome</strong></div>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Dipendi da un emittente?</span><strong className={[styles.s131].join(' ')}>No, se custodito separatamente</strong></div>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Costi tipici</span><strong className={[styles.s131].join(' ')}>Spread e custodia</strong></div>
<div className={[styles.s132].join(' ')}><span className={[styles.s130].join(' ')}>Rapidità di vendita</span><strong className={[styles.s131].join(' ')}>Dipende dall&apos;operatore</strong></div>
</div>
</div>
<div className={[styles.s133].join(' ')}>
<div className={[styles.s134].join(' ')}>
<div className={[styles.s135].join(' ')}>
<div className={[styles.s136].join(' ')}></div>
<div className={[styles.s137].join(' ')}></div>
<div className={[styles.s138].join(' ')}></div>
<div className={[styles.s139].join(' ')}></div>
<div className={[styles.s140].join(' ')}></div>
<div className={[styles.s141].join(' ')}>XAU</div>
</div>
<span className={[styles.s142].join(' ')}>&quot;ORO DI CARTA&quot;</span>
</div>
<div className={[styles.s128].join(' ')}>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Cosa possiedi</span><strong className={[styles.s131].join(' ')}>Un titolo che ne replica il prezzo</strong></div>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Dipendi da un emittente?</span><strong className={[styles.s131].join(' ')}>Sì, emittente e intermediari</strong></div>
<div className={[styles.s129].join(' ')}><span className={[styles.s130].join(' ')}>Costi tipici</span><strong className={[styles.s131].join(' ')}>Gestione e negoziazione</strong></div>
<div className={[styles.s132].join(' ')}><span className={[styles.s130].join(' ')}>Rapidità di vendita</span><strong className={[styles.s131].join(' ')}>In borsa, nei giorni di mercato</strong></div>
</div>
</div>
</div>
<p className={[styles.s143].join(' ')}>Nessuna delle due è &quot;giusta&quot; in assoluto: nell&apos;incontro vediamo pro, contro e per chi ha senso l&apos;una o l&apos;altra.</p>
</div>
</div>

<div data-event-section="agenda" className={[styles.s114].join(' ')}>
<div className={[styles.s144].join(' ')}>
<div className={[styles.s145].join(' ')}>
<div className={[styles.s041].join(' ')}>COME SI SVOLGE</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>90 minuti, minuto per minuto.</h2>
</div>
<div className={[styles.s146].join(' ')}>Niente slide infinite, niente gergo. Quattro tappe e uno spazio finale per le tue domande, dal vivo.</div>
</div>
<div className={[styles.s147].join(' ')}>
<div aria-hidden="true" className={[styles["tl-line"], styles.s148].join(' ')}></div>
<div className={[styles["tl-grid"], styles.s149].join(' ')}>
<div className={[styles["tl-item"], styles.s150].join(' ')}><span className={[styles.s151].join(' ')}>1</span><div className={[styles.s152].join(' ')}>00 — 15&apos;</div><div className={[styles.s153].join(' ')}>Cosa sta succedendo al valore del denaro</div></div>
<div className={[styles["tl-item"], styles.s150].join(' ')}><span className={[styles.s151].join(' ')}>2</span><div className={[styles.s152].join(' ')}>15 — 35&apos;</div><div className={[styles.s153].join(' ')}>I rischi invisibili di un patrimonio &quot;fermo&quot;</div></div>
<div className={[styles["tl-item"], styles.s150].join(' ')}><span className={[styles.s151].join(' ')}>3</span><div className={[styles.s152].join(' ')}>35 — 60&apos;</div><div className={[styles.s153].join(' ')}>Diversificare per livelli e il ruolo dell&apos;oro fisico</div></div>
<div className={[styles["tl-item"], styles.s150].join(' ')}><span className={[styles.s151].join(' ')}>4</span><div className={[styles.s152].join(' ')}>60 — 75&apos;</div><div className={[styles.s153].join(' ')}>Le 6 domande, applicate a casi reali</div></div>
<div className={[styles["tl-item"], styles.s150].join(' ')}><span className={[styles.s154].join(' ')}>?</span><div className={[styles.s152].join(' ')}>75 — 90&apos;</div><div className={[styles.s153].join(' ')}>Le tue domande, dal vivo</div></div>
</div>
</div>
</div>

<div data-event-section="audience" className={[styles.s155].join(' ')}>
<div className={[styles.s156].join(' ')}>
<h3 className={[styles.s157].join(' ')}>È per te se…</h3>
<div className={[styles.s150].join(' ')}>
<div className={[styles.s096].join(' ')}><span className={[styles.s158].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span><span>Hai costruito risparmi o un patrimonio e vuoi capire davvero cosa ci sta succedendo.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s158].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span><span>Sei un imprenditore e patrimonio personale e aziendale si intrecciano.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s158].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span><span>L&apos;oro fisico ti incuriosisce, ma vuoi capire prima di decidere.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s158].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span><span>Vuoi arrivare più preparato al prossimo incontro con banca o consulente.</span></div>
</div>
</div>
<div className={[styles.s159].join(' ')}>
<h3 className={[styles.s157].join(' ')}>Non è per te se cerchi…</h3>
<div className={[styles.s160].join(' ')}>
<div className={[styles.s096].join(' ')}><span className={[styles.s161].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></span><span>Rendimenti garantiti o previsioni sul prezzo dell&apos;oro.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s161].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></span><span>Scorciatoie per arricchirti in fretta.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s161].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></span><span>Una raccomandazione personalizzata durante il webinar.</span></div>
<div className={[styles.s096].join(' ')}><span className={[styles.s161].join(' ')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></span><span>Una soluzione uguale per tutti.</span></div>
</div>
</div>
</div>

<div data-event-section="speaker" className={[styles.s120].join(' ')}>
<div className={[styles.s162].join(' ')}>
<div className={[styles["portrait"], styles.s163].join(' ')}>
<div className={[styles.accent, styles.s164].join(' ')}>FC</div>
<div className={[styles.s165].join(' ')}></div>
<div className={[styles.s166].join(' ')}>RITRATTO IN ARRIVO</div>
</div>
<div className={[styles.s167].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CHI TI ACCOMPAGNA</div>
<h2 className={[styles.reveal, styles.s168].join(' ')}>Frank Cannoletta</h2>
<div className={[styles.s130].join(' ')}>Imprenditore &amp; Strategista Horyzon</div>
<blockquote className={[styles.s169].join(' ')}>&quot;Il mio compito non è dirti cosa devi fare. È aiutarti a vedere il quadro che nessuno ti ha mai mostrato per intero.&quot;</blockquote>
<p className={[styles.s065].join(' ')}>Frank lavora sull&apos;intersezione tra persona, impresa e patrimonio. [Una frase sulla sua storia: l&apos;episodio che l&apos;ha portato a occuparsi di protezione patrimoniale.]</p>
<div className={[styles.s170].join(' ')}>
<div><div className={[styles.accent, styles.s171].join(' ')}>[00]</div><div className={[styles.s073].join(' ')}>anni da imprenditore</div></div>
<div><div className={[styles.accent, styles.s171].join(' ')}>[000]</div><div className={[styles.s073].join(' ')}>famiglie e imprese incontrate</div></div>
<div><div className={[styles.accent, styles.s171].join(' ')}>[00]</div><div className={[styles.s073].join(' ')}>incontri pubblici</div></div>
</div>
</div>
</div>
</div>

<div data-event-section="testimonials" className={[styles.s039].join(' ')}>
<div className={styles.s040}><p className={styles.s041}>Testimonianze</p>
<h2 className={[styles.reveal, styles.s172].join(' ')}>Cosa dice chi c&apos;era.</h2>
<p className={`${styles["swipe-hint"]} ${styles.s041}`}>Scorri →</p></div>
<div data-carousel="s173" role="region" aria-label="Testimonianze" tabIndex={0} className={[styles["snap"], styles.s173].join(' ')}>
<div className={[styles.s174].join(' ')}><div aria-label="5 stelle su 5" className={[styles.s175].join(' ')}>★★★★★</div><p className={[styles.s176].join(' ')}>&quot;[Testimonianza reale: cosa ha capito che prima non sapeva.]&quot;</p><div className={[styles.s177].join(' ')}><span className={[styles.s178].join(' ')}></span><span className={[styles.s179].join(' ')}><strong>[Nome C.]</strong><br /><span className={[styles.s180].join(' ')}>[Imprenditore, Bari]</span></span></div></div>
<div className={[styles.s174].join(' ')}><div aria-label="5 stelle su 5" className={[styles.s175].join(' ')}>★★★★★</div><p className={[styles.s176].join(' ')}>&quot;[Testimonianza reale: temeva una vendita, ha trovato chiarezza.]&quot;</p><div className={[styles.s177].join(' ')}><span className={[styles.s178].join(' ')}></span><span className={[styles.s179].join(' ')}><strong>[Nome C.]</strong><br /><span className={[styles.s180].join(' ')}>[Professionista, Milano]</span></span></div></div>
<div className={[styles.s174].join(' ')}><div aria-label="5 stelle su 5" className={[styles.s175].join(' ')}>★★★★★</div><p className={[styles.s176].join(' ')}>&quot;[Testimonianza reale: la domanda che poi ha fatto alla sua banca.]&quot;</p><div className={[styles.s177].join(' ')}><span className={[styles.s178].join(' ')}></span><span className={[styles.s179].join(' ')}><strong>[Nome C.]</strong><br /><span className={[styles.s180].join(' ')}>[Privato, Roma]</span></span></div></div>
</div>
</div>

<div data-event-section="bonuses" className={[styles.s113].join(' ')}>
<div className={[styles.s181].join(' ')}>
<div className={[styles.s182].join(' ')}>
<div className={[styles.s041].join(' ')}>COSA RICEVI REGISTRANDOTI OGGI</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Non solo l&apos;incontro.</h2>
</div>
<div className={[styles.s183].join(' ')}>
<div className={[styles.s184].join(' ')}><div><strong className={[styles.s185].join(' ')}>Evento live di 90 minuti</strong><div className={[styles.s119].join(' ')}>Con domande e risposte dal vivo</div></div><span className={[styles.s186].join(' ')}>Incluso</span></div>
<div className={[styles.s184].join(' ')}><div><span className={[styles.s187].join(' ')}>BONUS 1</span><br /><strong className={[styles.s185].join(' ')}>Checklist: &quot;Le 12 domande da fare prima di firmare&quot;</strong><div className={[styles.s119].join(' ')}>La ricevi subito, da portare al prossimo appuntamento in banca</div></div><span className={[styles.s186].join(' ')}>Valore [__] €</span></div>
<div className={[styles.s184].join(' ')}><div><span className={[styles.s187].join(' ')}>BONUS 2</span><br /><strong className={[styles.s185].join(' ')}>Replay disponibile per 48 ore</strong><div className={[styles.s119].join(' ')}>Solo per chi si registra prima dell&apos;evento</div></div><span className={[styles.s186].join(' ')}>Valore [__] €</span></div>
<div className={[styles.s188].join(' ')}><div><span className={[styles.s189].join(' ')}>BONUS 3 · SOLO [10] POSTI</span><br /><strong className={[styles.s185].join(' ')}>Confronto individuale di 20 minuti</strong><div className={[styles.s121].join(' ')}>Per chi lo richiede dopo l&apos;evento. Senza impegno.</div></div><span className={[styles.s190].join(' ')}>Valore [__] €</span></div>
<div className={[styles.s191].join(' ')}><div className={[styles.s192].join(' ')}>Per te, oggi: <strong>gratis</strong>.</div><a href="#richiesta" className={[styles.cta, styles["cta-ink"], styles.s193].join(' ')}>Riserva il posto</a></div>
</div>
</div>
</div>

<div id="richiesta" data-event-section="request" className={[styles.s194].join(' ')}>
<div className={[styles.s195].join(' ')}>
<div className={[styles.s196].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>ULTIMO PASSO</div>
<h2 className={[styles.reveal, styles.s197].join(' ')}><span data-bind="formTitle">{formTitle}</span></h2>
<p className={[styles.s065].join(' ')}>Ci vogliono 30 secondi. Teniamo i posti limitati perché rispondiamo a tutte le domande dal vivo: quando finiscono, chiudiamo le iscrizioni.</p>
<div className={[styles["tile-d"], styles.s198].join(' ')}>
<div className={[styles.s199].join(' ')}><span className={[styles.s056].join(' ')}>Posti rimasti</span><strong><EventSessionValue name="seatsLeft" /> su <EventSessionValue name="seatsTotal" /></strong></div>
<div className={[styles.s200].join(' ')}><div style={ { width: `${eventSession.seatsTaken / eventSession.seatsTotal * 100}%` }} className={[styles.s034].join(' ')}></div></div>
<div className={[styles.s073].join(' ')}>Inizio tra <EventSessionValue name="cd.d" /> giorni e <EventSessionValue name="cd.h" /> ore</div>
</div>
<div className={[styles.s201].join(' ')}>
<span className={[styles.s202].join(' ')}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg></span>
<div><strong>La nostra promessa</strong><div className={[styles.s121].join(' ')}>Nessuna vendita durante l&apos;incontro. Se dopo 20 minuti senti che non fa per te, esci: nessuno ti richiamerà per insistere.</div></div>
</div>
</div>
<PatrimonialLeadForm mode="patrimonial-event" presentation="event" selectedProfile={selectedProfile} onProfileChange={setSelectedProfile} />
</div>
</div>

<div data-event-section="faq" className={[styles.s203].join(' ')}>
<p className={styles.s041}>FAQ</p>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Domande frequenti</h2>
<div className={[styles.s204].join(' ')}>
<details className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>È davvero gratuito? Qual è la fregatura?<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>È gratuito. Chi lo desidera, dopo l&apos;evento, può chiedere un confronto individuale. Se non lo chiedi, nessuno ti contatterà per proporti qualcosa.</p></details>
<details className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>Devo già avere investimenti o oro?<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>No. Basta avere dei risparmi, o un patrimonio aziendale, e voler capire meglio come ragionarci.</p></details>
<details className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>E se non posso esserci dal vivo?<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>Registrati comunque: chi si iscrive prima dell&apos;evento riceve il replay, disponibile per 48 ore.</p></details>
<details className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>Mi darete consigli su dove investire?<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>No. L&apos;incontro ha scopo informativo e non è consulenza finanziaria personalizzata. L&apos;obiettivo è darti più elementi per decidere tu.</p></details>
<details className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>Cosa mi serve per collegarmi?<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>Un computer, un tablet o uno smartphone. Ti mandiamo il link via email e un promemoria prima dell&apos;inizio.</p></details>
</div>
</div>

<div data-event-section="closing" className={[styles.s209].join(' ')}>
<div className={[styles.s210].join(' ')}>
<p className={styles.s012}>Il prossimo passo</p>
<h2 className={`${styles.reveal} ${styles.s211}`}>Tra un anno potrai dire &quot;avrei dovuto&quot;. Oppure <span className={styles["chip-lime"]}>&quot;per fortuna&quot;</span>.</h2>
<p className={styles.s043}>La differenza sono 90 minuti. <strong className={styles.s038}>P.S.</strong> Se sei arrivato fin qui senza registrarti, una delle 6 domande probabilmente ti riguarda già. La checklist te la mandiamo subito, anche se poi non riuscirai a collegarti.</p>
<a href="#richiesta" className={[styles.cta, styles.s212].join(' ')}>Riserva il mio posto gratuito
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
</div>
</div>

<footer data-event-section="footer" className={[styles.s213].join(' ')}>
<div className={[styles.s214].join(' ')}>
<div className={styles["footer-copy"]}>
<strong className={styles.s215}>Horyzon Benessere Patrimoniale</strong>
<div>FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P. IVA 05120660757 · SDI SU9YNJA</div>
<div>Contenuti a scopo esclusivamente informativo. Non costituiscono consulenza finanziaria, sollecitazione all&apos;investimento né raccomandazione personalizzata. I rendimenti passati non sono indicativi di quelli futuri. Fonte dati inflazione: ISTAT.</div>
</div>
<div className={styles.s217}><Link href="/privacy-policy" className={styles.s216}>Privacy</Link><Link href="/cookie-policy" className={styles.s216}>Cookie</Link><a href="mailto:info@horyzon.it" className={styles.s216}>info@horyzon.it</a></div>
</div>
</footer>

<aside data-event-section="sticky" aria-label="Riserva il posto" className={[styles["sticky-cta"]].join(' ')}>
<div className={[styles["tile-d"], styles.s218].join(' ')}>
<div className={[styles.s219].join(' ')}>
<div className={[styles["sticky-hide-m"], styles.s220].join(' ')}>
<strong className={[styles.s221].join(' ')}>Quello che le banche non dicono</strong>
<span className={[styles.s130].join(' ')}><EventSessionValue name="eventLabel" /> · inizia tra <EventSessionValue name="cd.d" />g <EventSessionValue name="cd.h" />h <EventSessionValue name="cd.m" />m · restano <EventSessionValue name="seatsLeft" /> posti</span>
</div>
<a href="#richiesta" className={[styles.cta, styles.s222].join(' ')}>Riserva il posto gratuito <span aria-hidden="true">→</span></a>
</div>
</div>
</aside>
</div>
  </EventSessionProvider>;
}
