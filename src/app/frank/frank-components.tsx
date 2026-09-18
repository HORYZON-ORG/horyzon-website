import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { frankData } from '@/data/frank-data';

export function FrankBreadcrumb() {
  return (
    <nav className="frank-breadcrumb" aria-label="Percorso di navigazione">
      <Link href="/">Horyzon</Link>
      <span aria-hidden="true">/</span>
      <Link href="/persone">Persone</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Frank Cannoletta</span>
    </nav>
  );
}

export function FrankSubnav() {
  return (
    <nav className="frank-subnav" aria-label="Navigazione interna alla pagina">
      <div className="frank-subnav-inner">
        <ul className="frank-subnav-links">
          {frankData.navLinks.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
        <a
          className="frank-subnav-cta"
          href={frankData.person.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contatta Frank Cannoletta su WhatsApp"
        >
          Scrivi a Frank ↗
        </a>
      </div>
    </nav>
  );
}

export function FrankHero() {
  const { person } = frankData;
  return (
    <section className="frank-hero" aria-labelledby="frank-hero-title">
      <div className="frank-hero-grid">
        <div className="frank-hero-copy">
          <p className="frank-eyebrow">
            <span aria-hidden="true" />
            {person.eyebrow}
          </p>
          <h1 id="frank-hero-title">
            Frank
            <em>Cannoletta</em>
          </h1>
          <p className="frank-hero-role">{person.role}</p>
          <blockquote className="frank-hero-quote">
            {person.quote}
          </blockquote>
          <div className="frank-hero-domains" aria-label="Ambiti strategici integrati">
            {person.domains.map((domain, index) => (
              <React.Fragment key={domain}>
                <span>{domain}</span>
                {index < person.domains.length - 1 && <i aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>
          <div className="frank-hero-actions">
            <a
              className="frank-btn frank-btn-primary"
              href={person.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Prenota un confronto strategico con Frank Cannoletta su WhatsApp"
            >
              Prenota un confronto <span aria-hidden="true">↗</span>
            </a>
            <a className="frank-btn frank-btn-ghost" href="#metodo">
              Scopri il metodo <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="frank-portrait-wrapper">
          <div className="frank-portrait-frame">
            <Image
              src={person.image}
              alt={person.imageAlt}
              width={700}
              height={850}
              sizes="(max-width: 850px) 90vw, 420px"
              className="frank-portrait-img"
              priority
            />
          </div>
          <div className="frank-portrait-badge">
            <span className="frank-portrait-badge-num" aria-hidden="true">03</span>
            <p>
              Tre dimensioni.
              <strong>Un’unica strategia.</strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FrankProfile() {
  const { profile } = frankData;
  return (
    <section className="frank-section frank-profile" id="profilo" aria-labelledby="profilo-title">
      <div className="frank-profile-grid">
        <div>
          <p className="frank-kicker">{profile.kicker}</p>
          <h2 id="profilo-title">{profile.title}</h2>
        </div>
        <div>
          <p className="frank-profile-lead">{profile.lead}</p>
          <p className="frank-profile-body">{profile.body}</p>
          <div className="frank-profile-callout">
            <p>{profile.pillarsConcept}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FrankMethod() {
  const { method } = frankData;
  return (
    <section className="frank-section frank-section-dark" id="metodo" aria-labelledby="metodo-title">
      <div className="frank-method-header">
        <p className="frank-kicker">{method.kicker}</p>
        <h2 id="metodo-title">{method.title}</h2>
        <p className="frank-method-intro">{method.intro}</p>
      </div>

      <div className="frank-pillars-grid">
        {method.pillars.map((pillar, idx) => (
          <article
            className={`frank-pillar-card ${idx === 1 ? 'frank-pillar-card-featured' : ''}`}
            key={pillar.number}
          >
            <div className="frank-pillar-num">
              <span>{pillar.number}</span>
              <i aria-hidden="true" />
            </div>
            <p className="frank-pillar-category">{pillar.category}</p>
            <h3>{pillar.title}</h3>
            <p className="frank-pillar-desc">{pillar.description}</p>
            <ul className="frank-pillar-points">
              {pillar.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FrankApproach() {
  const { approach } = frankData;
  return (
    <section className="frank-section frank-approach" id="approccio" aria-labelledby="approccio-title">
      <div className="frank-approach-grid">
        <div className="frank-approach-visual" aria-hidden="true">
          <div className="frank-triad">
            <div className="frank-triad-ring frank-triad-ring-1">
              <span>PERSONA</span>
            </div>
            <div className="frank-triad-ring frank-triad-ring-2">
              <span>IMPRESA</span>
            </div>
            <div className="frank-triad-ring frank-triad-ring-3">
              <span>PATRIMONIO</span>
            </div>
            <div className="frank-triad-core">
              <i aria-hidden="true" />
              <strong>VISIONE<br />STRATEGICA</strong>
            </div>
          </div>
        </div>

        <div className="frank-approach-copy">
          <p className="frank-kicker">{approach.kicker}</p>
          <h2 id="approccio-title">{approach.title}</h2>
          <p className="frank-approach-lead">{approach.lead}</p>

          <div className="frank-steps-list">
            {approach.steps.map((step) => (
              <div className="frank-step-row" key={step.number}>
                <span className="frank-step-num">{step.number}</span>
                <div className="frank-step-content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FrankRadar() {
  const { radar } = frankData;
  return (
    <section className="frank-section frank-radar-section" id="radar" aria-labelledby="radar-section-title">
      <div className="frank-radar-box">
        <div className="frank-radar-header">
          <p className="frank-kicker">{radar.kicker}</p>
          <h2 id="radar-section-title">{radar.title}</h2>
          <p className="frank-radar-lead">{radar.lead}</p>
        </div>

        <ul className="frank-radar-points">
          {radar.points.map((point, i) => (
            <li className="frank-radar-point" key={i}>
              <span className="frank-radar-point-bullet" aria-hidden="true">✦</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="frank-radar-actions">
          <a
            className="frank-btn frank-btn-primary"
            href={radar.radarUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Inizia il Radar d’Impresa su Horyzon Hub"
          >
            {radar.ctaPrimary} <span aria-hidden="true">↗</span>
          </a>
          <a
            className="frank-btn frank-btn-ghost"
            href={frankData.person.emailDebriefUrl}
            aria-label="Richiedi il debrief del Radar con Frank Cannoletta via email"
          >
            {radar.ctaSecondary} <span aria-hidden="true">↗</span>
          </a>
        </div>

        <p className="frank-radar-fineprint">{radar.finePrint}</p>
      </div>
    </section>
  );
}

export function FrankCapabilities() {
  const { capabilities } = frankData;
  return (
    <section className="frank-section frank-capabilities-section" id="competenze" aria-labelledby="competenze-title">
      <div className="frank-capabilities-header">
        <p className="frank-kicker">{capabilities.kicker}</p>
        <h2 id="competenze-title">{capabilities.title}</h2>
        <p className="frank-profile-body">{capabilities.intro}</p>
      </div>

      <div className="frank-capabilities-list">
        {capabilities.items.map((item) => (
          <article className="frank-capability-row" key={item.number}>
            <span className="frank-capability-num">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FrankExperience() {
  const { experience } = frankData;
  return (
    <section className="frank-section frank-experience-section" id="esperienza" aria-labelledby="esperienza-title">
      <div className="frank-experience-grid">
        <div className="frank-experience-sticky">
          <p className="frank-kicker">{experience.kicker}</p>
          <h2 id="esperienza-title">{experience.title}</h2>
          <p className="frank-experience-intro">{experience.intro}</p>
        </div>

        <div className="frank-experience-timeline">
          {experience.items.map((item) => (
            <article className="frank-experience-item" key={item.tag}>
              <span className="frank-experience-tag">{item.tag}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FrankContact() {
  const { contact, person } = frankData;
  return (
    <section className="frank-section frank-contact-section" id="contatti" aria-labelledby="contatti-title">
      <div className="frank-contact-panel">
        <div>
          <p className="frank-kicker">{contact.kicker}</p>
          <h2 id="contatti-title">{contact.title}</h2>
          <p className="frank-contact-lead">{contact.lead}</p>
        </div>

        <div className="frank-contact-channels">
          <a
            className="frank-channel-btn frank-channel-btn-primary"
            href={person.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Invia un messaggio WhatsApp a Frank Cannoletta al numero ${person.phone}`}
          >
            <div className="frank-channel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
                <path d="M8.7 8.3c.4 2.4 2.3 4.3 4.7 4.8" />
              </svg>
            </div>
            <div className="frank-channel-info">
              <span className="frank-channel-label">WHATSAPP</span>
              <span className="frank-channel-val">{person.phone}</span>
            </div>
            <span className="frank-channel-arrow" aria-hidden="true">↗</span>
          </a>

          <a
            className="frank-channel-btn"
            href={person.emailConsultationUrl}
            aria-label={`Invia un'email a Frank Cannoletta all'indirizzo ${person.email}`}
          >
            <div className="frank-channel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 5h18v14H3z" />
                <path d="m3 6 9 7 9-7" />
              </svg>
            </div>
            <div className="frank-channel-info">
              <span className="frank-channel-label">EMAIL</span>
              <span className="frank-channel-val">{person.email}</span>
            </div>
            <span className="frank-channel-arrow" aria-hidden="true">↗</span>
          </a>

          <a
            className="frank-channel-btn"
            href={person.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Profilo Instagram di Frank Cannoletta"
          >
            <div className="frank-channel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="frank-channel-info">
              <span className="frank-channel-label">INSTAGRAM</span>
              <span className="frank-channel-val">{person.instagram}</span>
            </div>
            <span className="frank-channel-arrow" aria-hidden="true">↗</span>
          </a>

          <Link
            className="frank-channel-btn"
            href="/v/frank"
            aria-label="Apri il biglietto da visita digitale di Frank Cannoletta"
          >
            <div className="frank-channel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M15 8h2M15 12h2M7 16h10" />
              </svg>
            </div>
            <div className="frank-channel-info">
              <span className="frank-channel-label">BIGLIETTO DIGITALE</span>
              <span className="frank-channel-val">Salva contatto in rubrica</span>
            </div>
            <span className="frank-channel-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FrankDisclaimer() {
  const { disclaimer } = frankData;
  return (
    <section className="frank-disclaimer-section" aria-label="Avvertenze professionali">
      <div className="frank-disclaimer-inner">
        <p className="frank-disclaimer-text">
          <strong>{disclaimer.title}.</strong> {disclaimer.text}
        </p>
        <a className="frank-back-top" href="#content">
          Torna all’inizio ↑
        </a>
      </div>
    </section>
  );
}
