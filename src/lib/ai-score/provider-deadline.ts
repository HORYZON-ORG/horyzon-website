import { AuditDeadlineError } from './deadline';
/** Keep technical evidence when an optional provider fails or stalls. */
export async function providerWithin<T>(run:(signal:AbortSignal)=>Promise<T>,fallback:()=>Promise<T>,signal:AbortSignal|undefined,timeoutMs:number):Promise<T> {
  const controller=new AbortController();
  const combined=AbortSignal.any([controller.signal,...(signal?[signal]:[])]);
  let timer:ReturnType<typeof setTimeout>|undefined,grace:ReturnType<typeof setTimeout>|undefined;
  const guarded=new Promise<T>(resolve=>{
    timer=setTimeout(()=>{
      controller.abort(new AuditDeadlineError());
      // Give the cancellable adapter one turn to retain completed observations.
      grace=setTimeout(()=>{void fallback().then(resolve);},25);
    },timeoutMs);
  });
  try {return await Promise.race([run(combined).catch(fallback),guarded]);}
  finally {if(timer)clearTimeout(timer);if(grace)clearTimeout(grace);}
}
