// Export a scenario as ONE self-contained .html file: inline CSS, an inline copy
// of the runtime (state / effects / conditional branches / {{var}}) and a tiny
// player, with the scenario JSON embedded. No dependencies, no network — open it
// by double-click or drop it on any static host. UMD: window.ScenarioExportHtml
// (browser) / require (Node).
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ScenarioExportHtml = value;
}(typeof self !== 'undefined' ? self : this, function () {

  // Kept in step with scenario-runtime.js; inlined so the export needs nothing.
  const RUNTIME = `
  function initState(s){var st={};(s.variables||[]).forEach(function(v){st[v.id]=v.default!=null?v.default:v.type==='number'?0:v.type==='boolean'?false:'';});return st;}
  function applyEffects(st,fx){(fx||[]).forEach(function(e){if(!e||!e.var)return;var c=st[e.var];if(e.op==='set')st[e.var]=e.value;else if(e.op==='add')st[e.var]=(Number(c)||0)+Number(e.value||0);else if(e.op==='subtract')st[e.var]=(Number(c)||0)-Number(e.value||0);else if(e.op==='toggle')st[e.var]=!c;});return st;}
  function evalCond(st,c){if(!c||!c.var)return false;var a=st[c.var],v=c.value;switch(c.op){case'eq':return a===v;case'ne':return a!==v;case'gt':return Number(a)>Number(v);case'gte':return Number(a)>=Number(v);case'lt':return Number(a)<Number(v);case'lte':return Number(a)<=Number(v);case'truthy':return !!a;case'falsy':return !a;}return false;}
  function resolveNext(n,st){var b=(n.branches||[]);for(var i=0;i<b.length;i++){if(evalCond(st,b[i].if))return b[i].next;}return n.next||null;}
  function interp(t,st){if(typeof t!=='string')return t;return t.replace(/\\{\\{\\s*([a-z0-9_]+)\\s*\\}\\}/gi,function(w,n){return Object.prototype.hasOwnProperty.call(st,n)?String(st[n]):w;});}`;

  const CSS = `
  :root{--bg:#eef2f6;--surface:#fff;--raised:#f3f6f9;--ink:#1d2730;--soft:#5b6670;--line:#cdd6de;--accent:#2f6d8f;--positive:#2e8b57;--mixed:#b8860b;--negative:#b23b3b;}
  @media(prefers-color-scheme:dark){:root{--bg:#11181d;--surface:#182229;--raised:#1f2b33;--ink:#e8eef2;--soft:#9fb0bb;--line:#2c3a44;--accent:#6fb3d2;--positive:#5bbe86;--mixed:#e0b64e;--negative:#e07a7a;}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:1.05rem/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
  .bar{position:sticky;top:0;display:flex;gap:.5rem;align-items:center;padding:.6rem 1rem;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .bar strong{margin-right:auto;font-size:1rem}
  button{font:inherit;cursor:pointer;padding:.5rem .85rem;border:1px solid var(--line);border-radius:.5rem;background:var(--surface);color:var(--ink)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
  button:hover:not(:disabled){border-color:var(--accent)}button:disabled{opacity:.5;cursor:default}
  :focus-visible{outline:3px solid var(--accent);outline-offset:2px}
  main{max-width:42rem;margin:auto;padding:clamp(2rem,6vh,4rem) 1.2rem 6rem}
  /* a scene, not a boxy card: borderless, airy, soft depth, animated in */
  .card{background:color-mix(in srgb,var(--surface) 66%,var(--bg));border-radius:1.4rem;padding:clamp(1.4rem,4vw,2.6rem);box-shadow:0 26px 80px -52px #000a;animation:scene-in .5s cubic-bezier(.22,.9,.3,1) both}
  @keyframes scene-in{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
  .layer-tag{font:600 .7rem/1 ui-monospace,monospace;letter-spacing:.11em;text-transform:uppercase;color:var(--accent);opacity:.8}
  h1.title{font-size:clamp(1.5rem,4.5vw,2.1rem);line-height:1.2;margin:.45rem 0 .9rem;letter-spacing:-.01em}
  .body{white-space:pre-wrap;font-size:1.08rem;animation:rise .55s ease both;animation-delay:.06s}
  .prompt{margin-top:1.1rem;padding:.9rem 1.1rem;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:.5rem;font-style:italic;animation:rise .55s ease both;animation-delay:.14s}
  .choices{display:flex;flex-direction:column;gap:.65rem;margin-top:1.5rem}
  .choices button{text-align:left;padding:.95rem 1.1rem;line-height:1.45;border-radius:.8rem;transition:transform .14s ease,border-color .14s ease,background .14s ease;animation:rise .45s ease both;animation-delay:calc(var(--i,0)*75ms + .18s)}
  .choices button:hover:not(:disabled){transform:translateX(4px);background:color-mix(in srgb,var(--accent) 7%,var(--surface))}
  .advance{margin-top:1.6rem;animation:rise .5s ease both;animation-delay:.2s}
  .advance button,.card>.choices+*{} .advance .primary{border-radius:.9rem;padding:.7rem 1.3rem}
  .badge{display:inline-block;font:600 .72rem/1 system-ui;letter-spacing:.04em;text-transform:uppercase;padding:.4rem .7rem;border-radius:999px;color:#fff;animation:pop .55s cubic-bezier(.2,1.35,.4,1) both}
  .badge.positive{background:var(--positive)}.badge.mixed{background:var(--mixed)}.badge.negative{background:var(--negative)}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes pop{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
  .debrief{margin-top:1.1rem;padding:1rem 1.1rem;background:color-mix(in srgb,var(--raised) 70%,var(--bg));border-radius:.7rem;animation:rise .55s ease both;animation-delay:.12s}.debrief h3{margin:0 0 .3rem;font-size:.95rem}
  .feedback-note{margin:0 0 1.1rem;padding:.8rem 1rem;border-radius:.6rem;background:color-mix(in srgb,var(--accent) 11%,var(--surface));border-left:3px solid var(--accent);font-size:1rem;animation:rise .5s ease both}
  .review{margin-top:1.1rem;padding:1rem 1.1rem;background:color-mix(in srgb,var(--raised) 70%,var(--bg));border-radius:.7rem;animation:rise .55s ease both;animation-delay:.18s}.review h3{margin:0 0 .5rem;font-size:.95rem}
  .rev-row{display:flex;gap:.7rem;align-items:flex-start;padding:.5rem 0;border-top:1px solid var(--line)}.rev-row:first-of-type{border-top:0}
  .rev-q{flex:none;font:600 .65rem/1.6 system-ui;text-transform:uppercase;letter-spacing:.04em;padding:.15rem .5rem;border-radius:999px;color:#fff;min-width:3.6em;text-align:center}
  .rev-q.strong{background:var(--positive)}.rev-q.workable{background:var(--mixed)}.rev-q.weak{background:var(--negative)}.rev-q.none{background:var(--soft)}
  .rev-choice{color:var(--soft);font-size:.92rem}.rev-note{font-size:.9rem;margin-top:.15rem}
  .lead{color:var(--soft)}.meta-list{margin:.4rem 0 0;padding-left:1.1rem;color:var(--soft);font-size:.98rem}
  .panel{max-width:42rem;margin:1rem auto 0;padding:.7rem 1.1rem;background:color-mix(in srgb,var(--surface) 66%,var(--bg));border-radius:.8rem;font-size:.9rem}
  .panel[hidden]{display:none}.state-row{display:flex;justify-content:space-between;font-family:ui-monospace,monospace}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

  const PLAYER = `
  (function(){
    var S=window.__SCENARIO__, R={initState:initState,applyEffects:applyEffects,resolveNext:resolveNext,interp:interp};
    var byId={}; (S.nodes||[]).forEach(function(n){byId[n.id]=n;});
    var stage=document.getElementById('stage'), state={}, path=[], timer=null, lastFeedback='';
    var Q={strong:'Strong',workable:'OK',weak:'Weak'};
    var motion=matchMedia('(prefers-reduced-motion: reduce)');
    function esc(t){return String(t==null?'':t).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
    function tx(t){return esc(R.interp(t||'',state));}
    function rev(){var d=path.filter(function(p){return p.choice;});if(!d.length)return '';return '<div class="review"><h3>Your decisions</h3>'+d.map(function(p){return '<div class="rev-row"><span class="rev-q '+(p.quality||'none')+'">'+(Q[p.quality]||'—')+'</span><div><b>'+esc(p.title)+'</b><div class="rev-choice">'+esc(p.choice)+'</div>'+(p.note?'<div class="rev-note">'+esc(p.note)+'</div>':'')+'</div></div>';}).join('')+'</div>';}
    function restart(){clearTimeout(timer);state=R.initState(S);path=[];lastFeedback='';intro();renderState();}
    function intro(){
      var o=(S.learningOutcomes||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('');
      stage.innerHTML='<div class="card"><span class="layer-tag">Scenario</span><h1 class="title">'+esc(S.title||'')+'</h1>'+
        (S.intro?'<p class="lead">'+esc(S.intro)+'</p>':'')+
        (S.audience?'<p class="lead"><b>For:</b> '+esc(S.audience)+'</p>':'')+
        (o?'<p class="lead" style="margin-bottom:.2rem"><b>You\\'ll practise:</b></p><ul class="meta-list">'+o+'</ul>':'')+
        '<div class="advance"><button class="primary" id="go">Begin</button></div></div>';
      document.getElementById('go').onclick=function(){go(S.start);};
    }
    function go(id){var n=byId[id];if(!n){stage.innerHTML='<div class="card">Missing node: '+esc(id)+'</div>';return;}
      R.applyEffects(state,n.effects);path.push({title:n.title});renderNode(n);renderState();}
    function renderNode(n){clearTimeout(timer);
      var fb=lastFeedback?'<div class="feedback-note">'+tx(lastFeedback)+'</div>':'';lastFeedback='';
      var h='<div class="card">'+(n.layer?'<span class="layer-tag">'+esc(n.layer)+'</span>':'')+fb+'<h1 class="title">'+tx(n.title)+'</h1><div class="body">'+tx(n.body)+'</div>'+(n.prompt?'<div class="prompt">'+tx(n.prompt)+'</div>':'');
      if(n.type==='choice'){h+='<div class="choices">'+n.choices.map(function(c,i){return '<button data-c="'+i+'" style="--i:'+i+'">'+esc(c.label)+'</button>';}).join('')+'</div></div>';stage.innerHTML=h;
        [].forEach.call(stage.querySelectorAll('[data-c]'),function(b){b.onclick=function(){var c=n.choices[+b.dataset.c];R.applyEffects(state,c.effects);var e=path[path.length-1];e.choice=c.label;e.quality=c.quality;e.note=c.rationale||c.mentalModel||'';lastFeedback=c.feedback||'';go(c.next);};});
      }else if(n.type==='ending'){
        if(n.outcome)h=h.replace('<h1','<span class="badge '+n.outcome+'">'+n.outcome+'</span><h1');
        if(n.debrief)h+='<div class="debrief"><h3>Debrief</h3>'+tx(n.debrief)+'</div>';
        h+=rev();
        h+='<div class="advance"><button class="primary" id="again">Play again</button></div></div>';stage.innerHTML=h;
        document.getElementById('again').onclick=restart;
      }else{
        var lab=n.button||'Continue', wait=(n.type==='auto'&&!motion.matches)?Math.min(60000,n.delayMs==null?1500:n.delayMs):0;
        h+='<div class="advance"><button class="primary" id="adv"'+(wait?' disabled':'')+'>'+esc(lab)+'</button></div></div>';stage.innerHTML=h;
        var adv=document.getElementById('adv');if(wait)timer=setTimeout(function(){adv.disabled=false;adv.focus();},wait);
        adv.onclick=function(){go(R.resolveNext(n,state));};
      }
    }
    function renderState(){var vs=S.variables||[],p=document.getElementById('state');if(!vs.length){p.hidden=true;return;}
      p.hidden=document.getElementById('btn-state').getAttribute('aria-pressed')!=='true';
      p.innerHTML='<b>State</b>'+vs.map(function(v){return '<div class="state-row"><span>'+esc(v.label||v.id)+'</span><b>'+esc(String(state[v.id]))+'</b></div>';}).join('');}
    document.getElementById('btn-restart').onclick=restart;
    document.getElementById('btn-state').onclick=function(){var on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',String(on));this.textContent=on?'Hide state':'Show state';renderState();};
    restart();
  })();`;

  function build(scenario, opts) {
    opts = opts || {};
    const title = (scenario && scenario.title) || 'Scenario';
    const json = JSON.stringify(scenario).replace(/</g, '\\u003c');
    const hasVars = scenario && scenario.variables && scenario.variables.length;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="bar"><strong>${escapeHtml(title)}</strong>${hasVars ? '<button id="btn-state" aria-pressed="false">Show state</button>' : '<button id="btn-state" aria-pressed="false" hidden></button>'}<button id="btn-restart" class="primary">Restart</button></div>
<main id="stage"></main>
<div class="panel" id="state" hidden></div>
<script>window.__SCENARIO__ = ${json};</script>
<script>${RUNTIME}${PLAYER}</script>
${opts.credit === false ? '' : '<!-- Built with GROW scenario-creator -->'}
</body>
</html>
`;
  }
  function escapeHtml(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { build };
}));
