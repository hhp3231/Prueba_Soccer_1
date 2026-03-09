// Aurora UI App
const DATA = {
  matches: 'data/matches.json',
  predictions: 'data/predictions.json',
  results: 'data/results.json',
  bonusPicks: 'data/bonus_picks.json',
  bonusActual: 'data/bonus_actual.json',
  groups: 'data/groups.json',
  features: 'data/features.json'
};
const VERSION = '20260306-AURORA';
function bust(url){ const sep = url.includes('?') ? '&' : '?'; return `${url}${sep}v=${VERSION}&t=${Date.now()}`; }

let STATE = { matches:[], participants:[], resultsById:new Map(), bonus:{picks:[],actual:{}}, groups:[], features:{enable:{}}, current:'' };

async function safeJson(url){ const res = await fetch(bust(url), {cache:'no-store'}); if(!res.ok) throw new Error(`Error ${res.status} al cargar ${url}`); return res.json(); }

async function loadAll(){
  const [m,p,r,bp,ba,g,f] = await Promise.all([
    safeJson(DATA.matches), safeJson(DATA.predictions), safeJson(DATA.results).catch(()=>({results:[]})),
    safeJson(DATA.bonusPicks).catch(()=>({participants:[]})), safeJson(DATA.bonusActual).catch(()=>({})),
    safeJson(DATA.groups).catch(()=>({groups:[] })), safeJson(DATA.features).catch(()=>({enable:{}}))
  ]);
  STATE.matches = (m.matches||[]).slice();
  STATE.participants = (p.participants||[]).slice();
  STATE.participants.sort((a,b)=> a.name.localeCompare(b.name));
  STATE.resultsById = new Map((r.results||[]).map(x=>[x.matchId, x]));
  STATE.bonus.picks = bp.participants||[]; STATE.bonus.actual = ba||{};
  STATE.groups = g.groups||[]; STATE.features = f||{enable:{}};
}

function outcome(h,a){ if(h>a) return 'H'; if(h<a) return 'A'; return 'D'; }
function pointsPerMatch(pred, actual){
  if(!actual) return {pts:0, label:'Sin resultado'};
  const ph = pred?.homeGoalsPred, pa = pred?.awayGoalsPred;
  const ah = actual.homeGoals, aa = actual.awayGoals;
  if(ph==null || pa==null) return {pts:0, label:'Sin predicción'};
  if(ph===ah && pa===aa) return {pts:5, label:'Marcador exacto (5)'};
  const po = outcome(ph,pa), ao = outcome(ah,aa);
  const threeByWinnerGoals = (ao!=='D' && po===ao && ((ao==='H' && ph===ah) || (ao==='A' && pa===aa)) && (ph!==ah || pa!==aa));
  const threeByDrawDiff = (ao==='D' && po==='D' && (ph!==ah));
  if(threeByWinnerGoals || threeByDrawDiff) return {pts:3, label:'Ganador y sus goles / empate distinto (3)'};
  if(po===ao) return {pts:2, label:'Resultado correcto (2)'};
  if((ph===ah) ^ (pa===aa)) return {pts:1, label:'Acierta goles de un equipo (1)'};
  return {pts:0, label:'No acierta (0)'};
}

const BONUS_WEIGHTS = { roundOf32: 2, roundOf16: 5, quarterfinals: 10, semifinals: 15, thirdPlace: 17, final: 20 };
function pointsBonusForParticipant(email){
  const picks = STATE.bonus.picks.find(x=>x.email===email)?.picks || {}; const actual = STATE.bonus.actual || {};
  let total = 0; for(const k of Object.keys(BONUS_WEIGHTS)){
    const weight = BONUS_WEIGHTS[k];
    const wanted = new Set((picks[k]||[]).map(x=>x.trim().toLowerCase()));
    const real = new Set((actual[k]||[]).map(x=>x.trim().toLowerCase()));
    let hit=0; for(const t of wanted) if(real.has(t)) hit++; total += hit*weight;
  }
  return { total };
}

function matchPointsForParticipant(p){ let sum=0; for(const m of STATE.matches){ const pred=p?.predictions?.find(pp=>pp.matchId===m.matchId)||{}; const actual=STATE.resultsById.get(m.matchId); sum += pointsPerMatch(pred, actual).pts; } return sum; }

function renderStandings(){ const tb=document.querySelector('#standings tbody'); if(!tb) return; tb.innerHTML=''; const rows=STATE.participants.map(p=>{const mp=matchPointsForParticipant(p); const b=pointsBonusForParticipant(p.email).total; return {name:p.name,email:p.email,matchPts:mp,bonusPts:b,total:mp+b}}).sort((a,b)=> b.total-a.total||b.matchPts-a.matchPts||a.name.localeCompare(b.name)); rows.forEach((r,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td class="c">${i+1}</td><td><div style="font-weight:800">${r.name}</div><div class="a-muted" style="font-size:12px">${r.email}</div></td><td class="c">${r.matchPts}</td><td class="c">${r.bonusPts}</td><td class="c" style="font-weight:900">${r.total}</td>`; tb.appendChild(tr);}); }

function selectedParticipant(){ const email=document.getElementById('sel')?.value||''; return STATE.participants.find(x=>x.email===email); }

function cardTotals(p){ let matchPts=0; for(const m of STATE.matches){ const pred=p?.predictions?.find(pp=>pp.matchId===m.matchId)||{}; const actual=STATE.resultsById.get(m.matchId); matchPts += pointsPerMatch(pred, actual).pts; } const bonus=pointsBonusForParticipant(p?.email||'').total; document.getElementById('s_name').textContent = p? p.name : '—'; document.getElementById('s_match_pts').textContent = matchPts; document.getElementById('s_bonus').textContent = bonus; document.getElementById('s_total').textContent = matchPts + bonus; }

function matchCard(m, pred, actual){ const sc=pointsPerMatch(pred, actual); const wrap=document.createElement('div'); wrap.className='a-match'; wrap.innerHTML = `<div class="a-id">#${m.matchId}</div>
  <div>
    <div class="a-team"><span class="a-team__name">${m.homeTeam}</span>
      <span class="a-chip">Pred: ${pred.homeGoalsPred??'—'} - ${pred.awayGoalsPred??'—'}</span>
    </div>
    <div class="a-team"><span class="a-team__name">${m.awayTeam}</span></div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;justify-content:center">
    <div class="a-badge ${actual? 'a-badge--ok':'a-badge--warn'}">Final: ${actual? `${actual.homeGoals} - ${actual.awayGoals}` : '—'}</div>
    <div class="a-pts">+${sc.pts}</div>
  </div>`; wrap.title = sc.label; return wrap; }

function renderAllMatches(){ const p = selectedParticipant(); const list=document.getElementById('matches'); list.innerHTML=''; for(const m of STATE.matches){ const pred=p?.predictions?.find(pp=>pp.matchId===m.matchId)||{}; const actual=STATE.resultsById.get(m.matchId); list.appendChild(matchCard(m,pred,actual)); } cardTotals(p||{}); }
function renderStage(stageCode, containerId){ const p = selectedParticipant(); const list=document.getElementById(containerId); if(!list) return; list.innerHTML=''; for(const m of STATE.matches.filter(x=>x.stage===stageCode)){ const pred=p?.predictions?.find(pp=>pp.matchId===m.matchId)||{}; const actual=STATE.resultsById.get(m.matchId); list.appendChild(matchCard(m,pred,actual)); } cardTotals(p||{}); }
function renderGroups(){ const grid=document.getElementById('groups_grid'); if(!grid) return; grid.innerHTML=''; for(const g of STATE.groups){ const card=document.createElement('div'); card.className='g'; card.innerHTML=`<div class="g-h">Grupo ${g.group}</div><ul class="g-ul">${(g.teams||[]).map(t=>`<li>${t}</li>`).join('')}</ul>`; grid.appendChild(card);} }

function populateSelect(){ const sel=document.getElementById('sel'); if(!sel) return; sel.innerHTML=''; const opt0=document.createElement('option'); opt0.value=''; opt0.textContent='— Selecciona —'; sel.appendChild(opt0); for(const p of STATE.participants){ const o=document.createElement('option'); o.value=p.email; o.textContent=p.name; sel.appendChild(o);} sel.addEventListener('change', ()=>{ const v=sel.value; const p=STATE.participants.find(x=>x.email===v); cardTotals(p||{}); renderActivePanel(); }); }

function renderActivePanel(){ const active=document.querySelector('.a-panel.active'); if(!active) return; const id=active.id; if(id==='tab-matches') return renderAllMatches(); if(id==='tab-standings') return renderStandings(); if(id==='tab-groups') return renderGroups(); if(id==='tab-r32') return renderStage('R32','matches_r32'); if(id==='tab-r16') return renderStage('R16','matches_r16'); if(id==='tab-qf') return renderStage('QF','matches_qf'); if(id==='tab-sf') return renderStage('SF','matches_sf'); if(id==='tab-3p') return renderStage('3P','matches_3p'); if(id==='tab-f') return renderStage('F','matches_f'); }

function wire(){ const q=document.getElementById('q'); const btn=document.getElementById('btnSearch'); if(btn) btn.addEventListener('click', ()=>{ const v=(q?.value||'').trim(); const sel=document.getElementById('sel'); const p=STATE.participants.find(x=>x.name.toLowerCase().includes(v.toLowerCase()) || x.email.toLowerCase().includes(v.toLowerCase())); if(p){ sel.value=p.email; cardTotals(p); renderActivePanel(); } }); if(q) q.addEventListener('keypress', (e)=>{ if(e.key==='Enter') btn?.click(); });
  document.querySelectorAll('.a-tab').forEach(b=>{ b.addEventListener('click', ()=>{ document.querySelectorAll('.a-tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const tgt=b.getAttribute('data-target'); document.querySelectorAll('.a-panel').forEach(p=>{ p.classList.toggle('active', '#'+p.id===tgt); }); renderActivePanel(); }); });
}

(async function(){ try{ await loadAll(); populateSelect(); wire(); /* no render por defecto */ }catch(err){ console.error('Error:', err); alert('No se pudieron cargar los datos. Revisa /data/*.json'); }})();
