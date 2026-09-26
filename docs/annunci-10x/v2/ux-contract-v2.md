# Annunci 10x UX contract v2

Status: future UX contract. Not implemented.

## Public route visibility

Until explicit authorization changes it:

- `/annunci-10x` is reachable directly.
- `/annunci-10x` is not linked from home, header, footer, or public navigation.
- `/annunci-10x` is excluded from sitemap.
- `/annunci-10x` is `noindex,nofollow`.
- `X-Robots-Tag: noindex,nofollow` remains required where configured.

## UX principle

The interface should feel like a diagnostic product, not a generic AI writing tool.

The user should understand that the product is first clarifying role reality, then using that clarity to judge or generate an ad.

## Analyze UX

Future analyze flow:

1. User provides public link or pasted ad text.
2. Analysis starts immediately.
3. During processing, product collects contact data.
4. Email verification is required before free score/report delivery.
5. Result shows score, band, short meaning, and CTA.
6. Detailed diagnostics are delivered through private report or email.

The free score/report must not be delivered until the analysis is ready and email is verified.

The public result should avoid overwhelming the user with all internal checks.

## Result display

Free result should include:

- score `/100`;
- band;
- short plain-language interpretation;
- CTA to rewrite, create, or access Agent Recruiter / Premium Guide.

Additional teasers such as strongest signal, main weak area, strengths, priorities, or extra diagnostic previews are deferred UX decisions.

Full result can include:

- all 20 controls;
- evidence reasons;
- missing information;
- unsupported claims;
- N/D controls;
- gate warnings;
- suggested next steps.

## Create UX

Create from zero should be a wizard, not a single long form.

Recommended future steps:

1. Ruolo + risultato.
2. Lavoro reale / attivita / contesto.
3. Persona necessaria / requisiti.
4. Condizioni + offerta.
5. Canale + candidatura.

After each completed step, the product can pre-process facts in background. This should feel like progress, not like a separate AI task the user must manage.

## Paid generation UX

Premium generation must not begin before payment entitlement is verified server-side.

The UI can preview the value of paid outputs, but must not generate deliverables that should be paid.

## Premium Guide UX

The Premium Guide must not be exposed as a public static repo asset.

Future UX can deliver:

- private link;
- authenticated download;
- signed URL;
- account-based library;
- email with protected access link.

The product should make clear that Agent Recruiter / Premium Guide is an operating package, not just a file.

## Email/report UX

A future email report should be structured, not a raw AI dump.

It can include:

- customer and company identifiers;
- analyzed role;
- score and band;
- band explanation;
- strengths;
- partial or weak areas;
- missing areas;
- not-evaluable areas;
- evidence reasons;
- CTA.

The system owns structure. LLM text may fill short explanations inside controlled sections, but final score, coverage, band, and gate remain deterministic product outputs.

## Marketing consent UX

Operational email/report delivery and marketing consent are separate.

The user can receive the requested report without being forced into marketing consent, subject to final legal review.

## Language constraints

Avoid:

- "we guarantee more candidates";
- "10 times more CVs";
- "hire the right person guaranteed";
- "95+ means excellent hire";
- unsupported authority claims.

Prefer:

- clarity;
- evidence;
- quality of candidate fit;
- reduction of irrelevant applications;
- better decision basis.
