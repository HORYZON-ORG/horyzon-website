# Annunci 10x product contract v2

Status: product specification only. Not implemented.

## Product identity

Annunci 10x helps a company understand and improve a job ad by first clarifying the real work, the necessary person, the communication strategy, the ad itself, and the verification criteria.

The product is not a generic copywriting generator. It is a role-reality and evidence-led job ad method.

## Canonical route

Canonical future route remains:

- `/annunci-10x`

Legacy route:

- `/annuncio-10x`

The legacy route is a separate prototype and must not be modified, renamed, redirected, deleted, or reused without explicit authorization.

## Current public exposure constraint

Until explicit authorization changes this:

- `/annunci-10x` remains reachable only by direct URL.
- It must not be linked from home, header, footer, or other public navigation.
- It must remain excluded from sitemap.
- It must remain `noindex,nofollow`.
- It must preserve `X-Robots-Tag: noindex,nofollow` where already configured.

## Product modes

### Analyze existing ad

Input can be:

- public ad URL, future;
- pasted ad text, current/future.

The product analyzes the visible ad source. User context can support clarification and future generation, but original-ad score must remain based on the evaluated ad target.

### Rewrite existing ad

Future paid capability.

The product produces a rewritten version or channel version of an existing ad after entitlement verification.

### Create from zero

Future paid capability.

The product builds a new ad from structured role reality. It should use a staged wizard, not a monolithic form.

### Agent Recruiter / Premium Guide

Future paid product at EUR 49.

It is not just a PDF. It can include:

- Premium Guide.
- Machine-readable method markdown.
- setup instructions for using the method with ChatGPT, Claude, or a generic LLM.
- operational prompts or templates faithful to the method.

## Non-goals for this phase

This V2 documentation phase does not:

- change TypeScript runtime;
- change UI;
- change API routes;
- change score calculation;
- change prompts;
- change Supabase schema;
- add migrations;
- configure checkout;
- connect HighLevel;
- send emails;
- change Vercel configuration;
- run OpenAI live calls;
- change AI Score;
- change the legacy `/annuncio-10x` prototype.

## Authority and proof stack

Future product copy can draw on:

- Performia methodology.
- Multi-year recruiting experience.
- International presence.
- Horyzon Recruiting operating experience.
- AI technologies.

This specification does not invent protected claims, testimonials, logos, guarantees, or third-party assets. Future public copy needs a proof checklist before publication.

## Claim safety

The product must avoid:

- guaranteed hiring outcomes;
- guaranteed candidate volume;
- "10x" as a measurable multiplier;
- unsupported claims about Horyzon, Performia, or the customer company;
- unsupported benefit claims in generated ads.

The product may explain that clarity and relevance can improve the quality of applications, but the claim must remain evidence-aware.

## Runtime compatibility expectation

Future V2 architecture must continue to work with explicit provider selection:

- `MOCK` for deterministic development/test.
- `OPENAI` for live AI when configured and funded.

There must be no silent fallback from OpenAI to mock. If OpenAI is configured and fails, the user must receive a controlled error.
