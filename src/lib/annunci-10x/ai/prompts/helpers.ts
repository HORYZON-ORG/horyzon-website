import { renderAnnunci10xCorePolicy } from './core-policy.ts';

export function renderPrompt(title: string, purpose: string, invariants: readonly string[]): string {
  return [
    renderAnnunci10xCorePolicy(),
    '',
    `Task: ${title}`,
    purpose,
    '',
    'Task invariants:',
    ...invariants.map((item) => `- ${item}`),
  ].join('\n');
}
