# Annunci 10x V2.3 Public Score Integration

Status: public runtime canonical.

## Production readiness status

- CODE: READY
- DATABASE MIGRATION: APPLIED
- PRODUCTION FLAG: V2, or unset with V2 default
- PUBLIC V2: ENABLED
- AI PROVIDER FOR ACTIVATION: OPENAI in production, MOCK only for explicit development/test contexts

V2 is now the canonical score path for public `/annunci-10x` analysis. New
public runs must resolve to `V2_PUBLIC`; a server environment value of `V1`
fails closed instead of silently falling back to the old runtime. Historical V1
records may still be read for compatibility, but they are not the public
default.

## Feature flag

`ANNUNCI10X_PUBLIC_SCORE_VERSION` is retained as a server-side guard for the
public free-analysis score version.

- Missing: the public route stores and exposes `V2_PUBLIC` evaluations.
- `V2`: the public route stores and exposes `V2_PUBLIC` evaluations.
- `V1` or any other value fails closed before analysis starts.

The flag is read server-side only. There is no client override and no automatic fallback from V2 to V1.

## Runtime boundary

V2 public analysis reuses the existing preprocessing stages:

- `PRECHECK`
- `EXTRACT`
- `PROFILE`
- `STRATEGY`

After the shared snapshot, `V2_PUBLIC` calls the V2 EVALUATE adapter and skips the V1 `CLARIFY` stage. V1 behavior remains available only for already-versioned historical compatibility paths.

Premium generation uses the same V2 EVALUATE adapter for generated Masters. The
comparison is therefore `ORIGINAL_AD` V2 -> `GENERATED_MASTER` V2 for new
Analyze sessions. Premium validation remains a separate publication gate; V2
evaluation rows are score-only and store the internal `V2_SCORE_ONLY` gate
envelope.

The V2 adapter persists the same AI-operation contract used by the rest of Annunci 10x, with the V2.3 prompt version included in the idempotency key. Same session, snapshot, prompt version, model, and input identity reuse the stored operation.

## Durable stage runner

The free-analysis `AnalysisRun` is advanced as a durable state machine. Each
runner invocation claims the run lease, executes at most one new provider
operation, persists its durable refs, advances `analysis_runs.stage`, releases
the lease, and returns. Polling or a later `after()` kick continues from the
next stage instead of replaying the whole pipeline.

Durable refs are stored in `analysis_runs.operation_refs`. They include AI
operation IDs for `PRECHECK`, `EXTRACT`, `PROFILE`, `STRATEGY`, `EVALUATE`,
and V1 `CLARIFY`, plus internal snapshot refs `ROLE_SNAPSHOT` and
`CONTEXT_SNAPSHOT`. These refs are not customer-facing API data.

Stage order differs by evaluation mode:

- V2_PUBLIC: `SOURCE_VALIDATION` -> `PRECHECK` -> `EXTRACT` -> `PROFILE` -> `STRATEGY` -> `EVALUATE` -> `COMPLETE`.

`ROLE_SNAPSHOT` is created once after `EXTRACT` and reused by `PROFILE` and
`STRATEGY`. `CONTEXT_SNAPSHOT` is created once after `STRATEGY` and reused by
`EVALUATE`. AI operation identities are derived from the stable
`AnalysisRun.input_identity`, stage, versions, and model, not from regenerated
snapshot UUIDs.

The lease remains the anti-concurrency authority. A second kick while one stage
is running cannot claim the run and therefore cannot start a duplicate provider
call. After a successful stage, the lease is cleared so the next poll can
advance the next stage quickly.

The POST and GET status routes that schedule `after()` work declare
`maxDuration = 120`, giving one provider operation enough room above the
default 90 second AI timeout for persistence and cleanup. `after()` is still
treated as finite Function work, not as an unbounded queue.

If an idempotent AI operation is found in `RUNNING` state from a previous
invocation, the runtime does not immediately call the provider again. A recent
`RUNNING` operation is treated as in progress and the run remains resumable.
If the operation is older than the provider timeout plus a grace margin, it is
failed closed with a retry-safe error policy instead of entering a cost loop.

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

`supabase/migrations/20260926203000_annunci10x_v2_public_score.sql` updates the `annunci10x_analysis_runs.evaluation_mode` check constraint to allow historical and current modes:

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
- legacy `/annuncio-10x`.

Live OpenAI evaluation remains governed by the configured production provider and the existing provider error policy.
