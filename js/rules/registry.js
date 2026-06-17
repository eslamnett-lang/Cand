(function(global){
  'use strict';

  // Internal Rules Registry (Plugins-free)
  // هدفه: إضافة/حذف قواعد بسهولة + تفعيل/تعطيل + ترتيب + مراحل تنفيذ (stage)
  const _all = [];
  let _list = [];

  function _rebuild(){
    _list = _all
      .filter(r => r && r.enabled !== false)
      .sort((a,b)=>{
        const sa = String(a.stage||'');
        const sb = String(b.stage||'');
        if (sa !== sb) return sa < sb ? -1 : 1;
        const oa = Number.isFinite(+a.order) ? +a.order : 0;
        const ob = Number.isFinite(+b.order) ? +b.order : 0;
        if (oa !== ob) return oa - ob;
        return String(a.key||'').localeCompare(String(b.key||''));
      });
  }

  function register(rule){
    try{
      if (!rule || typeof rule.matches !== 'function') return;
      if (!rule.key) rule.key = String(rule.id||'').trim() || ('RULE_' + Math.random().toString(16).slice(2)).toUpperCase();
      // defaults
      if (rule.enabled === undefined) rule.enabled = true;
      if (!rule.stage) rule.stage = 'sections';
      if (rule.order === undefined) rule.order = 1000 + _all.length;

      // overwrite existing by key (if any)
      const k = String(rule.key).trim();
      const idx = _all.findIndex(r => r && String(r.key).trim() === k);
      if (idx >= 0) _all[idx] = rule;
      else _all.push(rule);

      _rebuild();
    }catch(_){}
  }

  function setEnabled(key, enabled){
    try{
      const k = String(key||'').trim();
      const r = _all.find(x => x && String(x.key).trim() === k);
      if (!r) return false;
      r.enabled = !!enabled;
      _rebuild();
      return true;
    }catch(_){ return false; }
  }

  function configure(map){
    // map: { KEY: {enabled, order, stage}, ... }
    try{
      if (!map) return;
      Object.keys(map).forEach(function(k){
        const cfg = map[k] || {};
        const r = _all.find(x => x && String(x.key).trim() === String(k).trim());
        if (!r) return;
        if (cfg.enabled !== undefined) r.enabled = !!cfg.enabled;
        if (cfg.order !== undefined) r.order = cfg.order;
        if (cfg.stage) r.stage = cfg.stage;
      });
      _rebuild();
    }catch(_){}
  }

  // Compatibility export (old code expects App.Rules.list + App.Rules.register)
  const API = {
    get list(){ return _list; },
    get all(){ return _all.slice(); },
    register,
    setEnabled,
    configure
  };

  global.App = Object.assign(global.App || {}, { Rules: API });

  // Optional runtime configuration (no code edits):
  // App.Config.RULES_REGISTRY = { KEY: {enabled, order, stage}, ... }
  try{
    const C2 = (global.App && global.App.Config) || {};
    if (C2 && C2.RULES_REGISTRY) configure(C2.RULES_REGISTRY);
  }catch(_){ }

  // Optional extension point (no file edits):
  // App.Config.SECTION_RULES_EXT = [ {key,label,matches,aggregate,renderAll,...}, ... ]
  try{
    const C = (global.App && global.App.Config) || {};
    const ext = Array.isArray(C.SECTION_RULES_EXT) ? C.SECTION_RULES_EXT : [];
    ext.forEach(function(r){
      try{ if (r && typeof r.matches === 'function') register(r); }catch(_){}
    });
  }catch(_){}

})(window);