'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { PatrimonialLeadForm } from './patrimonial-lead-form';
import { EventNotesContext } from './patrimonial-event-form';
import { EventSessionProvider, EventSessionValue } from './patrimonial-event-clock';
import { eventSession } from '@/content/patrimonial-event-session';
import { eventScenes, eventFormTitle, eventCalculator, eventHorizons, type EventHorizon, eventAllocation, eventInstruments, eventKnowledgeLevels, eventNotes } from '@/content/patrimonial-event-content';
import styles from './patrimonial-event.module.css';

const Arrow = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>;
const Check = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>;
const Cross = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>;

const questions = [
  { q: 'Che differenza c’è tra mettere da parte denaro e proteggere valore?', sub: 'Molti se ne accorgono solo quando è troppo tardi.' },
  { q: 'Che cosa significa davvero diversificare?', sub: 'E perché cinque fondi della stessa banca spesso non lo sono.' },
  { q: 'Quali rischi non compaiono in nessun estratto conto?', sub: 'Ne vediamo tre, e come riconoscerli nel tuo patrimonio.' },
  { q: 'Perché i metalli preziosi?', sub: 'Che ruolo hanno oro e argento in un patrimonio che vuole durare.' },
  { q: 'Metallo fisico o metallo “di carta”: cosa possiedi davvero?', sub: 'La differenza tra un lingotto e un titolo che ne segue il prezzo.' },
  { q: 'Quanto può rendere la diversificazione?', sub: 'E come si misura se sta funzionando. Prima di scoprirlo, dicci da dove parti qui sotto.' },
];
// The best informed choice in each family and what it returned. Indicative, in euro, before tax and costs.
const families = [
  { id: 'metalli', name: 'Metalli preziosi', img: '/benessere-patrimoniale/evento/single.jpg', alt: "Lingotto d'oro con punzonatura 999.9", what: 'Oro e argento, il bene rifugio più antico del mondo.',
    rows: [['Oro fisico', 'In 10 anni ha quasi triplicato il suo valore in euro: 10.000 € sono diventati circa 29.800 €.'], ['Argento', 'Ancora più dinamico: circa +16% l’anno negli ultimi 10 anni, spinto anche dalla domanda industriale.'], ['Fisico o di carta', 'Il lingotto lo possiedi davvero; l’oro di carta segue il prezzo. Nella seconda serata vediamo quando conviene l’uno o l’altro.']],
    stat: '+198%', statLabel: 'l’oro in euro negli ultimi 10 anni (giugno 2026)' },
  { id: 'immobili', name: 'Immobili a reddito', img: '/benessere-patrimoniale/evento/immobili.jpg', alt: "Modellino di un palazzo color avorio con finestre d'oro e una chiave d'oro", what: 'Un esempio concreto: un bilocale di 60 m² a Milano comprato nel 2015 e messo a reddito.',
    rows: [['Acquisto, 2015', 'Circa 190.000 €.'], ['Valore oggi', 'Circa 304.000 €: +114.000 € (prezzi a Milano +58% dal 2015).'], ['Affitti incassati', 'Circa 137.000 € lordi in 10 anni, con un canone medio di 19 € al m² al mese.']],
    stat: '+251.000 €', statLabel: 'valore + affitti lordi in 10 anni, su circa 190.000 € investiti' },
  { id: 'etf', name: 'ETF', img: '/benessere-patrimoniale/evento/etf.jpg', alt: "Globo composto da tessere d'oro su un piedistallo", what: 'Un solo strumento che ti fa possedere un pezzo di centinaia di grandi aziende.',
    rows: [['S&P 500', 'Le 500 maggiori aziende americane: +13,6% l’anno in euro negli ultimi 10 anni. 10.000 € sono diventati circa 35.700 €.'], ['MSCI World', 'Circa 1.400 aziende di 23 Paesi: +9,4% l’anno in euro in 10 anni.'], ['Cosa possiedi', 'Quote di un fondo quotato in borsa che replica l’indice, con costi molto bassi.']],
    stat: '+13,6%', statLabel: 'l’anno, l’S&P 500 in euro negli ultimi 10 anni, dividendi inclusi' },
  { id: 'obbligazioni', name: 'Obbligazioni', img: '/benessere-patrimoniale/evento/obbligazioni.jpg', alt: "Certificato arrotolato con sigillo d'oro accanto a monete", what: 'Presti denaro a uno Stato o a un’azienda e ricevi interessi regolari.',
    rows: [['Mercati emergenti', 'Le obbligazioni dei Paesi emergenti: circa +5,5% l’anno negli ultimi 10 anni.'], ['High yield USA', 'Obbligazioni societarie americane ad alto rendimento: circa +5,3% l’anno dal 2007.'], ['BTP 2011–2012', 'Chi ha comprato BTP decennali in quegli anni si è assicurato cedole fino al 6–7% l’anno per dieci anni.']],
    stat: '+5,5%', statLabel: 'l’anno, le obbligazioni dei mercati emergenti negli ultimi 10 anni' },
];

const evenings = [
  { n: '1', img: '/benessere-patrimoniale/evento/serata-1.jpg', alt: "Lampada d'oro che illumina un taccuino aperto e una penna", title: 'Pensare come chi un patrimonio ce l’ha', items: [['Il denaro non sta mai fermo', 'Perché tenere i soldi sul conto è già una scelta, e quanto ti costa ogni anno.'], ['I quattro profili', 'Da chi rincorre il mese a chi costruisce: dove sei oggi e qual è il tuo prossimo passo.'], ['La regola 70-10-10-10', '70% per vivere, 10% per il fondo di sicurezza, 10% da investire, 10% per eliminare i debiti o per crescere.'], ['Come ragionano i milionari', 'Non cercano il prodotto migliore: costruiscono un sistema in cui ogni pezzo ha un compito.'], ['Le tue domande, dal vivo', '']] },
  { n: '2', img: '/benessere-patrimoniale/evento/serata-2.jpg', alt: "Porta di un caveau d'oro socchiusa con luce calda", title: 'Come si costruisce e si protegge un patrimonio', items: [['La mappa 50/50', 'Beni reali e beni finanziari: perché servono entrambi.'], ['Metalli preziosi e immobili', 'Oro e argento, fisico o di carta; quando una casa è un investimento e quando è solo una spesa.'], ['ETF, azioni e obbligazioni', 'Cosa possiedi davvero quando compri un ETF, e cosa è successo ai BTP nel 2022.'], ['Le domande da fare al tuo consulente', 'La lista da portare al prossimo appuntamento in banca.'], ['Il tuo Radar Patrimoniale e le tue domande', '']] },
];

// Existing event interactions with route-scoped presentation from the mobile reference.
// The clock has its own provider so second ticks only rerender session consumers.
export function PatrimonialEventLanding() {
  const [scene, setScene] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [amount, setAmount] = useState(10000);
  const [years, setYears] = useState<EventHorizon>(20);
  const [slice, setSlice] = useState<string>('metalli');
  const [known, setKnown] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [family, setFamily] = useState('metalli');
  const cur = eventScenes.find(item => item.id === scene);
  const calc = eventCalculator(amount, years);
  const formTitle = eventFormTitle(selectedProfile);
  const curSlice = eventAllocation.find(item => item.id === slice) ?? eventAllocation[0];
  const curFamily = families.find(item => item.id === family) ?? families[0];
  const openInst = eventInstruments.find(item => item.id === open);
  const toggle = (id: string) => {
    if (known[id]) { setKnown(prev => { const next = { ...prev }; delete next[id]; return next; }); setOpen(cur => (cur === id ? null : cur)); return; }
    setKnown(prev => ({ ...prev, [id]: eventKnowledgeLevels[0] })); setOpen(id);
  };
  return <EventSessionProvider><div data-session-status={eventSession.status} data-availability={eventSession.status === 'PLACEHOLDER' ? 'demo' : 'confirmed'} className={[styles.s000, styles.page].join(' ')}>

<div data-event-section="urgency" className={[styles.s001].join(' ')}>
<span className={styles.s002}><span className={styles["live-dot"]} aria-hidden="true" />Iscrizioni aperte · due serate online · restano <strong><EventSessionValue name="seatsLeft" /> posti su <EventSessionValue name="seatsTotal" /></strong></span>
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
<div className={[styles["label"], styles["load-1"], styles.s012].join(' ')}>Evento online gratuito in due serate · Per lavoratori, pensionati, imprenditori, professionisti e genitori</div>
<h1 className={[styles["load-2"], styles.s013].join(' ')}>Quello che le banche <span className={[styles["chip-lime"], styles.s014].join(' ')}>non</span> dicono.</h1>
<p className={[styles["load-3"], styles.s015].join(' ')}>Due serate per vedere il denaro come lo guarda chi un patrimonio lo costruisce e lo protegge da generazioni. <strong className={[styles.s003].join(' ')}>Inflazione, diversificazione, metalli preziosi, immobili, ETF e obbligazioni</strong>: capirli prima di affidare i tuoi risparmi a chiunque.</p>
<div className={[styles["load-4"], styles.s016].join(' ')}>
<div className={[styles.s017].join(' ')}>LA PRIMA SERATA INIZIA TRA</div>
<div className={[styles["cd-row"], styles.s018].join(' ')}>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.d" /></div><div className={[styles.s021].join(' ')}>GIORNI</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.h" /></div><div className={[styles.s021].join(' ')}>ORE</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.s020].join(' ')}><EventSessionValue name="cd.m" /></div><div className={[styles.s021].join(' ')}>MINUTI</div></div>
<div className={[styles["tile-d"], styles.s019].join(' ')}><div className={[styles.accent, styles["sec-box"], styles.s020].join(' ')}><EventSessionValue name="cd.s" /></div><div className={[styles.s021].join(' ')}>SECONDI</div></div>
</div>
</div>
<div className={[styles["stack-m"], styles["load-4"], styles.s022].join(' ')}>
<a href="#richiesta" className={[styles.cta, styles.s023].join(' ')}>Sì, riservo il mio posto per le due serate
<Arrow size={20} /></a>
<div className={[styles.s024].join(' ')}>
<div className={[styles.s025].join(' ')}>
<span className={[styles.s026].join(' ')}></span>
<span className={[styles.s027].join(' ')}></span>
<span className={[styles.s028].join(' ')}></span>
</div>
<span className={[styles.s029].join(' ')}><strong className={[styles.s003].join(' ')}><EventSessionValue name="seatsTaken" /> persone</strong> hanno già<br />riservato il loro posto</span>
</div>
</div>
<div className={[styles.s030].join(' ')}>Gratuito · Online · Due serate · Nessuna vendita durante l&apos;evento</div>
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
<span><strong className={[styles.s038].join(' ')}>11 anni</strong> al fianco di imprese e imprenditori</span>
<span><strong className={[styles.s038].join(' ')}>10.000+</strong> consulenze erogate</span>
<span><strong className={[styles.s038].join(' ')}>Centinaia</strong> di seminari pubblici</span>
<span><strong className={[styles.s038].join(' ')}>0</strong> prodotti venduti durante l&apos;evento</span>
</div>
</div>

<div data-event-section="scenes" className={[styles.s039].join(' ')}>
<div className={[styles.s040].join(' ')}>
<div className={[styles.s041].join(' ')}>PRIMA DI TUTTO, PARLIAMO DI TE</div>
<h2 className={[styles.reveal, styles.s042].join(' ')}>In quale di questi <span className={styles["chip-ink"]}>quattro profili</span> ti riconosci?</h2>
<p className={[styles.s043].join(' ')}>Non esistono profili giusti o sbagliati. Esiste il punto da cui parti, e il prossimo passo da fare. Tocca il tuo.</p>
<p className={`${styles["swipe-hint"]} ${styles.label}`}>Scorri i 4 profili →</p>
</div>
<div data-carousel="s044" role="region" aria-label="I quattro profili" tabIndex={0} className={[styles["snap"], styles.s044].join(' ')}>
{eventScenes.map(item => (<button type="button" aria-pressed={scene === item.id} key={item.id} data-scene={item.id} onClick={() => setScene(item.id)} className={[styles.scene, scene === item.id ? styles.on : ''].join(' ')}>
<div className={[styles.s045].join(' ')}>
<Image src={item.img} alt={item.alt} width={1000} height={720} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s046].join(' ')} />
<span className={[styles["tick"], styles.s047].join(' ')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span>
<span className={[styles.s048].join(' ')}>{item.level} · {item.label}</span>
</div>
<div className={[styles.s049].join(' ')}>
<span className={[styles.s051, styles.vSceneTitle].join(' ')}>&quot;{item.thought}&quot;</span>
<span className={[styles.s050].join(' ')}>{item.text}</span>
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
<Arrow /></a>
</div>
</div>)}
{!cur && (<div className={[styles.s052].join(' ')}>
<div className={[styles.s058].join(' ')}>
<span className={[styles.s059].join(' ')}>Qualunque sia il tuo punto di partenza, <em>le due serate ti portano allo step successivo.</em></span>
<span className={[styles.s060].join(' ')}>↑ Scegli il tuo profilo per vedere cosa c&apos;è per te</span>
</div>
</div>)}
</div>

<div data-event-section="calculator" className={[styles.s061].join(' ')}>
<div className={[styles.s062].join(' ')}>
<div className={[styles.s063].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CAPITOLO 01 · IL NEMICO SILENZIOSO</div>
<h2 className={[styles.reveal, styles.s064].join(' ')}>Nessuno ti ha tolto un euro. <span className={[styles.accent].join(' ')}>Eppure ne hai di meno.</span></h2>
<p className={[styles.s065].join(' ')}>L&apos;inflazione non fa rumore e non ti manda un estratto conto. Tra il 2005 e il 2025 i prezzi in Italia sono saliti di circa il 45%. Scegli la tua cifra e quanti anni fa: guarda cosa è successo ai soldi fermi, e a quelli che hanno lavorato.</p>
</div>
<div className={[styles.s066].join(' ')}>

<div className={[styles.s067].join(' ')}>
<label htmlFor="capitale" className={[styles.s068].join(' ')}>Quanto avevi da parte?</label>
<div className={[styles.vAmount, styles.s069].join(' ')}><span data-bind="calc.amount">{calc.amount}</span> €</div>
<input id="capitale" type="range" min="1000" max="200000" step="1000" value={amount} onChange={event => setAmount(Number(event.target.value))} />
<div className={[styles.s068].join(' ')}>Quanti anni fa?</div>
<div className={styles.vYears} role="group" aria-label="Quanti anni fa">
{eventHorizons.map(y => (<button type="button" key={y} data-years={y} onClick={() => setYears(y)} aria-pressed={years === y} className={[styles.vYear, years === y ? styles.on : ''].join(' ')}><strong>{y}</strong><span>anni</span></button>))}
</div>
<div className={[styles.s071].join(' ')}>
<div className={[styles.s072].join(' ')}><span className={[styles.s073].join(' ')}>Fermi sul conto, oggi valgono come</span><span className={[styles.s074].join(' ')}><span data-bind="calc.real">{calc.real}</span> €</span></div>
<div className={[styles.s072].join(' ')}><span className={[styles.s073].join(' ')}>Potere d&apos;acquisto perso</span><span className={[styles.s075].join(' ')}>−<span data-bind="calc.lost">{calc.lost}</span> €</span></div>
</div>
<div className={[styles.s076].join(' ')}>In {years} anni i prezzi sono saliti di circa il <strong className={[styles.s077].join(' ')}>{calc.inflation}%</strong>. Il saldo è rimasto uguale, quello che ci compri no.</div>
</div>

<div className={[styles.s079].join(' ')}>
<div className={[styles.s080].join(' ')}>
<Image src="/benessere-patrimoniale/evento/coins.jpg" alt="Due colonne di monete d'oro: la seconda è più bassa e la parte mancante è un contorno luminoso" width={1400} height={1100} sizes="(max-width: 820px) 100vw, 50vw" className={[styles.s081].join(' ')} />
<div className={[styles.s082].join(' ')}>
<div className={[styles["tile-d"], styles["coin-tag"], styles.s083].join(' ')}><div className={[styles.s084].join(' ')}>{2025 - years}</div><div className={[styles.s085].join(' ')}>{calc.amount} €</div></div>
</div>
<div className={[styles.s086].join(' ')}>
<div className={[styles["coin-tag"], styles.s087].join(' ')}><div className={[styles.s088].join(' ')}>EVAPORATO</div><div className={[styles.s089].join(' ')}>−{calc.lost} €</div></div>
</div>
<div className={[styles["coin-2025"], styles.s090].join(' ')}>
<div className={[styles["tile-d"], styles["coin-tag"], styles.s083].join(' ')}><div className={[styles.s084].join(' ')}>OGGI</div><div className={[styles.s085].join(' ')}>≈ {calc.real} €</div></div>
</div>
</div>
</div>
</div>

<div className={styles.vWhatIf}>
<div className={styles.vWhatIfHead}>
<h3 className={styles.vWhatIfTitle}>E se quei {calc.amount} € non fossero rimasti fermi?</h3>
<p className={[styles.s065].join(' ')}>Lo stesso importo, investito {years} anni fa. Valore indicativo oggi, in euro.</p>
</div>
<div className={styles.vAssets}>
{calc.assets.map(asset => (<article key={asset.id} data-asset={asset.id} className={[styles.vAsset, asset.name === calc.best ? styles.vAssetBest : ''].join(' ')}>
<div className={styles.vAssetImg}><Image src={asset.img} alt="" width={640} height={480} sizes="(max-width: 820px) 84vw, 25vw" /></div>
<div className={styles.vAssetBody}>
<div className={styles.vAssetName}>{asset.name}{asset.name === calc.best && <span className={styles.vBestTag}>il migliore in {years} anni</span>}</div>
<div className={styles.vAssetValue}>{asset.value} €</div>
<div className={styles.vAssetMeta}><span>×{asset.multiple}</span><span>+{asset.gain} €</span></div>
<div className={styles.vAssetTrack}><div style={{ width: `${asset.width}%`, background: asset.color }} /></div>
</div>
</article>))}
</div>
<div className={styles.vGap}><span>Fermi sul conto: <strong className={styles.vLoss}>{calc.real} €</strong> di potere d&apos;acquisto.</span><span>La differenza con la scelta migliore: <strong>{calc.gap} €</strong>. Non per fortuna: per metodo.</span></div>
<div className={[styles.s078].join(' ')}>Simulazione su dati storici in euro, prima di tasse e costi. Dati illustrativi in revisione. I rendimenti passati non sono indicativi di quelli futuri: negli stessi anni tutti questi strumenti hanno avuto anche cali forti.</div>
</div>
</div>
</div>

<div data-event-section="pyramid" className={styles.vSplitSection}>
<div className={styles.vSplitCopy}>
<div className={[styles["label"], styles.s012].join(' ')}>CAPITOLO 02 · IL VERO PROBLEMA</div>
<h2 className={[styles.reveal, styles.s064].join(' ')}>Mettere da parte soldi non è proteggere valore.</h2>
<p className={[styles.s065].join(' ')}>Chi protegge un patrimonio non si chiede &quot;dove li metto?&quot;. Si chiede &quot;come li divido?&quot;. Metà in cose che puoi toccare, metà in strumenti che lavorano sui mercati.</p>
</div>
<div className={styles.vSplitHero}>
<Image src="/benessere-patrimoniale/evento/diversificazione.jpg" alt="Composizione divisa a metà da una linea di luce: a sinistra lingotti e una piccola casa, a destra un globo d'oro e colonne crescenti" fill sizes="(max-width: 1280px) 100vw, 1232px" className={styles.vSplitImg} />
<div className={[styles.vHalfTag, styles.vHalfLeft].join(' ')}><strong>50%</strong><span>Beni reali · cose che tocchi</span></div>
<div className={[styles.vHalfTag, styles.vHalfRight].join(' ')}><strong>50%</strong><span>Beni finanziari · lavorano sui mercati</span></div>
</div>
<div className={styles.vSplitBody}>
<div className={styles.vAlloc} role="group" aria-label="Come può essere diviso un patrimonio: tocca una parte">
{(['reali', 'finanziari'] as const).map(half => (<div key={half} className={styles.vAllocHalf}>
{eventAllocation.filter(item => item.half === half).map(item => (<button type="button" key={item.id} aria-pressed={slice === item.id} aria-label={`${item.name} ${item.share}%`} onClick={() => setSlice(item.id)} className={[styles.vAllocSeg, slice === item.id ? styles.on : ''].join(' ')} style={{ width: `${item.share * 2}%` }}><span className={styles.vAllocFill} style={{ background: item.color }} /><span className={styles.vAllocPct}>{item.share}%</span></button>))}
</div>))}
</div>
<div className={styles.vAllocScale}><span>Beni reali</span><span>Beni finanziari</span></div>
<div className={styles.vAllocGrid}>
<div className={styles.vAllocList}>
{eventAllocation.map(item => (<button type="button" key={item.id} aria-pressed={slice === item.id} onClick={() => setSlice(item.id)} className={[styles.vLegendItem, slice === item.id ? styles.on : ''].join(' ')}>
<span className={styles.vSwatch} style={{ background: item.color }} /><span className={styles.vLegendName}>{item.name}</span><strong>{item.share}%</strong>
</button>))}
</div>
<div className={styles.vWhy} style={{ borderColor: curSlice.color }}>
<div className={styles.vWhyShare} style={{ color: curSlice.color }}>{curSlice.share}%</div>
<strong className={styles.vWhyName}>{curSlice.name}</strong>
<span>{curSlice.why}</span>
<span className={styles.vWhyNote}>Le percentuali giuste per te dipendono da età, obiettivi e da quanto hai già. Questa è la mappa da cui partire per ragionare.</span>
</div>
</div>
</div>
</div>

<div data-event-section="questions" className={[styles.s120, styles.vQuestions].join(' ')}>
<div className={[styles.s114].join(' ')}>
<div className={[styles.s115].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CAPITOLO 03 · COSA SCOPRIRAI</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Le 6 domande a cui risponderemo nelle due serate.</h2>
<p className={[styles.s065].join(' ')}>Prova a vedere a quante sapresti rispondere oggi. Nessuna formula universale: l&apos;obiettivo è darti più elementi per scegliere con la tua testa.</p>
<p className={`${styles["swipe-hint"]} ${styles.label} ${styles.vMuted}`}>Scorri le 6 domande →</p>
</div>
<div data-carousel="s116" role="region" aria-label="Le sei domande" tabIndex={0} className={[styles["snap"], styles.s116].join(' ')}>
{questions.map((item, i) => (<div key={item.q} className={styles.vQcard}><span className={styles.vQnum}>0{i + 1}</span><strong className={[styles.s118].join(' ')}>{item.q}</strong><span className={[styles.s121].join(' ')}>{item.sub}</span></div>))}
</div>

<div className={styles.vQuiz} id="strumenti">
<div className={styles.vQuizHead}>
<div className={[styles["label"], styles.s012].join(' ')}>DOMANDA 06 · PRIMA DI SCOPRIRLO</div>
<h3 className={styles.vQuizTitle}>Quali di questi strumenti conosci?</h3>
<p className={[styles.s065].join(' ')}>Tocca quelli che conosci: per ognuno vedi quanto ha reso la scelta migliore negli ultimi 10 anni. Hai sbagliato? Tocca di nuovo per toglierlo.</p>
</div>
<div className={styles.vTiles}>
{eventInstruments.map(item => (<button type="button" key={item.id} aria-pressed={!!known[item.id]} onClick={() => toggle(item.id)} className={[styles.vTile, known[item.id] ? styles.on : '', open === item.id ? styles.vTileOpen : ''].join(' ')}>
<span className={styles.vTileImg}><Image src={item.img} alt="" width={320} height={240} sizes="160px" /></span>
<span className={styles.vTileName}>{item.name}</span>
<span className={styles.vTileCheck} aria-hidden="true">{known[item.id] ? '✓' : '+'}</span>{known[item.id] && <span className={styles.vTileHint}>Tocca per togliere</span>}
</button>))}
</div>
{openInst && (<div className={styles.vInst}>
<div className={styles.vInstImg}><Image src={openInst.img} alt="" width={640} height={480} sizes="(max-width: 820px) 100vw, 320px" /></div>
<div className={styles.vInstBody}>
<div className={styles.vInstTop}><strong className={styles.vInstName}>{openInst.name}</strong><button type="button" className={styles.vInstRemove} onClick={() => { setKnown(prev => { const next = { ...prev }; delete next[openInst.id]; return next; }); setOpen(null); }}>Non lo conosco</button></div>
<div className={styles.vInstBest}>Il migliore: <strong>{openInst.best}</strong></div>
<div className={styles.vInstStats}>
<div><span className={styles.s073}>Media negli ultimi 10 anni</span><strong>{openInst.ten}</strong></div>
<div><span className={styles.s073}>In 10 anni</span><strong>{openInst.result}</strong></div>
</div>
<p className={styles.vInstRole}>{openInst.role}</p>
<div className={styles.vLevels}>{eventKnowledgeLevels.map(level => (<button type="button" key={level} aria-pressed={known[openInst.id] === level} onClick={() => setKnown(prev => ({ ...prev, [openInst.id]: level }))} className={[styles.vLevel, known[openInst.id] === level ? styles.on : ''].join(' ')}>{level}</button>))}</div>
</div>
</div>)}
<div className={styles.vQuizFoot}><span>Conosci <strong>{Object.keys(known).length}</strong> strumenti su {eventInstruments.length}. Nelle due serate vedrai come si incastrano tra loro, compresi quelli che non hai toccato.</span>
<a href="#richiesta" className={[styles.cta, styles.s057].join(' ')}>Voglio le risposte <Arrow /></a></div>
<div className={[styles.s078].join(' ')}>Valori indicativi in euro, prima di tasse e costi. Immobili: bilocale di 60 m² a Milano 2015–2025, prezzi +58% e affitti lordi (Osservatorio Casa Abbordabile, Idealista). Obbligazioni: VanEck, 10 anni al 31/12/2025. I rendimenti passati non garantiscono quelli futuri.</div>
</div>
</div>
</div>

<div data-event-section="gold-comparison" className={[styles.s113].join(' ')}>
<div className={[styles.s039].join(' ')}>
<div className={[styles.s040].join(' ')}>
<div className={[styles.s041].join(' ')}>CAPITOLO 04 · UN&apos;ANTEPRIMA</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Quattro famiglie, un solo patrimonio.</h2>
<p className={[styles.s043].join(' ')}>Ognuna fa un lavoro diverso. Insieme si proteggono a vicenda.</p>
</div>
<div className={[styles.vTabs, styles.vTabsLight].join(' ')} role="tablist" aria-label="Le quattro famiglie di strumenti">
{families.map(item => (<button type="button" role="tab" key={item.id} aria-selected={family === item.id} onClick={() => setFamily(item.id)} className={[styles.vTab, family === item.id ? styles.on : ''].join(' ')}>{item.name}</button>))}
</div>
<div className={styles.vFamily} role="tabpanel" key={curFamily.id}>
<div className={styles.vFamilyImg}>
<Image src={curFamily.img} alt={curFamily.alt} width={1400} height={1050} sizes="(max-width: 820px) 100vw, 55vw" />
<div className={styles.vFamilyStat}><strong>{curFamily.stat}</strong><span>{curFamily.statLabel}</span></div>
</div>
<div className={styles.vFamilyMain}>
<h3 className={styles.vFamilyName}>{curFamily.name}</h3>
<p className={styles.vFamilyWhat}>{curFamily.what}</p>
<div>{curFamily.rows.map(([title, body]) => (<div key={title} className={styles.vFamilyRow}><strong>{title}</strong><span>{body}</span></div>))}</div>
</div>
</div>
<p className={[styles.s143, styles.vInk].join(' ')}>Nessuna di queste famiglie, da sola, basta: nelle due serate vedrai come si combinano. Valori indicativi in euro, prima di tasse e costi; fonti: S&P Dow Jones e MSCI via EU Personal Finance, VanEck, iShares, Idealista, Osservatorio Casa Abbordabile. I rendimenti passati non garantiscono quelli futuri.</p>
</div>
</div>

<div data-event-section="agenda" className={[styles.s114].join(' ')}>
<div className={[styles.s144].join(' ')}>
<div className={[styles.s145].join(' ')}>
<div className={[styles.s041].join(' ')}>COME SI SVOLGE</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Cosa scoprirai nelle due serate.</h2>
</div>
<div className={[styles.s146].join(' ')}>La prima serata cambia il modo in cui guardi i tuoi soldi. La seconda ti mostra come si costruisce e si protegge un patrimonio.</div>
</div>
<div className={styles.vEvenings}>
{evenings.map(evening => (<article key={evening.n} className={styles.vEvening}>
<div className={styles.vEveningImg}><Image src={evening.img} alt={evening.alt} width={1400} height={1050} sizes="(max-width: 820px) 100vw, 50vw" />
<div className={styles.vEveningBadge}><span>Serata</span><strong>{evening.n}</strong></div></div>
<div className={styles.vEveningBody}>
<div className={styles.vEveningTitle}>{evening.title}</div>
<ol className={styles.vSteps}>{evening.items.map(([title, body]) => (<li key={title}><strong>{title}</strong>{body && <span>{body}</span>}</li>))}</ol>
</div>
</article>))}
</div>
<p className={[styles.s043, styles.vCenter].join(' ')}>Due serate, una domanda di fondo: <strong>i tuoi soldi stanno lavorando per te o contro di te?</strong></p>
</div>

<div data-event-section="audience" className={[styles.s155].join(' ')}>
<div className={[styles.s156].join(' ')}>
<h3 className={[styles.s157].join(' ')}>È per te se…</h3>
<div className={[styles.s150].join(' ')}>
{['Arrivi a fine mese senza riuscire a mettere da parte nulla, e vuoi un metodo semplice per iniziare.', 'Hai dei risparmi fermi sul conto e senti che stanno perdendo valore.', 'Sei in pensione e vuoi proteggere quello che hai costruito in una vita di lavoro.', 'Sei un imprenditore o un professionista e vuoi separare la ricchezza dell’azienda da quella della tua famiglia.', 'Ti affidi a un consulente ma vuoi capire cosa firmi e quali domande fare.', 'Vuoi capire oro, argento, immobili, ETF e obbligazioni prima di scegliere.', 'Investi già e vuoi vedere come ragionano i grandi patrimoni.', 'Sei un genitore e vuoi lasciare ai tuoi figli soldi e anche il modo di gestirli.'].map(text => (<div key={text} className={[styles.s096].join(' ')}><span className={[styles.s158].join(' ')}><Check /></span><span>{text}</span></div>))}
</div>
</div>
<div className={[styles.s159].join(' ')}>
<h3 className={[styles.s157].join(' ')}>Non è per te se cerchi…</h3>
<div className={[styles.s160].join(' ')}>
{['Rendimenti garantiti o previsioni certe sui mercati.', 'Scorciatoie per arricchirti in fretta.', 'La dritta su cosa comprare domani mattina.', 'Una consulenza personalizzata durante le serate.', 'Una soluzione uguale per tutti.'].map(text => (<div key={text} className={[styles.s096].join(' ')}><span className={[styles.s161].join(' ')}><Cross /></span><span>{text}</span></div>))}
</div>
</div>
</div>

<div data-event-section="speaker" className={[styles.s120].join(' ')}>
<div className={[styles.s162].join(' ')}>
<div className={[styles["portrait"], styles.s163].join(' ')}>
<Image src="/people/frank-no-badge.png" alt="Frank Cannoletta, Imprenditore e Strategista Horyzon" fill sizes="(max-width: 820px) calc(100vw - 48px), 420px" className={styles['speaker-photo']} />
</div>
<div className={[styles.s167].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>CHI TI ACCOMPAGNA</div>
<h2 className={[styles.reveal, styles.s168].join(' ')}>Frank Cannoletta</h2>
<div className={[styles.s130].join(' ')}>Imprenditore &amp; Strategista Horyzon</div>
<blockquote className={[styles.s169].join(' ')}>&quot;Mi occupo di patrimonio e finanza da quando ho perso un anno di lavoro della mia vita nelle mani di un consulente.&quot;</blockquote>
<p className={[styles.s065].join(' ')}>Mi ero affidato ai consigli di un consulente che non ha saputo leggere il mercato, e a me mancavano le competenze per accorgermene in tempo. Un anno intero del mio lavoro, andato. Da quel giorno ho deciso che non avrei più firmato nulla senza capirlo: ho investito oltre 10.000 euro in corsi e formazione sulla finanza, ho studiato come ragionano i grandi patrimoni e ho iniziato ad applicarlo.</p>
<p className={[styles.s065].join(' ')}>In queste due serate ti do quello che a me è mancato: <strong className={styles.s003}>le domande giuste, prima di firmare.</strong></p>
<div className={[styles.s170].join(' ')}>
<div><div className={[styles.accent, styles.s171].join(' ')}>11 anni</div><div className={[styles.s073].join(' ')}>al fianco di imprese e imprenditori per farli crescere</div></div>
<div><div className={[styles.accent, styles.s171].join(' ')}>10.000+</div><div className={[styles.s073].join(' ')}>consulenze erogate</div></div>
<div><div className={[styles.accent, styles.s171].join(' ')}>Centinaia</div><div className={[styles.s073].join(' ')}>di seminari pubblici</div></div>
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
<div className={[styles.s174].join(' ')}><div aria-label="5 stelle su 5" className={[styles.s175].join(' ')}>★★★★★</div><p className={[styles.s176].join(' ')}>&quot;[Testimonianza reale: la domanda che poi ha fatto alla sua banca.]&quot;</p><div className={[styles.s177].join(' ')}><span className={[styles.s178].join(' ')}></span><span className={[styles.s179].join(' ')}><strong>[Nome C.]</strong><br /><span className={[styles.s180].join(' ')}>[Pensionato, Roma]</span></span></div></div>
</div>
</div>

<div data-event-section="bonuses" className={[styles.s113].join(' ')}>
<div className={[styles.s181].join(' ')}>
<div className={[styles.s182].join(' ')}>
<div className={[styles.s041].join(' ')}>COSA RICEVI REGISTRANDOTI OGGI</div>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Non solo due serate.</h2>
<p className={[styles.s043].join(' ')}>Un quadro più chiaro, e qualcuno con cui guardarlo. L&apos;obiettivo è uno: farti vedere come lavorano i milionari, come gestiscono e proteggono i loro patrimoni.</p>
</div>
<div className={[styles.s183].join(' ')}>
<div className={[styles.s184].join(' ')}><div><strong className={[styles.s185].join(' ')}>Evento live in due serate</strong><div className={[styles.s119].join(' ')}>Con domande e risposte dal vivo, e la regola 70-10-10-10 pronta da applicare</div></div><span className={[styles.s186].join(' ')}>Incluso</span></div>
<div className={styles.vRadar}><div className={styles.vRadarImg}><Image src="/benessere-patrimoniale/evento/radar.jpg" alt="Quadrante d'oro con anelli concentrici e una lancetta" width={800} height={800} sizes="160px" /></div><div><span className={[styles.s187].join(' ')}>BONUS 1 · IN REGALO</span><br /><strong className={[styles.s185].join(' ')}>Il tuo Radar Patrimoniale</strong><div className={[styles.s119].join(' ')}>Uno strumento utile per i tuoi investimenti: ti mostra in un colpo d&apos;occhio dove il tuo patrimonio è scoperto e dove è troppo concentrato.</div></div><span className={[styles.s186].join(' ')}>Gratuito</span></div>
<div className={[styles.s184].join(' ')}><div><span className={[styles.s187].join(' ')}>BONUS 2</span><br /><strong className={[styles.s185].join(' ')}>Le registrazioni delle due serate per 48 ore</strong><div className={[styles.s119].join(' ')}>Per rivederle con calma, o recuperare quella che hai perso. Solo per chi si registra prima dell&apos;evento</div></div><span className={[styles.s186].join(' ')}>Incluso</span></div>
<div className={[styles.s184].join(' ')}><div><span className={[styles.s187].join(' ')}>BONUS 3</span><br /><strong className={[styles.s185].join(' ')}>La lista delle domande da fare prima di firmare</strong><div className={[styles.s119].join(' ')}>Da portare al prossimo appuntamento in banca</div></div><span className={[styles.s186].join(' ')}>Incluso</span></div>
<div className={[styles.s188].join(' ')}><div><span className={[styles.s189].join(' ')}>BONUS 4 · SE LO DESIDERI</span><br /><strong className={[styles.s185].join(' ')}>40 minuti solo per te, con un Architetto Patrimoniale</strong><div className={[styles.s121].join(' ')}>Dopo l&apos;evento partite da quello che ti ha colpito nelle due serate: cosa ti interessa davvero, cosa ti preoccupa, quali strumenti vuoi approfondire. Esci con le idee chiare sul tuo prossimo passo. Nessun costo, nessun obbligo, e non ti chiameremo se non sei tu a chiederlo.</div></div><span className={[styles.s190].join(' ')}>Gratuito</span></div>
<div className={[styles.s191].join(' ')}><div className={[styles.s192].join(' ')}>Per te, oggi: <strong>gratis</strong>.</div><a href="#richiesta" className={[styles.cta, styles["cta-ink"], styles.s193].join(' ')}>Riserva il posto e il Radar</a></div>
</div>
</div>
</div>

<div id="richiesta" data-event-section="request" className={[styles.s194].join(' ')}>
<div className={[styles.s195].join(' ')}>
<div className={[styles.s196].join(' ')}>
<div className={[styles["label"], styles.s012].join(' ')}>ULTIMO PASSO</div>
<h2 className={[styles.reveal, styles.s197].join(' ')}><span data-bind="formTitle">{formTitle}</span></h2>
<p className={[styles.s065].join(' ')}>Ci vogliono 30 secondi. Ricevi il link, i promemoria e, dopo l&apos;evento, il tuo Radar Patrimoniale. Teniamo i posti limitati perché rispondiamo a tutte le domande dal vivo.</p>
<div className={[styles["tile-d"], styles.s198].join(' ')}>
<div className={[styles.s199].join(' ')}><span className={[styles.s056].join(' ')}>Posti rimasti</span><strong><EventSessionValue name="seatsLeft" /> su <EventSessionValue name="seatsTotal" /></strong></div>
<div className={[styles.s200].join(' ')}><div style={ { width: `${eventSession.seatsTaken / eventSession.seatsTotal * 100}%` }} className={[styles.s034].join(' ')}></div></div>
<div className={[styles.s073].join(' ')}>Prima serata tra <EventSessionValue name="cd.d" /> giorni e <EventSessionValue name="cd.h" /> ore</div>
</div>
<div className={[styles.s201].join(' ')}>
<span className={[styles.s202].join(' ')}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg></span>
<div><strong>La nostra promessa</strong><div className={[styles.s121].join(' ')}>Nessuna vendita durante le serate. Se senti che non fa per te, esci: nessuno ti richiamerà per insistere.</div></div>
</div>
</div>
<EventNotesContext.Provider value={eventNotes(scene, selectedProfile, known)}><PatrimonialLeadForm mode="patrimonial-event" presentation="event" selectedProfile={selectedProfile} onProfileChange={setSelectedProfile} /></EventNotesContext.Provider>
</div>
</div>

<div data-event-section="faq" className={[styles.s203].join(' ')}>
<p className={styles.s041}>FAQ</p>
<h2 className={[styles.reveal, styles.s093].join(' ')}>Domande frequenti</h2>
<div className={[styles.s204].join(' ')}>
{[
  ['È davvero gratuito? Qual è la fregatura?', 'Le due serate sono gratuite. Ti chiediamo solo di esserci a entrambe. Dopo, se lo chiedi tu, un Architetto Patrimoniale ti dedica 40 minuti gratuiti. Se non lo chiedi, nessuno ti contatterà per proporti qualcosa.'],
  ['Dove si svolge e cosa mi serve per collegarmi?', 'Online. Ti serve un computer, un tablet o uno smartphone con connessione. Ti mandiamo il link via email e un promemoria prima di ogni serata.'],
  ['E se perdo una delle due serate?', 'Registrati comunque: chi si iscrive prima dell’evento riceve le registrazioni di entrambe le serate, disponibili per 48 ore.'],
  ['Devo accendere la videocamera o parlare?', 'No. Puoi seguire in tranquillità e fare domande in chat quando vuoi.'],
  ['Posso partecipare con un familiare?', 'Sì, e te lo consigliamo: le scelte sul patrimonio si fanno meglio insieme.'],
  ['Serve già sapere di finanza?', 'No. Partiamo dalle basi e arriviamo a come ragionano i grandi patrimoni. Ognuno dei quattro profili trova qualcosa per sé.'],
  ['Ho pochi risparmi. Ha senso per me?', 'Sì. La prima serata è pensata proprio per chi oggi non riesce a mettere da parte: la regola 70-10-10-10 si applica anche con uno stipendio normale.'],
  ['Mi direte in cosa investire?', 'No. Durante le serate non diamo consigli personalizzati. Ti diamo gli strumenti per capire e le domande da fare a chi ti segue.'],
  ['I rendimenti mostrati sulla pagina sono garantiti?', 'No. Sono dati storici, prima di tasse e costi. Il passato non garantisce il futuro e ogni strumento può perdere valore.'],
  ['Perché parlate di metalli preziosi?', 'Perché sono la parte del patrimonio che non dipende da una banca o da un’azienda. Nella seconda serata vediamo pro e contro, costi compresi.'],
  ['Come è tassato l’oro da investimento in Italia?', 'Se comprato da operatori autorizzati è esente IVA; quando lo vendi, la plusvalenza è tassata al 26%. L’argento invece si paga con IVA al 22%.'],
  ['Cos’è il Radar Patrimoniale?', 'Uno strumento che ti regaliamo, utile per i tuoi investimenti: ti mostra come è diviso oggi quello che hai e dove sei scoperto o troppo concentrato.'],
  ['Chi organizza l’evento?', 'Horyzon Benessere Patrimoniale, divisione di FELICITÀ srl, Viale Papiniano 28, Milano.'],
].map(([q, a]) => (<details key={q} className={[styles.s205].join(' ')}><summary className={[styles.s206].join(' ')}>{q}<span className={[styles["faq-plus"], styles.s207].join(' ')}>+</span></summary><p className={[styles.s208].join(' ')}>{a}</p></details>))}
</div>
</div>

<div data-event-section="closing" className={[styles.s209].join(' ')}>
<div className={[styles.s210].join(' ')}>
<p className={styles.s012}>Il prossimo passo</p>
<h2 className={`${styles.reveal} ${styles.s211}`}>Tra un anno potrai dire &quot;avrei dovuto&quot;. Oppure <span className={styles["chip-lime"]}>&quot;per fortuna&quot;</span>.</h2>
<p className={[styles.s043, styles.vMuted].join(' ')}>La differenza sono due serate. <strong className={styles.s003}>P.S.</strong> Se sei arrivato fin qui senza registrarti, uno dei quattro profili probabilmente ti somiglia già.</p>
<a href="#richiesta" className={[styles.cta, styles.s212].join(' ')}>Riserva il mio posto gratuito
<Arrow /></a>
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
<span className={[styles.s130].join(' ')}>Due serate online · la prima inizia tra <EventSessionValue name="cd.d" />g <EventSessionValue name="cd.h" />h <EventSessionValue name="cd.m" />m · restano <EventSessionValue name="seatsLeft" /> posti</span>
</div>
<a href="#richiesta" className={[styles.cta, styles.s222].join(' ')}>Riserva il posto gratuito <span aria-hidden="true">→</span></a>
</div>
</div>
</aside>
</div>
  </EventSessionProvider>;
}
