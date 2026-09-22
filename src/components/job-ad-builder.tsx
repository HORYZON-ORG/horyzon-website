"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "@/app/annuncio-10x/annuncio-10x.module.css";

type Mode = "create" | "improve";
type Brief = {
  existing: string;
  role: string;
  result: string;
  activities: string;
  required: string;
  preferred: string;
  location: string;
  schedule: string;
  contract: string;
  compensation: string;
  growth: string;
  context: string;
};

const initialBrief: Brief = {
  existing: "",
  role: "",
  result: "",
  activities: "",
  required: "",
  preferred: "",
  location: "",
  schedule: "",
  contract: "",
  compensation: "",
  growth: "",
  context: "",
};

function clean(value: string, fallback: string) {
  return value.trim() || fallback;
}

function bullets(value: string, fallback: string[]) {
  const items = value.split(/\n|,|;/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

export function JobAdBuilder() {
  const [mode, setMode] = useState<Mode>("improve");
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof Brief, value: string) => {
    setBrief((current) => ({ ...current, [field]: value }));
    setSubmitted(false);
  };

  const result = useMemo(() => {
    const role = clean(brief.role, "la persona che stiamo cercando");
    const outcome = clean(brief.result, "portare un contributo concreto e misurabile al ruolo");
    const activities = bullets(brief.activities, ["gestire le attività principali del ruolo", "collaborare con il team", "monitorare i risultati concordati"]);
    const required = bullets(brief.required, ["autonomia operativa", "comunicazione chiara", "orientamento al risultato"]);
    const preferred = bullets(brief.preferred, []);
    const details = [
      brief.location && `Sede: ${brief.location}`,
      brief.schedule && `Orario: ${brief.schedule}`,
      brief.contract && `Contratto: ${brief.contract}`,
      brief.compensation && `Retribuzione: ${brief.compensation}`,
      brief.growth && `Crescita e formazione: ${brief.growth}`,
    ].filter(Boolean) as string[];

    return { role, outcome, activities, required, preferred, details };
  }, [brief]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    requestAnimationFrame(() => document.getElementById("annuncio-generato")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const copyResult = async () => {
    const node = document.getElementById("annuncio-generato");
    if (node) await navigator.clipboard.writeText(node.innerText);
  };

  return <section className={styles.builder} id="prova" aria-labelledby="builder-title">
    <div className={styles.builderIntro}>
      <p className={styles.kicker}>Prototipo testabile</p>
      <h2 id="builder-title">Parti dal punto in cui sei.</h2>
      <p>Scegli un percorso. Le informazioni raccolte servono a produrre lo stesso risultato: un annuncio più chiaro, concreto e utilizzabile.</p>
      <ol>
        <li><span>01</span> Scegli il percorso</li>
        <li><span>02</span> Completa il brief</li>
        <li><span>03</span> Verifica l’output</li>
      </ol>
    </div>

    <div className={styles.workspace}>
      <div className={styles.modeTabs} role="group" aria-label="Modalità di creazione">
        <button type="button" aria-pressed={mode === "improve"} onClick={() => { setMode("improve"); setSubmitted(false); }}>
          <span>Ho già un annuncio</span><strong>Miglioralo</strong>
        </button>
        <button type="button" aria-pressed={mode === "create"} onClick={() => { setMode("create"); setSubmitted(false); }}>
          <span>Parto da zero</span><strong>Crealo</strong>
        </button>
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        {mode === "improve" && <label className={styles.fullField}>
          <span>Incolla l’annuncio attuale</span>
          <textarea rows={7} value={brief.existing} onChange={(event) => update("existing", event.target.value)} placeholder="Incolla qui il testo. Lo useremo come punto di partenza per individuare cosa manca." />
        </label>}

        <div className={styles.formSection}>
          <p><span>01</span> Ruolo e risultato</p>
          <div className={styles.fieldGrid}>
            <label><span>Qual è il ruolo? *</span><input required value={brief.role} onChange={(event) => update("role", event.target.value)} placeholder="Es. Responsabile commerciale" /></label>
            <label><span>Quale risultato deve produrre? *</span><input required value={brief.result} onChange={(event) => update("result", event.target.value)} placeholder="Es. Sviluppare il portafoglio clienti" /></label>
            <label className={styles.fullField}><span>Quali attività svolgerà ogni settimana? *</span><textarea required rows={4} value={brief.activities} onChange={(event) => update("activities", event.target.value)} placeholder="Una attività per riga oppure separate da virgole" /></label>
          </div>
        </div>

        <div className={styles.formSection}>
          <p><span>02</span> Persona e contesto</p>
          <div className={styles.fieldGrid}>
            <label><span>Competenze indispensabili *</span><textarea required rows={4} value={brief.required} onChange={(event) => update("required", event.target.value)} placeholder="Una competenza per riga" /></label>
            <label><span>Competenze preferibili</span><textarea rows={4} value={brief.preferred} onChange={(event) => update("preferred", event.target.value)} placeholder="Cosa costituisce un vantaggio?" /></label>
            <label className={styles.fullField}><span>In quale contesto lavorerà?</span><textarea rows={3} value={brief.context} onChange={(event) => update("context", event.target.value)} placeholder="Team, stile di lavoro, fase aziendale, valori osservabili" /></label>
          </div>
        </div>

        <div className={styles.formSection}>
          <p><span>03</span> Condizioni concrete</p>
          <div className={styles.fieldGrid}>
            <label><span>Sede o modalità di lavoro</span><input value={brief.location} onChange={(event) => update("location", event.target.value)} placeholder="Es. Lecce, ibrido" /></label>
            <label><span>Orario</span><input value={brief.schedule} onChange={(event) => update("schedule", event.target.value)} placeholder="Es. Full time, lun–ven" /></label>
            <label><span>Contratto</span><input value={brief.contract} onChange={(event) => update("contract", event.target.value)} placeholder="Es. Tempo indeterminato" /></label>
            <label><span>Retribuzione, se comunicabile</span><input value={brief.compensation} onChange={(event) => update("compensation", event.target.value)} placeholder="Es. RAL 30–36k" /></label>
            <label className={styles.fullField}><span>Formazione e crescita</span><input value={brief.growth} onChange={(event) => update("growth", event.target.value)} placeholder="Es. Affiancamento iniziale e piano formativo" /></label>
          </div>
        </div>

        <button className={styles.generateButton} type="submit">Genera l’anteprima <span aria-hidden="true">↗</span></button>
        <p className={styles.prototypeNote}>Questa anteprima non salva né invia i dati inseriti.</p>
      </form>
    </div>

    {submitted && <article className={styles.result} id="annuncio-generato" tabIndex={-1}>
      <header>
        <div><p className={styles.kicker}>Output Annuncio 10x</p><h2>{result.role}</h2></div>
        <button type="button" onClick={copyResult}>Copia il testo</button>
      </header>
      <div className={styles.resultGrid}>
        <div className={styles.adCopy}>
          <p className={styles.resultLead}>Cerchiamo <strong>{result.role}</strong> per {result.outcome}. La persona entrerà in un contesto in cui responsabilità, aspettative e priorità vengono dichiarate con chiarezza.</p>
          {brief.context && <><h3>Il contesto</h3><p>{brief.context}</p></>}
          <h3>Cosa farai</h3><ul>{result.activities.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Cosa è importante</h3><ul>{result.required.map((item) => <li key={item}>{item}</li>)}</ul>
          {!!result.preferred.length && <><h3>Costituisce un vantaggio</h3><ul>{result.preferred.map((item) => <li key={item}>{item}</li>)}</ul></>}
          {!!result.details.length && <><h3>Condizioni</h3><ul>{result.details.map((item) => <li key={item}>{item}</li>)}</ul></>}
          <h3>Come candidarti</h3><p>Invia il tuo profilo spiegando brevemente quale esperienza ritieni più utile per questo ruolo.</p>
        </div>
        <aside>
          <div><p>Osservazioni principali</p><ul>
            <li>{brief.compensation ? "La retribuzione è indicata con chiarezza." : "Valuta se rendere esplicita la fascia retributiva."}</li>
            <li>{brief.context ? "Il contesto aiuta il candidato a valutare la compatibilità." : "Manca una descrizione concreta del contesto di lavoro."}</li>
            <li>Trasforma requisiti generici in comportamenti o risultati osservabili.</li>
          </ul></div>
          <div><p>Prima di pubblicare</p><ul className={styles.checklist}>
            <li>Conferma contratto, sede e orari</li><li>Elimina requisiti non indispensabili</li><li>Aggiungi una modalità di candidatura</li><li>Verifica tono e linguaggio inclusivo</li>
          </ul></div>
        </aside>
      </div>
    </article>}
  </section>;
}
