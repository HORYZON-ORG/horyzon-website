# Annunci 10x output contract V3

Status: runtime contract for generated Master output.

## Principle

The Annunci 10x Master is a publishable job ad. It is not a RoleCard dump, report, audit, rubric, or internal reasoning artifact.

The pipeline distinguishes:

1. Facts: user-declared, confirmed, publishable information.
2. Intelligence: internal interpretation of the role and communication risk.
3. Attraction strategy: why the right candidate should consider the role and how to communicate that, using only supported facts.
4. Copy: the final candidate-facing ad.

## Master must

- read like a competent recruiter/copywriter wrote it;
- explain quickly what the role is;
- show what the person will really do;
- speak to the candidate when useful;
- make concrete attraction angles visible only when supported;
- preserve critical facts;
- keep conditions easy to find;
- distinguish required, preferred and learnable requirements in natural language;
- use a structure suited to the role, not a fixed template;
- be scannable;
- end with a usable, natural CTA when application instructions exist.

## Master must not show

- `Vincoli`;
- negative constraints;
- internal instructions;
- `Non dichiarato`;
- `Non disponibile`;
- missing fields;
- factual-preservation controls;
- object names such as RoleCard;
- source fact ids;
- confidence;
- reasoning;
- score or rubric;
- `Apprendibili` as a technical category;
- `Autonomia:` as a RoleCard dump;
- `Imprevisti e variabilita:` as a RoleCard dump;
- benefits, salary, contract, level, tools or employer claims not present in the facts.

If a non-essential datum is absent, omit it. Do not announce its absence.

## Strategy V3 expectations

Strategy should identify:

- target candidate;
- main attraction angles;
- evidence supporting each angle;
- facts that must appear;
- facts that must not be invented;
- tone and density;
- useful optional sections;
- unsuitable claims.

Each attraction angle must be traceable to real facts.

## Generate V3 expectations

GENERATE writes. It does not render field names.

It may:

- combine related facts into a sentence;
- reorder information;
- omit irrelevant missing fields;
- adapt headings to the role;
- convert activities into operational prose;
- convert requirements into an understandable candidate profile;
- use bullets only when they improve scanning.

It may not invent chronology, frequency, causality, benefits, salary detail, contract detail, seniority, employer branding, or career promises.

## Validation V3

Publication readiness requires two kinds of validation.

### Factual quality

The Master must continue to block:

- unsupported claims;
- contradictions;
- omitted critical facts;
- altered requirements;
- invented benefits;
- invented compensation;
- invented contract/schedule/work-mode details;
- invented technologies or tools;
- invented application instructions.

### Editorial/recruiting quality

The Master must also block or require revision for:

- structural dumps;
- database-like language;
- internal placeholders;
- source/audit voice;
- repetition;
- generic filler;
- bureaucratic phrasing;
- weak candidate orientation;
- text that lists facts without turning them into communication.

A factual PASS with editorial FAIL is not READY.

## Gate V3

READY requires:

- final validation PASS;
- factual preservation PASS;
- editorial/recruiting quality PASS;
- no unsupported claims;
- no contradictions;
- no critical omissions;
- no altered requirements;
- no leakage of internal structure;
- P1 = 0.

Score can support diagnosis, but score alone cannot make the output READY.
