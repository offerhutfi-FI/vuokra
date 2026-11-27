window.OfferAPI = async function(body, signal) {
 const c=new AbortController(); const abort=()=>c.abort();
 if(signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,30000);
 try { const r=await fetch('https://offerhut-varaus.offerhut-fi.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal}); const d=await r.json(); if(!r.ok||d.error) throw Error([r.status,d.error,d.syy].filter(Boolean).join(' ')); return d; }
 finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
};