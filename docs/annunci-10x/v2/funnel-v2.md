# Annunci 10x funnel v2

Status: future product and UX specification. Not implemented.

## Entry principle

The V2 funnel starts from the customer's recruiting pain, not from internal persona segmentation.

The user should not first be forced to identify as imprenditore, HR, recruiter, or consultant. The product should meet the problem:

- few suitable candidates;
- many irrelevant CVs;
- replacing a wrong person is risky;
- growth is blocked by hiring difficulty;
- bad hires create costs and delays;
- the company depends on collaborators who no longer fit the role.

Directional entry concept:

> Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?

This is not final copy.

## Analyze path

Future conceptual flow:

1. `SOURCE`
2. `ANALYSIS STARTS`
3. `CONTACT DATA`
4. `EMAIL VERIFICATION`
5. `RESULT`

The analysis should start as soon as the ad is available. The product can collect contact data while processing, instead of waiting until after all analysis is complete.

## Source input

Supported future source types:

- public ad link;
- pasted ad text.

The product must preserve the evaluated source separately from later user clarifications. Clarifications can improve future recommendations or generated output, but they must not retroactively improve the immutable original-ad score.

## Contact data

Future minimum contact data:

- name;
- surname;
- company;
- business role;
- company email.

Email verification is required for the free analyze funnel.

The score and report must not be delivered until:

- `analysis_run` is `READY`;
- email is `VERIFIED`.

Marketing consent must be separate from operational email/report delivery.

## Free result

The free result should expose a focused result:

- score `/100`;
- score band;
- short explanation of what the band means;
- contextual CTA.

Additional teasers such as strongest signal, main weak area, or extra diagnostic previews are deferred UX decisions for a future landing phase.

The free result should not expose every diagnostic detail if the product uses a private report or email report for that.

## Detailed report

Future detailed report can be:

- dynamic email report;
- private web report;
- both, if justified.

PDF is not an MVP requirement for the free result.

The detailed report can contain:

- customer name;
- company;
- role;
- score;
- band;
- band interpretation;
- strengths;
- partial controls;
- weak controls;
- missing controls;
- not-evaluable controls;
- evidence reasons;
- CTAs.

The software controls report structure. LLM text can explain within that structure, but must not invent facts or decide final score, coverage, band, or gate.

## Paid transitions

After the free analysis, CTAs can lead to:

- Rewrite existing ad for EUR 7 per version/platform.
- Create new ad for EUR 9.
- Agent Recruiter / Premium Guide for EUR 49.

The product must not unlock paid generation before server-side payment verification.

## Future create path

Create from zero should use a staged wizard:

1. Ruolo + risultato.
2. Lavoro reale / attivita / contesto.
3. Persona necessaria / requisiti.
4. Condizioni + offerta.
5. Canale + candidatura.

Each step can be pre-processed in background after completion.

## Commercial profiling after purchase

After purchase, especially for Agent Recruiter / Premium Guide, the product can ask:

- sector;
- company size;
- hiring frequency;
- main recruiting problem;
- whether the user wants to be contacted by Horyzon Recruiting.

Phone number should not be mandatory. It should be requested only if the user asks to be contacted or explicitly consents to contact.

## CRM boundary

HighLevel can be used in future for CRM and nurturing. It must not be treated as entitlement source merely because it is connected or contains a contact.
