import { cookies } from 'next/headers';
import { createRadarCommerce } from '@/lib/radar';
import { RADAR_PREVIEW_COOKIE, createService, getSessionCookie } from './_shared';

// Result, report and PDF share one gate: free access (the default), a purchase for this assessment, or a valid preview grant.
export async function authorizedRadarReport() {
  const session = await getSessionCookie();
  const store = await cookies();
  const previewToken = store.get(RADAR_PREVIEW_COOKIE)?.value ?? '';
  const service = createService();
  const result = service.freeAccess
    ? await service.readFreeResult(session.assessmentId, session.ownerSecret)
    : await createRadarCommerce().hasAccess(session.assessmentId)
      ? await service.readOwnedResult(session.assessmentId, session.ownerSecret)
      : await service.readPreviewResult(session.assessmentId, session.ownerSecret, previewToken);
  const { report, recipient } = await service.readReport(session.assessmentId, session.ownerSecret);
  return { service, assessmentId: session.assessmentId, result, report, recipient };
}
