import {RadarBackendError, type OtpDelivery, type TransactionalEmailProvider} from './contracts.ts';
import {normalizeEmail, validUuid} from './security.ts';

/** Transactional OTP only. No report, marketing, tracking pixel or recipient log.
 * A domain-scoped sending key must be provisioned separately; no ambient fallback. */
export class ResendRadarEmail implements TransactionalEmailProvider {
  readonly kind = 'RESEND' as const;
  private readonly key: string;
  private readonly from: string;
  private readonly replyTo: string;
  private readonly fetchImpl: typeof fetch;
  constructor(config: {key:string; from:string; replyTo:string; fetchImpl?:typeof fetch}) {
    if(typeof window!=='undefined'||!/^re_[A-Za-z0-9_\-]{12,}$/.test(config.key)) throw new RadarBackendError('UNAVAILABLE');
    this.key=config.key;
    this.from=normalizeEmail(config.from);
    this.replyTo=normalizeEmail(config.replyTo);
    if(!this.from.endsWith('@horyzon.it')||!this.replyTo.endsWith('@horyzon.it')) throw new RadarBackendError('UNAVAILABLE');
    this.fetchImpl=config.fetchImpl??fetch;
  }
  async sendCode(input:OtpDelivery):Promise<void> {
    if(!validUuid(input.challengeId)||!/^\d{8}$/.test(input.code)||input.expiresInSeconds!==600) throw new RadarBackendError('INVALID');
    const to=normalizeEmail(input.email);
    const body=JSON.stringify({
      from:'Horyzon Radar <'+this.from+'>',to:[to],reply_to:this.replyTo,
      subject:'Verifica la tua email per il Radar Patrimoniale',
      text:'Il tuo codice temporaneo per il Radar Patrimoniale è: '+input.code+'. Scade tra 10 minuti e può essere usato una sola volta. Non condividerlo. Se non hai richiesto il codice, ignora questa email. Per assistenza rispondi a questo messaggio.',
    });
    const headers={Authorization:'Bearer '+this.key,'Content-Type':'application/json','Idempotency-Key':'radar-otp:'+input.challengeId};
    // At most one bounded transient retry, same challenge/body/key. Never queue a
    // plaintext OTP or retry after the challenge TTL. Permanent errors fail closed.
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await this.fetchImpl('https://api.resend.com/emails',{method:'POST',headers,body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
        if(r.ok){await r.body?.cancel();return;}
        const retry=r.status===429||r.status>=500;await r.body?.cancel();
        if(!retry||attempt===1)throw new RadarBackendError('UNAVAILABLE');
      }catch(e){if(e instanceof RadarBackendError||attempt===1)throw new RadarBackendError('UNAVAILABLE');}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new RadarBackendError('UNAVAILABLE');
  }
}
