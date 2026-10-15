import { NextResponse } from 'next/server';
import { validOwnerEconomicsAnswer } from '@/lib/radar/owner-economics';
import { POSITIONING_KEY, isPositioningAnswer } from '@/lib/radar/positioning';
import type { RadarAnswer } from '@/lib/radar/types';
import { RadarAccessError } from '@/lib/radar/service';
import { createService, errorResponse, getSessionCookie, readJson } from '../_shared';

export async function POST(request: Request) {
  try {
    const [cookie, body] = await Promise.all([getSessionCookie(), readJson(request)]);
    if (typeof body.answerKey !== 'string' || typeof body.expectedRevision !== 'number' || typeof body.currentStep !== 'number') throw new Error('Invalid Radar answer payload.');
    if (body.answerKey === POSITIONING_KEY ? !isPositioningAnswer(body.value) : !Array.isArray(body.value) && typeof body.value !== 'number') throw new RadarAccessError('Inserisci una risposta valida.', 400);
    if (body.answerKey.startsWith('economia#') && !validOwnerEconomicsAnswer(body.answerKey, body.value)) throw new RadarAccessError('Inserisci ore valide e un utile numerico.', 400);
    const progress = await createService().saveAnswer({ assessmentId: cookie.assessmentId, ownerSecret: cookie.ownerSecret, answerKey: body.answerKey, value: body.value as RadarAnswer, expectedRevision: body.expectedRevision, currentStep: body.currentStep });
    return NextResponse.json({ ok: true, progress });
  } catch (error) { return errorResponse(error); }
}
