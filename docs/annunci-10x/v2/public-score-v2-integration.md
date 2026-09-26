# Annunci 10x V2.3 Public Score Integration

Status: implemented behind a server-side feature flag.

## Production readiness status

- CODE: READY
- DATABASE MIGRATION: APPLIED
- PRODUCTION FLAG: V1
- PUBLIC V2: NOT ENABLED
- AI PROVIDER FOR ACTIVATION: PENDING REAL PROVIDER VERIFICATION

V2 public activation remains blocked because production durable `AnalysisRun`
records have been observed with `provider = MOCK` and `evaluation_mode = V1`.
MOCK is a deterministic development/test mode and must not be treated as a
definitive customer-facing AI result.

## Feature flag

`ANNUNCI10X_PUBLIC_SCORE_VERSION` controls the public free-analysis score version.

- Missing or `V1`: the public route keeps the existing V1 evaluation flow.
- `V2`: the public route stores and exposes `V2_PUBLIC` evaluations.
- Any other value fails closed before analysis starts.

The flag is read server-side only. There is no client override and no automatic fallback from V2 to V1.

## Runtime boundary

V2 public analysis reuses the existing preprocessing stages:

- `PRECHECK`
- `EXTRACT`
- `PROFILE`
- `STRATEGY`

After the shared snapshot, `V2_PUBLIC` calls the V2.3 EVALUATE adapter and skips the V1 `CLARIFY` stage. V1 behavior remains unchanged.

The V2 adapter persists the same AI-operation contract used by the rest of Annunci 10x, with the V2.3 prompt version included in the idempotency key. Same session, snapshot, prompt version, model, and input identity reuse the stored operation.

## Score and gate semantics

V2 public score persists:

- deterministic aggregate calculated by `calculateAnnunci10xScoreV2`;
- V2 rubric version;
- V2 score semantics version;
- 20 V2 checks.

Provider-owned aggregate fields are not trusted. Persisted V2 scores are validated by recomputing the deterministic aggregate before storage and on read.

V2 public analysis does not expose or persist a V1 `PublicationGate`. The database `gates` JSONB stores an internal envelope:

```json
{ "status": "NOT_EVALUATED", "reason": "V2_SCORE_ONLY" }
```

Application code exposes `gate: null` for V2.

## Migration

`supabase/migrations/20260926203000_annunci10x_v2_public_score.sql` updates the `annunci10x_analysis_runs.evaluation_mode` check constraint to allow:

- `V1`
- `V2_SHADOW`
- `V2_PUBLIC`

The migration has been applied to the canonical Supabase production project
`horyzon` (`pmkyeqrfkunypfkbjnyg`). It only updates the analysis-run
`evaluation_mode` check constraint.

## Non-goals

This phase does not change:

- Annunci 10x landing copy, typography, hero, funnel UI, or create-from-zero UX;
- checkout, pricing, email provider, HighLevel, or Rizzo integrations;
- AI Score;
- legacy `/annuncio-10x`;
- OpenAI prompt/rubric/scoring semantics.

No live OpenAI calls are required for this integration.
