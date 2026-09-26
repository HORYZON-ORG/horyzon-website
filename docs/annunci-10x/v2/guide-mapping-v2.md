# Annunci 10x guide mapping v2

Status: mapping document. Not an implementation.

## Purpose

This document maps the V2 guide controls and operational sheet to the current runtime. It identifies what can be reused, what needs wording changes, and what needs future semantic migration.

Current runtime files inspected:

- `src/lib/annunci-10x/rubric.ts`
- `src/lib/annunci-10x/score.ts`
- `src/lib/annunci-10x/gates.ts`
- `src/lib/annunci-10x/strategy-rules.ts`
- `src/lib/annunci-10x/create-flow.ts`
- `src/lib/annunci-10x/commercial.ts`
- `src/components/annunci-10x/annunci-10x-client.tsx`
- `src/lib/annunci-10x/ai/prompts/evaluate.ts`

Mapping states:

- `MATCH`: V2 and current runtime are materially aligned.
- `WORDING_UPDATE`: same underlying concept, but labels/copy should change.
- `SEMANTIC_UPDATE`: current runtime concept needs changed logic or evidence semantics.
- `PARTIAL_MATCH`: current runtime covers part of V2.
- `MISSING`: no adequate current runtime representation.
- `OBSOLETE`: current runtime concept should be removed or replaced.

## 20 controls mapping

| V2 ID | V2 control | Current runtime check | Dimension | State | Future change |
| --- | --- | --- | --- | --- | --- |
| 01 | Il titolo rende immediatamente riconoscibile il ruolo? | 01 Titolo chiaro, specifico e riconoscibile | ROLE_IDENTITY | WORDING_UPDATE | Keep logic. Align wording to "immediatamente riconoscibile". |
| 02 | Si capiscono livello, perimetro e responsabilita? | 02 Livello/perimetro del ruolo comprensibili | ROLE_IDENTITY | PARTIAL_MATCH | Add explicit responsibility coverage to anchors/evidence. |
| 03 | Le attivita quotidiane sono concrete? | 03 Attivita quotidiane concrete | WORK_AND_RESULTS | MATCH | Reuse. |
| 04 | E chiaro quale risultato deve produrre il ruolo? | 04 Contributo/risultato atteso osservabile | WORK_AND_RESULTS | WORDING_UPDATE | Keep observable-result rule. Align with V2 "risultato deve produrre il ruolo". |
| 05 | Si capiscono contesto, interlocutori e ambiente operativo? | 05 Contesto operativo, collaborazione e interlocutori | WORK_AND_RESULTS | WORDING_UPDATE | Add "ambiente operativo" wording and examples. |
| 06 | L'annuncio mette in evidenza le informazioni piu utili per questa ricerca? | 06 Enfasi coerente con popolarita ruolo/azienda | ROLE_ALIGNMENT | SEMANTIC_UPDATE | Replace generic popularity/company emphasis with role-specific search-priority evidence derived from four lenses. Preserve role popularity vs company attractiveness distinction. |
| 07 | Routine, imprevisti e sfide sono rappresentati fedelmente? | 07 Rappresentazione fedele challenge/routine | ROLE_ALIGNMENT | WORDING_UPDATE | Add "imprevisti" explicitly. |
| 08 | Impegno, responsabilita e condizioni impegnative sono visibili quando contano? | 08 Qualificazione e impegno rappresentati correttamente | ROLE_ALIGNMENT | SEMANTIC_UPDATE | Expand beyond qualification to material effort, responsibility, and demanding conditions when relevant. |
| 09 | Il livello tecnico del linguaggio e adatto al lavoro? | 09 Linguaggio, competenze e strumenti coerenti con tecnicita | ROLE_ALIGNMENT | WORDING_UPDATE | Preserve precision-over-jargon semantics. Align label. |
| 10 | Indispensabili, preferenziali e apprendibili sono distinti? | 10 Indispensabili distinti da preferenziali/apprendibili | REQUIREMENTS | MATCH | Reuse. |
| 11 | Ogni requisito e collegato a un'attivita, un risultato o una condizione reale? | 11 Requisiti pertinenti al lavoro reale | REQUIREMENTS | WORDING_UPDATE | Make evidence link explicit in anchors. |
| 12 | Sede e modalita di lavoro sono chiare? | 12 Sede/modalita di lavoro chiare | OFFER_AND_CONDITIONS | MATCH | Reuse. |
| 13 | Contratto, orari, turni e tempi sono sufficientemente chiari? | 13 Rapporto, orari, turni/tempi pertinenti | OFFER_AND_CONDITIONS | WORDING_UPDATE | Align "rapporto" to "contratto" and "sufficientemente chiari". |
| 14 | Il compenso e gestito con chiarezza quando e disponibile o necessario? | 14 Compenso/fascia chiari quando disponibili/applicabili | OFFER_AND_CONDITIONS | WORDING_UPDATE | Preserve N/D when not available/not necessary. Clarify "available or necessary". |
| 15 | Esistono ragioni concrete e verificabili per considerare l'offerta? | 15 Ragioni concrete e verificate per scegliere l'offerta | OFFER_AND_CONDITIONS | MATCH | Reuse with claim-check emphasis. |
| 16 | La struttura e adatta al canale in cui verra pubblicata? | 16 Struttura appropriata al canale/formato | CHANNEL_AND_FORMAT | WORDING_UPDATE | Align wording. |
| 17 | Testo, campi del portale e destinazione raccontano gli stessi fatti? | 17 Coerenza tra testo, campi e destinazione | CHANNEL_AND_FORMAT | MATCH | Reuse. |
| 18 | L'annuncio si legge e si scandisce facilmente? | 18 Gerarchia e scansione leggibili | READABILITY | WORDING_UPDATE | Align to readability/scannability. |
| 19 | Il linguaggio e concreto, preciso e privo di ripetizioni inutili? | 19 Linguaggio concreto, preciso, senza ripetizioni inutili | READABILITY | MATCH | Reuse. |
| 20 | Una persona sa esattamente come candidarsi? | 20 CTA e destinazione candidatura chiare | APPLICATION | WORDING_UPDATE | Keep destination requirement. Align with candidate certainty. |

## Summary of control fit

No V2 control is entirely missing from the current 20-check skeleton. The current runtime already has a useful 20-control structure.

The largest future changes are:

- Check 06: strategy priority must shift from "popularity/company emphasis" to "most useful information for this search".
- Check 08: must cover commitment, responsibility, and demanding conditions, not only qualification.
- Check 02: responsibilities must become first-class evidence.
- Score scale and anchors must migrate from V1 `PASS/PARTIAL/MISSING/CONFLICT/NOT_EVALUABLE` with 5-point checks to V2 provider-produced `0..10/null` per-control results with TypeScript aggregation.

## V2 sheet mapping to current Create flow

| V2 sheet area | Current create/runtime location | State | Notes |
| --- | --- | --- | --- |
| 1. Ruolo | `ROLE_CONTEXT`, `CreateDraft.role`, `RoleCard.title` | PARTIAL_MATCH | Role exists. Company context is currently adjacent and should remain separate from role identity in V2. |
| 2. Risultato principale | `PRIMARY_CONTRIBUTION`, `CreateDraft.primaryResult`, `RoleCard.mission` / outcomes | MATCH | Current flow already asks for primary result. |
| 3. Attivita reali | `WORK_REALITY`, responsibilities, activities, operating context | MATCH | Current flow covers activities and work reality. |
| 4. Indispensabili | `REQUIREMENTS.requiredRequirements` | MATCH | Current classifications support this. |
| 5. Preferenziali | `REQUIREMENTS.preferredRequirements` | MATCH | Current classifications support this. |
| 6. Apprendibili | `REQUIREMENTS.trainableRequirements` | MATCH | Current classifications support this. |
| 7. Contesto | `WORK_REALITY.operatingContext`, autonomy, incidents, collaboration context | PARTIAL_MATCH | Present but spread across work reality and attraction context. V2 should normalize it as its own sheet area. |
| 8. Condizioni | `OFFER`, location, work mode, contract, schedule, shifts, availability, compensation | MATCH | Current flow covers the main facts. |
| 9. Offerta | `ATTRACTION`, benefits, growth, attraction reasons | PARTIAL_MATCH | Current flow covers benefits/growth but V2 needs stronger claim-check and concrete-offer evidence. |
| 10. Candidatura | `CHANNEL_APPLICATION`, channel and application details | PARTIAL_MATCH | Present in flow, but future data model should preserve a normalized candidature destination and verification status. |

## Four lenses mapping

| V2 lens | Current runtime concept | State | Future change |
| --- | --- | --- | --- |
| Popolarita | `rolePopularity`, `demand`, `companyAttractiveness` in strategy/profile rules | PARTIAL_MATCH | Keep role popularity distinct from company attractiveness. Avoid collapsing into generic appeal. |
| Sfida / routine | `workReality`, challenge/routine semantics in strategy and rubric | MATCH | Add explicit "imprevisti" evidence. |
| Qualificazione | requirements classification and qualification signals | MATCH | Strengthen "why required on day one" evidence. |
| Tecnicita | `technicality`, technical language check | MATCH | Preserve precision-over-jargon rule. |

## Current EVALUATE prompt relationship

Current `annunci10x.evaluate.v3` already has useful V2-compatible boundaries:

- provider must not calculate final score `/100`, coverage, band, or gate;
- original-ad evidence must come from original target text;
- context cannot become score evidence unless present in the evaluated target;
- `MISSING` and `NOT_EVALUABLE` remain separate;
- unsupported or absent compensation, schedule, result, and CTA are treated conservatively.

Future V2 prompt changes should be narrow:

- update check wording;
- update check 06 semantics;
- update check 08 semantics;
- add responsibility evidence to check 02;
- add provider `0..10/null` per-control schema support only after deterministic calculator migration is ready.

## Technical reference verification

The mapping references were checked against current code during this revision:

- `CreateStepId` includes `ROLE_CONTEXT`, `PRIMARY_CONTRIBUTION`, `WORK_REALITY`, `REQUIREMENTS`, `ATTRACTION`, `OFFER`, and `CHANNEL_APPLICATION` in `src/components/annunci-10x/annunci-10x-client.tsx`.
- `CreateDraft` uses `primaryResult`, not `primaryContribution`.
- `composeCreateAnswers` maps `PRIMARY_CONTRIBUTION` from `primaryResult`.
- `src/lib/annunci-10x/create-flow.ts` uses the same create step IDs and maps them to persisted interview steps.
- `StrategyRuleInput` includes `rolePopularity`, `demand`, `workReality`, `qualification`, `technicality`, `companyAttractiveness`, and `offerStrength` in `src/lib/annunci-10x/strategy-rules.ts`.
- `RoleCard` and `RoleProfile` remain the current runtime domain names in `src/lib/annunci-10x/types.ts`.

## V1 docs and assets disposition

Historical V1/V1.1 files remain in place:

- `docs/annunci-10x/method-v1.md`
- `docs/annunci-10x/product-contract-v1.md`
- `docs/annunci-10x/score-semantics-v1.md`
- `docs/annunci-10x/ux-contract-v1.md`
- `docs/annunci-10x/data-contracts-v1.md`
- `docs/annunci-10x/prompt-pack-v1.md`
- `docs/annunci-10x/guide/**`
- `docs/annunci-10x/live-validation/**`

Future migration can mark them historical in index pages, but should not delete them without explicit authorization.
