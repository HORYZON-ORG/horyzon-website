# Annunci 10x data contracts v2

Status: conceptual data contract. No SQL in this phase.

## Current boundary

This document does not add migrations, tables, columns, indexes, policies, storage buckets, cron jobs, email providers, or CRM integrations.

It defines future data needs only.

## Versioning

Future durable objects should carry explicit versions:

- `methodVersion`
- `rubricVersion`
- `scoreSemanticsVersion`
- `promptVersion`
- `dataContractVersion`
- `commercialVersion`
- `createdAt`

Recommended V2 labels:

- `annunci10x-method-v2`
- `annunci10x-rubric-v2`
- `annunci10x-score-semantics-v2`
- `annunci10x-data-contracts-v2`
- `annunci10x-commercial-v2`

## Source input

Future analysis needs to preserve:

- source kind: `PUBLIC_URL` or `PASTED_TEXT`;
- original source URL when provided;
- fetched/extracted source text when legally and technically allowed;
- pasted source text;
- immutable analyzed target text;
- source retrieval status;
- retrieval errors;
- timestamp.

Original target text must remain immutable for original-ad score.

## Contact identity

Future contact data:

- name;
- surname;
- company;
- business role;
- company email;
- email verification status;
- marketing consent status and timestamp;
- operational report delivery consent/context.

Email verification and marketing consent are distinct.

## Role reality facts

V2 needs normalized facts aligned to the ten sheet areas:

1. role identity;
2. primary result;
3. real activities;
4. indispensable requirements;
5. preferred requirements;
6. trainable requirements;
7. context;
8. conditions;
9. offer;
10. application.

Facts should preserve provenance:

- extracted from target;
- declared by user;
- inferred by system;
- confirmed by user.

System-inferred facts must not become publishable claims without confirmation when sensitive or material.

## Candidature data

Future data model should make candidature first-class:

- publication channel;
- destination type;
- destination address/URL;
- subject instructions when relevant;
- destination verification status;
- application instructions;
- expected next step, if provided.

This supports V2 control 20 and publication gates.

## Score data

Future V2 score records should store:

- target kind;
- target version/reference;
- 20 control evaluations;
- per-control numeric value `0..10` or `null`;
- status;
- evidence snippets or structured evidence references;
- reason;
- unsupported-claim flags;
- coverage;
- score interval when coverage is incomplete;
- final normalized score;
- band;
- gate status;
- gate reasons.

The provider request/response should not be the source of final score.

## Report data

Future report records can store:

- report kind: free summary, private web report, email report;
- recipient;
- delivery status;
- email verification requirement;
- generated structured sections;
- CTA state;
- resend/audit metadata.

Raw prompt, raw chain-of-thought, and secrets must not be stored.

## Commercial data

Future commercial data should separate:

- catalog product;
- checkout session;
- payment event;
- entitlement;
- delivery;
- CRM sync.

Payment is the source of truth for entitlements. CRM contact records are not sufficient proof of entitlement.

## Premium Guide delivery

Future delivery needs private storage or protected access:

- signed URL;
- auth-gated download;
- account library;
- email link to protected route.

The public repository must not be the distribution channel for the Premium Guide.

## Migration categories

Future migration may require:

- additive tables/columns for source input and contact identity;
- additive score schema for V2 controls;
- additive entitlement/payment tables or integration tables;
- private storage configuration;
- email report delivery state;
- CRM sync audit tables;
- data retention and consent metadata.

No migration is authorized by this document.
