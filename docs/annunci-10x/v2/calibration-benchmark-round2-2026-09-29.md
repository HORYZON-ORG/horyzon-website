# Annunci 10x calibration benchmark - round 2 - 2026-09-29

Status: manual unseen-ad calibration reference. Not statistical ground truth and not production validation.

## Sample

Four public ads not used in the first calibration:

| Case | Original | Rewritten | Gate |
| --- | ---: | ---: | --- |
| Quality Inspector Oil & Gas | 71 | 86 | OK |
| Payroll Specialist | 47 | 69 | BLOCKED: location conflict |
| Administrative Employee | 56 | 79 | OK |
| Electrical Maintenance Technician | 79 | 93 | OK |

Average: 63 -> 82.

## What worked

1. Score discrimination improved. Strong originals were not artificially crushed: Maintenance remained 79 and Quality Inspector 71. Weak/ambiguous originals fell materially lower.
2. Material conflicts mattered. Payroll fell to 47 and remained blocked because Gussago/Brescia was inconsistent.
3. Role reality became easier to picture. Quality and Maintenance outputs connected technical actions to responsibility and result instead of only expanding bullet lists.
4. Soft skills gained work-based meaning. Precision, communication, problem solving, and urgency were more useful when tied to concrete tasks.
5. Conditions stayed visible. Salary, contract, schedule, location, and mobility remained easy to find instead of being buried in narrative prose.

## Remaining weaknesses

### Audit/source voice leaked into candidate-facing copy

Patterns included "l'annuncio richiede", "il testo precisa", "la pagina classifica", "dato da chiarire", and explanations of internal publication decisions.

Decision: public copy must never describe its source document, scoring, validation, missing-data analysis, or publication readiness.

### Unresolved facts were explained publicly

The Payroll draft correctly noticed the Gussago/Brescia conflict, but a final candidate-facing ad should not contain the internal conflict analysis.

Decision: contradictory/unconfirmed facts are omitted from the Master and handled by clarification, validation, and publication gate. The generator must never choose a side.

### Repeated template transitions remained visible

Recurring constructions such as "Questo significa che", "Una parte del lavoro", "Non si tratta soltanto", and "Il ruolo non riguarda soltanto" can make different roles sound like the same template.

Decision: every paragraph must add a distinct sourced fact or relationship. Template transitions must be replaced by role-specific language or removed.

### Too many small sections can fragment reading

Decision: use the smallest useful section set, normally 4-8 sections, and merge adjacent sections that answer the same candidate question.

### Descriptive length must follow information richness

A longer ad is not automatically better. Payroll and Administrative roles expose the risk of padding when source facts are less relational than technical/maintenance roles.

Decision: length is selected from verified fact richness and decision complexity. LONG is forbidden as compensation for missing evidence.

## Implementation changes from round 2

- STRATEGY v2 chooses role-specific organizing structure and length from fact richness.
- GENERATE v3 is candidate-facing only, omits unresolved facts, requires every paragraph to earn its space, and avoids fixed headings/template transitions.
- VALIDATE v2 validates factual fidelity and editorial quality, including source/meta voice, repetition, filler, list-only fallback, and public conflict commentary.
- REVISE v2 removes audit/source language, consolidates repetition, and removes unresolved public claims instead of choosing a value.
- V2 Check 19 now explicitly penalizes source-document commentary and internal audit language.

## Invariant

> Prima la realta del ruolo. Poi le parole.

More descriptive must never mean more invented.
