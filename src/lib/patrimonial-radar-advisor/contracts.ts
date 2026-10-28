import type { AnswerRef, AnswerRevision, AssessmentInput, CanonicalResult, QuestionId } from '../patrimonial-radar/types.ts';
import type { Snapshot } from '../patrimonial-radar-server/contracts.ts';
export interface AdvisorSource { personId:string; assessmentId:string; snapshot:Snapshot; approvedInput:AssessmentInput }
export interface AgendaItem { id:string; kind:'HYPOTHESIS_TO_VERIFY'; question:string; basis:string; sourceRule:string; refs:AnswerRef[]; evidenceIds:string[]; indicatorIds:string[]; goalIds:string[] }
export interface AdvisorReading { title:string; basis:'DECLARED'|'CANONICAL_CALCULATION'|'UNAVAILABLE'|'DECLARED_AND_CANONICAL'; texts:string[]; questionIds:QuestionId[]; indicatorIds:string[] }
/** Concrete server allowlist. The older domain projection interface remains conceptual. */
export interface AdvisorResultProjection {
  projectionVersion:'RP-ADVISOR-4D1-1';
  general:{ personId:string; assessmentId:string; snapshotId:string; approvedRevision:number; completedAt:string; status:'COMPLETED'; versions:CanonicalResult['versions']; periods:CanonicalResult['periods']; scope:CanonicalResult['scope']; scopeCoverage:string|null; origin:'NOT_VERIFIED'; identity:'PERSON_UUID_ONLY'; assignment:'NOT_CONNECTED'; completeness:CanonicalResult['completeness']; quality:CanonicalResult['quality'] };
  areas:CanonicalResult['areas']; indicators:CanonicalResult['indicators']; evidence:CanonicalResult['evidence']; favorable:string[]; vulnerabilities:string[]; priorities:string[];
  profiles:CanonicalResult['profiles']; goals:CanonicalResult['goals']; incoherences:CanonicalResult['incoherences']; current:CanonicalResult['answers'];
  answers:{ record:AnswerRevision; lifecycle:'ACTIVE'|'INACTIVE'|'RECONFIRM'; disposition:'CURRENT'|'SUPERSEDED'; applicability:string; issues:string[]; contribution:'CURRENT_ACTIVE'|'SUPERSEDED'|'INACTIVE'|'RECONFIRM'|'UNAVAILABLE' }[];
  reading:AdvisorReading[]; agenda:AgendaItem[];
  futureComparison:{status:'NOT_IMPLEMENTED';catalogVersion:null;recommendations:never[];goalIds:string[];constraintIds:string[];requiredInputs:string[]};
}
