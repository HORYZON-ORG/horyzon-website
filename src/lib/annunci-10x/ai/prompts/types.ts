import type { AiOperationType } from '../../types.ts';
import type { Annunci10xJsonSchema } from '../schemas.ts';

export interface Annunci10xPromptDefinition {
  id: string;
  version: string;
  operationType: AiOperationType;
  outputSchema: Annunci10xJsonSchema;
  instructions: string;
  invariants: readonly string[];
}
