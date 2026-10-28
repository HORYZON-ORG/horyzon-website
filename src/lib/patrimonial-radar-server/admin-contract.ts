import {RadarBackendError} from './contracts.ts';
import {object,validUuid,revision} from './security.ts';
export const RADAR_ADMIN_CONTRACT='radar-admin-5b2-1';
/** Operator tool/server contract only. IDs/evidence never imply authority:
 * the signed provider session + explicit administrator registry authorize SQL. */
export function radarAdminCommand(raw:unknown){
  const c=object(raw,['method','id','requestId','evidenceRef','expectedRevision','contactRevision','state','userId','personId','permission','operatorId','expiresAt','emailKey','reason']);
  if(!validUuid(c.requestId)||typeof c.evidenceRef!=='string'||!/^[A-Za-z0-9:_-]{8,160}$/.test(c.evidenceRef))throw new RadarBackendError('INVALID');
  const keys:Record<string,string[]>={
    review_binding:['id','expectedRevision','contactRevision','state'],
    propose_binding:['id','personId'],
    quarantine_mailbox:['emailKey','reason'],
    grant_permission:['userId','permission','operatorId','expiresAt'],
    revoke_permission:['id','expectedRevision'],
  };
  const fields=keys[String(c.method)];if(!fields||Object.keys(c).some(k=>!['method','requestId','evidenceRef',...fields].includes(k)))throw new RadarBackendError('INVALID');
  for(const k of ['id','userId','personId'])if(fields.includes(k)&&!validUuid(c[k]))throw new RadarBackendError('INVALID');
  for(const k of ['expectedRevision','contactRevision'])if(fields.includes(k))revision(c[k]);
  if(c.method==='review_binding'&&!['VERIFIED','CONFLICT','REVOKED'].includes(String(c.state)))throw new RadarBackendError('INVALID');
  if(c.method==='quarantine_mailbox'&&(typeof c.emailKey!=='string'||!/^[a-f0-9]{64}$/.test(c.emailKey)||!['SHARED','COLLISION','EMAIL_CHANGE'].includes(String(c.reason))))throw new RadarBackendError('INVALID');
  if(c.method==='grant_permission'){
    if(!['RADAR_PATRIMONIAL_LIST','RADAR_PATRIMONIAL_PERSON','RADAR_PATRIMONIAL_ASSIGN','RADAR_PATRIMONIAL_ADVISOR'].includes(String(c.permission))
      ||typeof c.expiresAt!=='string'||!Number.isFinite(Date.parse(c.expiresAt)))throw new RadarBackendError('INVALID');
    if(c.permission==='RADAR_PATRIMONIAL_ADVISOR'?!validUuid(c.operatorId):c.operatorId!==undefined)throw new RadarBackendError('INVALID');
  }
  return {contract:RADAR_ADMIN_CONTRACT,...c};
}
