window.SearchController = (() => {
  const fields = ['saapuminen','lahto','alue','hinta_min','hinta_max','aikuiset','lapset','muuta'];
  const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  const num = v => v != null && String(v).trim()!=='' && Number.isFinite(Number(v));
  const count = v => num(v) && Number.isInteger(Number(v)) && Number(v)>=0;
  function missing(k) {
    if (!date(k.saapuminen)||!date(k.lahto)||k.lahto<=k.saapuminen) return 'aika';
    if (!String(k.alue||'').trim()) return 'alue';
    if (!num(k.hinta_max)||Number(k.hinta_max)<=0) return 'hinta';
    if (!count(k.aikuiset)||!count(k.lapset)||Number(k.aikuiset)+Number(k.lapset)<1) return 'vieraat';
    return '';
  }
  function apply(k, patch) {
    const next={...k};
    for (const f of fields) if (Object.prototype.hasOwnProperty.call(patch||{},f)) {
      const v=patch[f]; if(v==null||String(v).trim()==='') delete next[f]; else next[f]=String(v).trim();
    }
    return next;
  }
  function key(k){return JSON.stringify(fields.map(f=>k[f]??''));}
  return {missing,apply,key};
})();
