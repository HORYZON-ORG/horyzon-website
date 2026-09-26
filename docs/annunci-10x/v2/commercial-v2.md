# Annunci 10x commercial v2

Status: commercial specification only. Checkout is not implemented.

## Value ladder

Decided V2 ladder:

| Product | Price | Notes |
| --- | ---: | --- |
| Score gratuito | EUR 0 | Public/free diagnostic entry. |
| Rewrite existing ad | EUR 7 | Per version/platform. |
| Create new ad | EUR 9 | New ad from structured role reality. |
| Agent Recruiter / Premium Guide | EUR 49 | Operating package, not just PDF. |

## Product definitions

### Free score

Includes:

- score `/100`;
- band;
- short interpretation;
- limited strengths/priorities;
- CTA.

Full diagnostics can be reserved for private report or paid path.

### Rewrite existing ad

Paid capability. Produces an improved version of an existing ad, or a channel-specific version.

It must preserve facts and avoid unsupported claims.

### Create new ad

Paid capability. Generates a new ad from a completed or sufficiently complete role reality flow.

Premium generation must not start before entitlement verification.

### Agent Recruiter / Premium Guide

Paid package at EUR 49.

Potential contents:

- `Annunci_10x_Guida_Premium.pdf`;
- machine-readable method markdown;
- `SETUP_AGENT_RECRUITER.md`;
- prompts/setup for ChatGPT;
- prompts/setup for Claude;
- generic LLM setup;
- practical operating instructions.

The method markdown must be faithful to the V2 method. It must not be an arbitrary summary.

## Entitlements

Future entitlements must be server-side.

The product should not trust:

- client-side product state;
- visible UI state;
- query parameters;
- HighLevel contact existence;
- local storage;
- unverifiable email claims.

Allowed entitlement sources may include:

- verified payment event;
- admin grant;
- test grant in non-production or controlled test context;
- bundle or upgrade rule computed server-side.

## Upgrade credit

Previous front-end purchase can become future upgrade credit only through a server-side rule.

The rule must be auditable and must not be inferred from UI history alone.

## HighLevel boundary

HighLevel can support:

- CRM record creation;
- nurturing;
- follow-up tasks;
- segmentation;
- commercial handoff.

HighLevel must not be entitlement authority just because a contact exists.

## Contact profiling after purchase

After purchase, the product can ask:

- sector;
- company size;
- hiring frequency;
- main recruiting problem;
- whether the user wants Horyzon Recruiting contact.

Phone is optional and should be tied to explicit contact request.

## Delivery boundary

Premium Guide delivery must be private.

Do not distribute paid guide files through:

- public repository paths;
- public static web assets;
- unauthenticated permanent URLs;
- sitemap-visible pages.

## Current runtime mismatch

Current `src/lib/annunci-10x/commercial.ts` has a V1 catalog with `OPEN_DECISION` pricing and purchase disabled.

That remains the current implementation state.

V2 pricing is now decided at specification level, but runtime must not be changed until the commercial implementation phase.
