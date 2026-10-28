// Explicit test runner preload. Never imported by application code.
if (process.env.RADAR_SYNTHETIC_LOCAL_ONLY !== '5b1' || process.env.VERCEL) throw Error('Synthetic runner only');
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(u.origin==='https://services.leadconnectorhq.com') {
    return original('http://127.0.0.1:15444/synthetic-crm'+u.pathname,init);
  }
  if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)) throw Error('Local pilot forbids external fetch');
  return original(input,init);
};
