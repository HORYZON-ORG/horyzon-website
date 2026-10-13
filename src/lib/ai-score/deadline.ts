export class AuditDeadlineError extends Error {
  constructor() { super('Tempo massimo di analisi raggiunto. Il sito non ha risposto in tempo: riprova tra poco.'); }
}
export function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) {void operation.catch(()=>undefined);return Promise.reject(signal.reason ?? new AuditDeadlineError());}
  return new Promise((resolve,reject) => {
    const aborted = () => reject(signal.reason ?? new AuditDeadlineError());
    signal.addEventListener('abort',aborted,{once:true});
    operation.then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
  });
}
