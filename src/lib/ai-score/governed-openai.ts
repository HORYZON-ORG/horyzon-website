import { OpenAIWebSearchAdapter, mapOpenAIWebSearchFailureToRuntime, type OpenAIResponsesTransport, type OpenAIWebSearchFailureClass } from './openai-web-search.ts';
import { OPENAI_SEARCH_MODEL, openAIQueryReservation } from './openai-search-cost.ts';
import { abortable } from './deadline.ts';
import { getProviderRuntimeState } from './provider-runtime.ts';
import { createProviderRuntimeStore, readBudgetConfig, readRateLimitConfig, type ProviderRuntimeStore } from './runtime-store.ts';
import type { VisibilityExecutionContext, VisibilityObservation, VisibilityPrompt } from './types.ts';

/** Connect the existing adapter only through the already-approved public gates. */
export class GovernedOpenAIWebSearchAdapter extends OpenAIWebSearchAdapter {
  private readonly runtimeStore: ProviderRuntimeStore;
  private readonly env: Record<string,string|undefined>;
  private readonly auditLimits = new Map<string,Promise<boolean>>();
  private readonly queryReservation:number;
  constructor(options: { store?: ProviderRuntimeStore; transport?: OpenAIResponsesTransport; env?: Record<string,string|undefined> } = {}) {
    const store=options.store ?? createProviderRuntimeStore();
    const env=options.env ?? process.env;
    const model=env.AI_SCORE_OPENAI_RESPONSES_MODEL ?? OPENAI_SEARCH_MODEL;
    const queryReservation=openAIQueryReservation(model);
    const state=getProviderRuntimeState('openai_web_search',{usageStore:store,env,estimatedCostUsd:queryReservation});
    super({enabled:state.publicEnabled && Number.isFinite(queryReservation),apiKey:env.OPENAI_API_KEY ?? '',model,transport:options.transport});
    this.runtimeStore=store;this.env=env;
    this.queryReservation=queryReservation;
  }
  async execute(prompt:VisibilityPrompt,context:VisibilityExecutionContext):Promise<VisibilityObservation> {
    const blocked=(code:string):VisibilityObservation=>({id:`${context.auditId}:${prompt.id}:blocked`,auditId:context.auditId,promptId:prompt.id,providerId:this.id,surface:this.surface,engine:this.label,query:prompt.query,timestamp:new Date().toISOString(),status:'SKIPPED',brandMentioned:false,domainCited:false,citedUrls:[],sources:[],competitorsMentioned:[],evidence:'Misurazione non disponibile: protezione o servizio non pronto.',errorCode:code,provider:this.id,confidence:0});
    if(!this.enabled||!this.runtimeStore.persistent)return blocked('public_execution_disabled');
    try {
      context.signal?.throwIfAborted();
      const rate=readRateLimitConfig(this.env);
      if(!rate.hmacConfigured)return blocked('rate_limit_not_configured');
      let limits=this.auditLimits.get(context.auditId);
      if(!limits){
        if(this.auditLimits.size>=256)this.auditLimits.delete(this.auditLimits.keys().next().value!);
        limits=(async()=>{
          const domain=await this.runtimeStore.checkRateLimit({scope:'domain',rawIdentifier:context.entity.canonicalDomain,limit:rate.domain.limit,windowSeconds:rate.domain.windowSeconds});
          if(!domain.allowed)return false;
          if(context.clientKey){const client=await this.runtimeStore.checkRateLimit({scope:'client',rawIdentifier:context.clientKey,limit:rate.client.limit,windowSeconds:rate.client.windowSeconds});return client.allowed;}
          return true;
        })();this.auditLimits.set(context.auditId,limits);
      }
      if(!await abortable(limits,context.signal))return blocked('rate_limited');
      const circuit=await abortable(this.runtimeStore.getCircuitState('openai_web_search'),context.signal);
      if(circuit?.circuitState==='HALF_OPEN')return blocked('circuit_open');
      if(circuit?.circuitState==='OPEN'){
        const probe=await abortable(this.runtimeStore.tryHalfOpen('openai_web_search'),context.signal);
        if(probe?.circuitState!=='HALF_OPEN')return blocked('circuit_open');
      }
      const budget=readBudgetConfig('openai_web_search',this.env);
      if(budget.state!=='available')return blocked('budget_missing');
      context.signal?.throwIfAborted();
      const reservationAt=new Date();
      const reserved=await abortable(this.runtimeStore.reserveBudget({providerId:'openai_web_search',mode:'PUBLIC',at:reservationAt,estimatedCostUsd:this.queryReservation,estimatedRequests:1,estimatedObservations:1,providerDailyBudgetUsd:budget.providerDailyBudgetUsd,globalDailyBudgetUsd:budget.globalDailyBudgetUsd}),context.signal);
      if(!reserved.allowed)return blocked(reserved.reason??'budget_exhausted');
      if(context.signal?.aborted)return blocked('scan_cancelled');
      const observation=await super.execute(prompt,context);
      const success=observation.status==='SUCCESS'||observation.status==='PARTIAL';
      // The existing amount is an estimate, not a hard monetary cap. Retain
      // its reservation on ambiguous outcomes; never retry a reconciliation.
      if(context.signal?.aborted)return observation;
      try {
        await abortable(this.runtimeStore.reconcileBudget({providerId:'openai_web_search',mode:'PUBLIC',at:reservationAt,estimatedCostUsd:this.queryReservation,actualCostUsd:null,success}),context.signal);
        if(!context.signal?.aborted){
          if(success)await abortable(this.runtimeStore.recordProviderSuccess('openai_web_search'),context.signal);
          else await abortable(this.runtimeStore.recordProviderFailure('openai_web_search',{errorCode:observation.errorCode??'provider_failed',failureClass:mapOpenAIWebSearchFailureToRuntime(observation.failureClass as OpenAIWebSearchFailureClass)}),context.signal);
        }
      } catch {
        // Store bookkeeping failure cannot erase verified provider evidence.
        // An unresolved reservation stays charged by the existing RPC contract.
      }
      return observation;
    } catch {return blocked(context.signal?.aborted?'scan_cancelled':'runtime_unavailable');}
  }
}
