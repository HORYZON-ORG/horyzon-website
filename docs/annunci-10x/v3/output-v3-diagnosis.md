# Annunci 10x output V3 diagnosis

Status: diagnostic note for the CREATE -> premium generation output architecture.

## Root cause

The structural dump did not originate mainly in the GENERATE prompt. The prompt already asked for candidate-facing copy, but the TypeScript post-processing step `prepareMasterForValidation()` rebuilt the final Master from RoleCard fields after GENERATE.

That function kept only the generated TITLE and OPENING, then appended deterministic `confirmed-role-*` sections derived from RoleCard:

- mission;
- responsibilities;
- context;
- requirements;
- conditions;
- offer/growth;
- application.

Those sections used labels such as `Autonomia:`, `Imprevisti e variabilita:`, `Apprendibili:`, `Vincoli:`, `Turni:` and `Reperibilita:`. The result was factually useful, but it read like an internal data projection rather than a publishable job ad.

## Pipeline path

1. CREATE answers are normalized into a `RoleCard`.
2. PROFILE receives the RoleCard and returns role interpretation (`RoleProfile`).
3. STRATEGY receives RoleCard/Profile context and returns `CommunicationStrategy`, plus structure, levers and length metadata.
4. GENERATE receives `{ roleCard, roleProfile, communicationStrategy }` and returns `generatedAd`.
5. `prepareMasterForValidation()` previously replaced most generated sections with canonical RoleCard renderings.
6. VALIDATE checked that prepared Master against RoleCard facts and editorial issues.
7. REVISE could repair provider-reported issues, but it was working on a Master already shaped by canonical sections.
8. EVALUATE scored the prepared Master text; a structural dump could score well because it contained many facts.
9. CHANNEL_ADAPTER adapted the prepared Master, so it inherited the same internal structure.

## Why negative constraints and missing facts leaked

Some RoleCard fields are intelligence, anti-hallucination constraints, or missing-data markers. When RoleCard values were converted 1:1 into candidate-facing sections, values meant for internal control became visible output.

Examples:

- `Vincoli:` exposed anti-claims instead of candidate requirements.
- `Non dichiarato` and `Non disponibile` exposed missing-data analysis.
- `Apprendibili:` exposed a technical classification rather than candidate-friendly development copy.
- `Autonomia:` and `Imprevisti e variabilita:` exposed RoleCard labels rather than recruiter prose.

## Role of Strategy

STRATEGY already selects structure, levers, length and candidate angle. However, the previous post-processing made Strategy secondary: even if GENERATE followed Strategy, the canonical renderer reintroduced a fixed structure and database-like headings.

## Role of Revise

REVISE receives validation issues and can change sections, delete sections, or return revised sections. It can fix provider-visible editorial problems, but it cannot solve an architectural post-processing step that deterministically re-adds internal labels after generation.

## Role of Validate

VALIDATE checks factual safety and candidate-facing quality. It can flag editorial defects, but the deterministic pipeline must not depend only on provider judgment. A permissive validator or mock validator could return PASS while the Master still contained RoleCard labels.

## Why a structural dump can score high

EVALUATE sees many concrete facts in a structural dump: location, schedule, compensation, requirements, responsibilities, application instructions. The score can rise because factual coverage is high even when the text is not commercially publishable.

V3 therefore separates:

- factual preservation;
- editorial/recruiting quality;
- publication readiness.

A score alone cannot make the Master READY.
