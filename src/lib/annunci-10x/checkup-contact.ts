import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { Annunci10xPublicError, type Annunci10xRuntimeContext, type Annunci10xSessionCookie } from './product-flow.ts';

export { CHECKUP_VERSION, CHECKUP_CALENDAR_URL, CHECKUP_INVITATION } from './checkup-copy.ts';

export interface CheckupContact {
  email: string;
  phone: string;
  phoneStatus: 'ENTERED';
  roleSought: string;
  difficulty: 'FEW_APPLICATIONS' | 'OFF_TARGET' | 'STALLED' | 'OTHER';
}

export function normalizeCheckupContact(input: Record<string, unknown>, email: string): CheckupContact {
  const raw = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (raw.length > 40 || !/^[+0-9().\s-]+$/.test(raw)) throw invalid('Indica un numero telefonico valido, con prefisso internazionale se estero.');
  const phone = parsePhoneNumberFromString(raw.replace(/^00/, '+'), 'IT');
  if (!phone?.isValid()) throw invalid('Indica un numero telefonico valido, con prefisso internazionale se estero.');
  const roleSought = typeof input.roleSought === 'string' ? input.roleSought.trim().replace(/\s+/g, ' ') : '';
  if (!roleSought || roleSought.length > 160) throw invalid('Indica il ruolo ricercato (massimo 160 caratteri).');
  const difficulty = input.difficulty;
  if (!['FEW_APPLICATIONS', 'OFF_TARGET', 'STALLED', 'OTHER'].includes(String(difficulty))) throw invalid('Indica la difficoltà principale della ricerca.');
  return { email, phone: phone.number, phoneStatus: 'ENTERED', roleSought, difficulty: difficulty as CheckupContact['difficulty'] };
}

export async function getCheckupContact(context: Annunci10xRuntimeContext, session: Annunci10xSessionCookie, runId: string): Promise<CheckupContact | null> {
  const answers = await context.persistence.getAnswers(session.sessionId, session.sessionSecret);
  const answer = answers.filter(a => a.questionId === `checkup-contact:${runId}`).at(-1);
  if (!answer) return null;
  try { return JSON.parse(answer.rawAnswer) as CheckupContact; } catch { return null; }
}
function invalid(message: string) { return new Annunci10xPublicError('INVALID_INPUT', message, 400); }
