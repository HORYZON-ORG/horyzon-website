"use client";
import Link from "next/link";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { Horizon, MethodExperience } from "./horizon";
import { SiteHeader, SiteFooter } from "./site-shell";

const problems = [["01", "Tempo", "L’operatività assorbe le persone che dovrebbero guidare."], ["02", "Chiarezza", "I dati esistono, ma non diventano decisioni."], ["03", "Energia", "Processi frammentati rallentano talento e crescita."]];
const areas = [
  { n: "01", title: "Benessere organizzativo", text: "Persone, ruoli e processi allineati per rendere l’impresa più solida e meno dipendente dall’imprenditore.", href: "/benessere-organizzativo", tone: "lime" },
  { n: "02", title: "Benessere patrimoniale", text: "Il patrimonio torna a essere uno strumento di libertà, protezione e visione per chi lo ha creato.", href: "/benessere-patrimoniale", tone: "gold" },
  { n: "03", title: "Benessere digitale", text: "AI, automazioni e dati entrano nei processi reali: meno sprechi, più capacità decisionale.", href: "/benessere-digitale", tone: "cyan" },
];
export function Experience() {
  const story = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const { scrollYProgress: storyProgress } = useScroll({ target: story, offset: ["start end", "end start"] });
  const drift = useTransform(storyProgress, [0, 1], [120, -120]);
  const rotate = useTransform(storyProgress, [0, 1], [-10, 12]);
  const reduce = useReducedMotion();
  return <><SiteHeader/><main id="content">
    <motion.div className="progress" style={{ scaleX: progress }} />
    <section className="hero"><Horizon/><motion.div className="hero-copy" initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}><p className="eyebrow"><span/> Impresa · Economia · Umanità</p><h1>Guarda oltre.<br/><em>Ritrova spazio.</em></h1><p className="lead">Persone, patrimonio e intelligenza artificiale. Un’unica direzione per far crescere l’impresa e vivere meglio.</p><div className="hero-actions"><Link href="/contatti" className="button primary">Costruiamo il prossimo passo <span>↗</span></Link><a href="#evoluzione" className="button ghost">Scopri come <span>↓</span></a></div></motion.div><p className="scroll-hint">SCORRI PER VEDERE IL CAMBIAMENTO <span>↓</span></p></section>
    <section id="evoluzione" className="problem-section" ref={story}><motion.div className="section-orb" style={{ y: drift, rotate }}/><div className="section-head"><p className="eyebrow dark"><span/> Il punto di partenza</p><h2>La tua azienda non ha bisogno<br/>di altra complessità.</h2><p>Ha bisogno di vedere con chiarezza ciò che la rallenta e trasformarlo in una direzione concreta.</p></div><div className="problem-grid">{problems.map(([n,t,d], i) => <motion.article key={t} initial={reduce ? false : { opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-15%" }} transition={{ delay: i*.12 }}><span>{n}</span><h3>{t}</h3><p>{d}</p><div className="signal"><b/><b/><b/><b/><b/></div></motion.article>)}</div><div className="turn"><span>Non partiamo da ciò che vendiamo.</span><strong>Partiamo da ciò che oggi<br/>ti impedisce di crescere.</strong></div></section>
    <MethodExperience/>
    <section id="soluzioni" className="areas"><div className="section-head compact"><p className="eyebrow dark"><span/> Un solo interlocutore</p><h2>Tre dimensioni.<br/><em>Un’impresa intera.</em></h2></div><div className="area-list">{areas.map((a,i)=><motion.div key={a.title} className={`area ${a.tone}`} initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }}><span className="area-n">{a.n}</span><div><h3>{a.title}</h3><p>{a.text}</p></div><Link href={a.href} aria-label={`Scopri ${a.title}`}>↗</Link><motion.div className="area-glow" initial={{ scale:0 }} whileInView={{ scale:1 }} transition={{ duration:.8, delay:i*.1 }}/></motion.div>)}</div></section>
    <section id="umanita" className="human"><div className="human-rings" aria-hidden="true"><span/><span/><span/><b>H</b></div><div className="human-copy"><p className="eyebrow"><span/> La nostra idea di futuro</p><h2>Tecnologia più potente.<br/><em>Persone più libere.</em></h2><p>L’intelligenza artificiale ha valore quando restituisce alle persone tempo, comprensione e possibilità. Il futuro che costruiamo non sostituisce l’umano: lo rimette al centro.</p><Link href="/umanita" className="text-link">Scopri la visione Horyzon <span>↗</span></Link></div></section>
    <section className="impact"><p className="eyebrow dark"><span/> Presenza e competenze</p><div className="impact-grid"><div><strong>~50</strong><span>professionisti</span></div><div><strong>3</strong><span>dimensioni integrate</span></div><div><strong>1</strong><span>direzione condivisa</span></div></div><p className="places">MILANO · MONZA · LUGANO · BELLINZONA · BARI · LECCE</p></section>
    <section className="final-cta"><div className="aurora"/><p>Il prossimo passo non è adottare più tecnologia.</p><h2>È capire dove può<br/><em>cambiare davvero la tua azienda.</em></h2><Link href="/contatti" className="button primary light">Parliamone <span>↗</span></Link></section>
    <section className="discover-section"><p className="eyebrow dark"><span/> Il tuo prossimo orizzonte</p><h2>Non fermarti<br/><em>alla prima prospettiva.</em></h2><div className="discover-grid">{[["01","Misura","Da dove puoi iniziare?","/misura"],["02","Persone","Conosci chi lavora al tuo fianco.","/persone"],["03","Biblioteca","Idee da portare nel tuo lavoro.","/biblioteca"],["04","Entra in Horyzon","Il tuo talento, una missione comune.","/entra-in-horyzon"]].map(([n,t,d,h])=><Link href={h} key={h}><span>{n} ↗</span><h3>{t}</h3><p>{d}</p></Link>)}</div></section>
  </main><SiteFooter/></>;
}
