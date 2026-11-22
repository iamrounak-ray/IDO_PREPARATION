// ===== App =====
const SECS=[
 {k:"eng",name:"English",short:"English",marks:15,target:12,topics:"synonyms, antonyms, odd word out, sentence completion, grammar (subject–verb agreement, prepositions, tenses, voice), idioms and phrases, one-word substitution, spelling"},
 {k:"safe",name:"Industrial Safety/Security & Pollution Control",short:"Safety & pollution",marks:10,target:8,topics:"fire triangle and fire classes, fire extinguishers, PPE, Factories Act 1948 and OSH Code 2020, industrial disasters, occupational diseases, pollution control equipment (ESP, scrubber, ETP), air/water/noise pollutants and limits, waste management rules, safety signs, electrical safety"},
 {k:"env",name:"Environment, Energy Conservation & Renewable Energy",short:"Environment & energy",marks:15,target:12,topics:"Indian environmental Acts and their years, international conventions, ozone and climate change, greenhouse gases, renewable energy (solar, wind, biogas, hydro, tidal, geothermal, green hydrogen), BEE and energy efficiency, India's energy targets, ecology and biodiversity, Sundarbans and West Bengal's environment, important environment days"},
 {k:"sci",name:"Physical Science",short:"Physical science",marks:15,target:11,topics:"SI units and constants, motion and force, work, energy and power, gravitation, heat, light (mirrors, lenses, human eye), sound, electricity and magnetism, atomic structure and periodic table, acids, bases and salts, metals, alloys and ores, everyday chemistry, scientists and discoveries. Physics and chemistry only — no biology."},
 {k:"comp",name:"Elementary Computer Knowledge",short:"Computers",marks:10,target:9,topics:"hardware, memory and storage units, input and output devices, software and operating systems, MS Word, Excel and PowerPoint, keyboard shortcuts, internet, email and networking, cyber security, number systems, abbreviations, generations of computers"},
 {k:"wb",name:"Industrial Scenario & Industrial Potential in West Bengal",short:"West Bengal industry",marks:15,target:11,topics:"location of industries in West Bengal, major PSUs and institutions in the state, MSME sector and MSMED Act, ports, coal and power plants, jute, tea and agriculture-based industry, handloom, handicrafts and GI products of West Bengal, industrial history of Bengal, state industrial policy, schemes and agencies (WBIDC, WBSIDCL, WBIIDC, Silpasathi)"},
 {k:"math",name:"Mental Ability & Arithmetic",short:"Maths & reasoning",marks:20,target:13}
];
const SEC=Object.fromEntries(SECS.map(s=>[s.k,s]));
SEC.old={k:"old",name:"Old-syllabus General Studies (not in the 2026 paper)",short:"Old-syllabus GS",marks:0,target:0};
SEC.pyq={k:"pyq",name:"All questions",short:"All"};
const SEC_RATIO=k=>(k==="old"||!SEC[k]||!SEC[k].marks)?0.72:SEC[k].target/SEC[k].marks;
const AI_CONTEXT={
 wb:"Facts current as of November 2026 (use these, do not contradict them): the BJP won the 2026 West Bengal Assembly election and Suvendu Adhikari became Chief Minister in May 2026. The West Bengal Investment Promotion Policy 2026 was unveiled on 5 November 2026 and applies from 9 May 2026. MSME limits since 1 April 2025: micro up to ₹2.5 crore investment and ₹10 crore turnover; small up to ₹25 crore and ₹100 crore; medium up to ₹125 crore and ₹500 crore. Kolkata Port is now named Syama Prasad Mookerjee Port. West Bengal has 23 districts.",
 safe:"Facts current as of November 2026: the Occupational Safety, Health and Working Conditions Code, 2020 came into force on 21 November 2025 and subsumed 13 laws including the Factories Act, 1948. Under the OSH Code a factory licence threshold is 20 workers with power and 40 without power (the old Factories Act used 10 and 20).",
 env:"India's targets: net zero by 2070; 500 GW non-fossil electricity capacity by 2030; National Green Hydrogen Mission (Jan 2023) targets 5 million tonnes per year by 2030.",
 sci:"", comp:"", eng:""
};
const TARGET_FULL=72, NEG=0.25;

// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PSTORE={get(k,d){try{const v=localStorage.getItem("ido:"+k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem("ido:"+k,JSON.stringify(v));}catch(e){}}};
let PROFILE=PSTORE.get("session",null);
const pk=k=>PROFILE?"p:"+PROFILE+":"+k:k;
const CLOUD_MODE=!!(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey);
const CLOUDSTORE={on:false,cache:{},timers:{},profile:null};
const SYNC_KEYS=["quizStats","tests","testsFull","exam","bankUse","aiOn","range"];
function cloudSave(k){ clearTimeout(CLOUDSTORE.timers[k]); delete CLOUDSTORE.timers[k]; if(window.CLOUD&&CLOUD.saveKey) CLOUD.saveKey(k,CLOUDSTORE.cache[k]).catch(e=>console.warn("sync failed",k,e)); }
function cloudFlush(){ for(const k of Object.keys(CLOUDSTORE.timers)) cloudSave(k); }
window.addEventListener("pagehide",()=>{ if(CLOUDSTORE.on) cloudFlush(); });
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden"&&CLOUDSTORE.on) cloudFlush(); });
const store={
  get(k,d){ if(CLOUDSTORE.on){ const v=CLOUDSTORE.cache[k]; return v===undefined||v===null?d:JSON.parse(JSON.stringify(v)); } return PSTORE.get(pk(k),d); },
  set(k,v){ if(CLOUDSTORE.on){ CLOUDSTORE.cache[k]=v; PSTORE.set(pk(k),v); clearTimeout(CLOUDSTORE.timers[k]); CLOUDSTORE.timers[k]=setTimeout(()=>cloudSave(k),1200); return; } PSTORE.set(pk(k),v); }
};
const dayKey=(d=new Date())=>d.toLocaleDateString("en-CA");
const LETTERS=["A","B","C","D"];
function prep(raw){
  let o=raw.opts.map((t,i)=>({t:String(t),c:i===0}));
  if(o.every(x=>x.t.length===1)) o.sort((a,b)=>a.t.localeCompare(b.t)); else o=R.shuffle(o);
  return {sec:raw.sec,sub:raw.sub||"",q:raw.q,exp:raw.exp,src:raw.src,id:raw.id||null,opts:o.map(x=>x.t),ans:o.findIndex(x=>x.c)};
}
function unprep(it){ // back to correct-first form, for re-shuffling a review question
  const o=it.opts.slice(); const c=o.splice(it.ans,1)[0]; return {...it,opts:[c,...o]};
}
function bankRaw(sec,i){const b=BANK[sec][i];return {sec,sub:"",q:b[0],opts:b[1],exp:b[2],src:"bank",id:sec+":"+i};}
function fmtTime(ms){ms=Math.max(0,ms);const s=Math.floor(ms/1000);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":":"")+String(m).padStart(h?2:1,"0")+":"+String(x).padStart(2,"0");}
function modal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.remove("hidden"); const f=$("#modalBody button"); if(f) f.focus(); }
function closeModal(){ $("#modal").classList.add("hidden"); }

// ---------- Claude (fresh questions) ----------
const AI={sample:null,ready:false,enabled:store.get("aiOn",true),denied:false,pauseUntil:0,lastErr:""};
setTimeout(async()=>{ try{ if(typeof claude!=="undefined" && claude && claude.use){ AI.sample=await claude.use("sample"); } }catch(e){ AI.sample=null; } AI.ready=true; if(VIEW==="quiz"||VIEW==="quizrun") render(); },0);
function aiUsable(){ return !!AI.sample && AI.enabled && !AI.denied && Date.now()>AI.pauseUntil; }
function aiStatusHTML(){
  if(!AI.ready) return `<span class="status-ai"><i class="dot"></i>Checking for fresh questions…</span>`;
  if(!AI.sample) return `<span class="status-ai"><i class="dot"></i>Built-in and generated questions only (Claude questions are not available in this view)</span>`;
  if(AI.denied) return `<span class="status-ai"><i class="dot"></i>Claude questions were not allowed. Built-in and generated questions only.</span>`;
  const busy=Object.values(QZ.aiBusy).some(Boolean);
  return `<label class="status-ai"><input type="checkbox" id="aiToggle" ${AI.enabled?"checked":""}> <i class="dot ${AI.enabled?(busy?"busy":"on"):""}"></i>Mix in fresh questions written by Claude${busy&&AI.enabled?" (writing more…)":""}</label>`;
}
async function fetchAI(sec){
  if(sec==="math"||!aiUsable()||QZ.aiBusy[sec]) return;
  QZ.aiBusy[sec]=true; refreshAI();
  const avoid=[...(QZ.ai[sec]||[]).map(x=>x.q),...QZ.recentQ.slice(-30)].slice(-40);
  const s=SEC[sec];
  const prompt=`You write multiple-choice practice questions for the West Bengal Public Service Commission (WBPSC) Industrial Development Officer (IDO) screening exam, 2026 pattern.
Section: ${s.name} (${s.marks} marks in the real paper).
Topics to cover: ${s.topics}.
${AI_CONTEXT[sec]?("Context: "+AI_CONTEXT[sec]):""}
Write 6 NEW questions in the style of the real WBPSC IDO paper: short, direct, one-step questions of graduate-level state PSC difficulty. Each must have exactly 4 options with exactly one correct answer.
Rules:
- Use only facts you are highly confident are true and stable. Prefer standard textbook and static facts. Do not ask about current office holders, recent statistics or anything likely to have changed after 2024, except facts stated in the Context.
- No "all of the above", "none of the above" or "both A and B" options. Wrong options must be plausible but clearly wrong.
- Cover different topics from the list; avoid repeating these recent questions: ${avoid.map(x=>"\""+x.slice(0,90)+"\"").join("; ")||"none"}.
- The explanation must say why the answer is right in 1–3 short sentences and add a memory hook where useful.
Return ONLY JSON in this exact shape:
{"questions":[{"q":"question text","options":["correct answer","wrong","wrong","wrong"],"answer":0,"explanation":"...","topic":"short topic name"}]}
Put the correct answer first in "options" and set "answer" to 0.`;
  try{
    let v;
    try{ v=await AI.sample.json(prompt,{modelTier:"default"}); }
    catch(e){ if(e&&(e.code==="not_granted"||e.code==="rate_limited")) throw e; const r=await AI.sample(prompt,{modelTier:"default"}); const t=r.text||""; v=JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1)); }
    const arr=(v&&v.questions)||(Array.isArray(v)?v:[]);
    QZ.ai[sec]=QZ.ai[sec]||[];
    for(const x of arr){
      if(!x||typeof x.q!=="string"||!Array.isArray(x.options)||x.options.length!==4) continue;
      const opts=x.options.map(o=>String(o).trim()); const a=Number.isInteger(x.answer)?x.answer:0;
      if(a<0||a>3||new Set(opts).size!==4||opts.some(o=>!o)) continue;
      if(opts.some(o=>/all of the above|none of the above/i.test(o))) continue;
      const c=opts[a]; const rest=opts.filter((_,i)=>i!==a);
      if(QZ.recentQ.includes(x.q)) continue;
      QZ.ai[sec].push({sec,sub:String(x.topic||""),q:x.q.trim(),opts:[c,...rest],exp:String(x.explanation||"").trim()||"—",src:"ai"});
    }
  }catch(e){
    if(e&&e.code==="not_granted"){ AI.denied=true; }
    else if(e&&e.code==="rate_limited"){ AI.pauseUntil=Date.now()+90000; }
    else { AI.pauseUntil=Date.now()+20000; }
    AI.lastErr=(e&&e.message)||"";
  }finally{ QZ.aiBusy[sec]=false; refreshAI(); }
}
function refreshAI(){ const el=$("#aiStatus"); if(el){ el.innerHTML=aiStatusHTML(); bindAIToggle(); } }
function bindAIToggle(){ const t=$("#aiToggle"); if(t) t.onchange=()=>{ AI.enabled=t.checked; store.set("aiOn",AI.enabled); refreshAI(); if(AI.enabled&&QZ.sec) prefetch(); }; }

// ---------- stats ----------
function logQuiz(sec,ok,sub){ const s=store.get("quizStats",{}); const d=dayKey(); s[d]=s[d]||{}; const x=s[d][sec]=s[d][sec]||{a:0,r:0}; x.a++; if(ok) x.r++; if(sub){ x.t=x.t||{}; const y=x.t[sub]=x.t[sub]||{a:0,r:0}; y.a++; if(ok) y.r++; } store.set("quizStats",s); }
function quizToday(sec){ const s=store.get("quizStats",{})[dayKey()]||{}; return s[sec]||{a:0,r:0}; }
function streakDays(){ const s=store.get("quizStats",{}); let n=0; const d=new Date(); for(;;){ const k=dayKey(d); const any=s[k]&&Object.values(s[k]).some(x=>x.a>0); if(!any){ if(n===0&&k===dayKey()){ d.setDate(d.getDate()-1); continue; } break; } n++; d.setDate(d.getDate()-1); } return n; }

// ---------- views ----------
let VIEW="quiz";
function go(v){ if(EX&&!EX.done&&v!=="exam"){ VIEW="exam"; render(); return; } VIEW=v; if(["quiz","tests","history"].includes(v)) try{ history.replaceState(null,"","#"+(v==="history"?"profile":v)); }catch(e){} render(); window.scrollTo(0,0); }
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>{ if(!signedIn()) return; if(EX&&!EX.done){ modal(`<h3>A test is running</h3><p>Finish or submit the test before leaving it. Your answers are saved as you go.</p><div class="row"><button class="btn primary" onclick="closeModal()">Back to the test</button></div>`); return; } go(b.dataset.view); });
function render(){
  document.body.classList.toggle("inexam",VIEW==="exam");
  if(!signedIn()){ VIEW="gate"; document.body.classList.add("locked"); document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current","false")); renderGate(); return; }
  if(VIEW==="gate") VIEW="quiz";
  const navV=VIEW==="quizrun"?"quiz":(VIEW==="exam"||VIEW==="result")?"tests":VIEW;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.view===navV?"page":"false"));
  ({quiz:renderQuizHome,quizrun:renderQuiz,tests:renderTests,exam:renderExam,result:renderResult,history:renderHistory})[VIEW]();
}

// ---------- previous year papers ----------
function pyqItems(y,only){ return PYQ[y].qs.filter(q=>!only||q[1]!=="old").map(q=>({sec:q[1],sub:q[1]==="old"?"Old syllabus":"",q:q[2],opts:q[3].slice(),ans:q[4],exp:q[5],src:"pyq",orig:q[0],paper:y})); }
function startPaperQuiz(y,only,list){ Object.assign(QZ,{sec:"paper",paper:y,paperOnly:only,list:list||pyqItems(y,only),idx:0,n:0,right:0,streak:0,review:[],missed:[],cur:null}); VIEW="quizrun"; nextQ(); window.scrollTo(0,0); }
// ---------- quiz ----------
const QZ={sec:null,cur:null,picked:null,n:0,right:0,streak:0,review:[],seen:{},recentQ:[],ai:{},aiBusy:{}};
function renderQuizHome(){
  const tiles=[...SECS,{k:"all",name:"All subjects mixed",short:"All subjects",marks:100}].map(s=>{
    const t=s.k==="all"?SECS.reduce((acc,x)=>{const q=quizToday(x.k);acc.a+=q.a;acc.r+=q.r;return acc;},{a:0,r:0}):quizToday(s.k);
    const kind=s.k==="math"?"Unlimited generated questions with worked solutions":s.k==="all"?"Questions weighted by exam marks":"Built-in, generated and fresh Claude questions";
    return `<button class="tile" data-sec="${s.k}"><span class="t">${esc(s.name)}</span><span class="m">${kind}</span><span class="chiprow">${s.k!=="all"?`<span class="chip acc">${s.marks} marks</span>`:""}<span class="chip ${t.a?"good":""} num">Today: ${t.r}/${t.a}</span></span></button>`;}).join("");
  const sd=streakDays();
  $("#app").innerHTML=`
  <h1>Daily quiz${currentProfile()&&currentProfile().name?`<span class="hello">, ${esc(currentProfile().name)}</span>`:""}</h1>
  <p class="lead">Pick a subject and keep going as long as you like. Each answer shows right or wrong at once, with a short explanation. Questions you get wrong come back a few questions later so they stick.</p>
  <div class="row" style="margin-top:14px"><span class="chip acc num">${sd} day${sd===1?"":"s"} practice streak</span><span id="aiStatus">${aiStatusHTML()}</span></div>
  <div class="section"><div class="grid">${tiles}</div></div>`;
  document.querySelectorAll(".tile[data-sec]").forEach(b=>b.onclick=()=>startQuiz(b.dataset.sec));
  bindAIToggle();
}
function startQuiz(sec){ QZ.list=null; QZ.sec=sec; QZ.n=0; QZ.right=0; QZ.streak=0; QZ.review=[]; QZ.cur=null; VIEW="quizrun"; prefetch(); nextQ(); }
function prefetch(){ const list=QZ.sec==="all"?SECS.filter(s=>s.k!=="math").map(s=>s.k):[QZ.sec]; for(const s of list){ if((QZ.ai[s]||[]).length<3) { fetchAI(s); if(QZ.sec==="all") break; } } }
function weightedSec(){ let r=Math.random()*100; for(const s of SECS){ r-=s.marks; if(r<0) return s.k; } return "math"; }
function drawFor(sec){
  if(sec==="math") return makeGen("math");
  const useAI=aiUsable()&&(QZ.ai[sec]||[]).length>0&&Math.random()<0.5;
  if(useAI) return QZ.ai[sec].shift();
  if(Math.random()<0.55){
    const seen=QZ.seen[sec]=QZ.seen[sec]||new Set(); let free=BANK[sec].map((_,i)=>i).filter(i=>!seen.has(i));
    if(!free.length){ seen.clear(); free=BANK[sec].map((_,i)=>i); }
    const i=R.pick(free); seen.add(i); return bankRaw(sec,i);
  }
  return makeGen(sec);
}
function nextQ(){
  if(QZ.list){ QZ.picked=null; if(QZ.idx>=QZ.list.length){ QZ.cur=null; render(); return; } QZ.cur=QZ.list[QZ.idx++]; render(); const ob=document.querySelector(".opt"); if(ob) ob.focus({preventScroll:true}); return; }
  let it=null;
  const due=(QZ.cur&&QZ.cur.review)?-1:QZ.review.findIndex(r=>r.due<=QZ.n);
  if(due>=0){ const r=QZ.review.splice(due,1)[0]; it={...prep(unprep(r.item)),review:true}; }
  else{
    const sec=QZ.sec==="all"?weightedSec():QZ.sec;
    for(let k=0;k<8;k++){ const raw=drawFor(sec); if(!QZ.recentQ.slice(-12).includes(raw.q)||k===7){ it=prep(raw); break; } }
  }
  QZ.cur=it; QZ.picked=null; QZ.recentQ.push(it.q); if(QZ.recentQ.length>80) QZ.recentQ.shift();
  if(!QZ.list&&QZ.sec!=="math") prefetch();
  render(); const b=document.querySelector(".opt"); if(b) b.focus({preventScroll:true});
}
function answerQ(i){
  if(QZ.picked!==null) return; const it=QZ.cur; QZ.picked=i; QZ.n++;
  const ok=i===it.ans; if(ok){QZ.right++;QZ.streak++;} else {QZ.streak=0; if(QZ.list) QZ.missed.push(it); else QZ.review.push({item:it,due:QZ.n+R.int(4,7)});}
  logQuiz(it.sec,ok,it.sub||""); render(); const nb=$("#nextBtn"); if(nb) nb.focus({preventScroll:true});
}
function srcLabel(it){ if(it.src==="pyq") return `<span class="chip mark">${it.paper} paper · Q${it.orig}</span>${it.sec==="old"?`<span class="chip">Not in 2026 syllabus</span>`:""}`; if(it.review) return `<span class="chip mark">Review: missed earlier</span>`; return it.src==="ai"?`<span class="chip acc">Fresh from Claude</span>`:it.src==="bank"?`<span class="chip">Question bank</span>`:`<span class="chip">Generated</span>`; }
function renderQuiz(){
  if(QZ.list&&!QZ.cur){ const tot=QZ.list.length, pc=tot?Math.round(QZ.right/tot*100):0;
    $("#app").innerHTML=`<div class="qwrap"><div class="card qcard" style="display:flex;flex-direction:column;gap:14px"><h2>${esc(PYQ[QZ.paper].title)}: done</h2>
      <div class="stats"><div class="card stat"><div class="v num">${QZ.right}/${tot}</div><div class="l">Correct</div></div><div class="card stat"><div class="v num">${pc}%</div><div class="l">Accuracy</div></div></div>
      ${QZ.missed.length?`<p style="margin:0">You missed ${QZ.missed.length}: ${QZ.missed.map(x=>"Q"+x.orig).join(", ")}.</p>`:`<p style="margin:0">Every question right.</p>`}
      <div class="row">${QZ.missed.length?`<button class="btn primary" id="retryMissed">Retry the ${QZ.missed.length} I missed</button>`:""}<button class="btn" id="restartPaper">Start the paper again</button><button class="btn ghost" id="backTests">← Tests</button></div></div></div>`;
    const rm=$("#retryMissed"); if(rm) rm.onclick=()=>startPaperQuiz(QZ.paper,QZ.paperOnly,QZ.missed.slice());
    $("#restartPaper").onclick=()=>startPaperQuiz(QZ.paper,QZ.paperOnly); $("#backTests").onclick=()=>go("tests"); return; }
  const it=QZ.cur; const s=QZ.list?{name:PYQ[QZ.paper].title}:QZ.sec==="all"?{name:"All subjects mixed"}:SEC[QZ.sec]; const done=QZ.picked!==null; const ok=done&&QZ.picked===it.ans;
  const opts=it.opts.map((o,i)=>{ let cls="opt"; if(done){ if(i===it.ans) cls+=" right"; else if(i===QZ.picked) cls+=" wrong"; }
    return `<button class="${cls}" data-i="${i}" ${done?"disabled":""}><span class="k">${LETTERS[i]}</span><span>${esc(o)}</span></button>`; }).join("");
  $("#app").innerHTML=`<div class="qwrap">
   <div class="qhead"><button class="btn ghost" id="backBtn">${QZ.list?"← Tests":"← Subjects"}</button>
     <div class="score num">${QZ.list?`<span>Question <b>${QZ.idx}</b> of ${QZ.list.length}</span>`:""}<span>Answered <b>${QZ.n}</b></span><span>Correct <b>${QZ.right}</b></span><span>Streak <b>${QZ.streak}</b></span></div></div>
   <div class="card qcard">
     <div class="chiprow"><span class="chip acc">${esc(QZ.sec==="all"||QZ.list?SEC[it.sec].short:s.name)}</span>${it.sub?`<span class="chip">${esc(it.sub)}</span>`:""}${srcLabel(it)}</div>
     <div class="qtext">${esc(it.q)}</div>
     <div class="opts" role="group" aria-label="Answer options">${opts}</div>
     ${done?`<div class="explain ${ok?"good":"bad"}" aria-live="polite"><div class="verdict ${ok?"good":"bad"}">${ok?"✓ Correct":"✗ Not quite — the answer is "+LETTERS[it.ans]+": "+esc(it.opts[it.ans])}</div><p>${esc(it.exp)}</p></div>
     <div class="next"><span class="hint">${ok||QZ.list?"":"This question will come back in a few turns. "}<span class="kbd">Press Enter for the next question.</span></span><button class="btn primary" id="nextBtn">${QZ.list&&QZ.idx>=QZ.list.length?"See results →":"Next question →"}</button></div>`
     :`<p class="hint" style="margin:14px 0 0">Tap an option<span class="kbd">, or press 1–4 / A–D</span>.</p>`}
   </div>
   <div id="aiStatus">${QZ.sec==="math"||QZ.list?"":aiStatusHTML()}</div>
  </div>`;
  document.querySelectorAll(".opt[data-i]").forEach(b=>b.onclick=()=>answerQ(+b.dataset.i));
  $("#backBtn").onclick=()=>go(QZ.list?"tests":"quiz"); const nb=$("#nextBtn"); if(nb) nb.onclick=nextQ; bindAIToggle();
}

// ---------- tests ----------
let EX=null; let PAL_OPEN=!(window.matchMedia&&matchMedia("(max-width: 860px)").matches);
function sectionItems(sec,n){
  if(sec==="math"){ const nr=Math.max(1,Math.round(n/4)); const rs=[],as=[]; let rp=R.shuffle(REASON),ap=R.shuffle(ARITH);
    const mb=BANK.math||[]; if(mb.length){ const use=store.get("bankUse",{}); const k=Math.min(mb.length,Math.ceil(nr/2));
      mb.map((_,i)=>({i,u:use["math:"+i]||0,r:Math.random()})).sort((a,b)=>a.u-b.u||a.r-b.r).slice(0,k).forEach(x=>{ use["math:"+x.i]=(use["math:"+x.i]||0)+1; rs.push(bankRaw("math",x.i)); }); store.set("bankUse",use); }
    while(rs.length<nr){ if(!rp.length) rp=R.shuffle(REASON); rs.push(rp.pop()()); } while(as.length<n-nr){ if(!ap.length) ap=R.shuffle(ARITH); as.push(ap.pop()()); }
    return [...rs,...as].map(prep); }
  const use=store.get("bankUse",{}); const nb=Math.min(BANK[sec].length,Math.round(n*0.7));
  const order=BANK[sec].map((_,i)=>({i,u:use[sec+":"+i]||0,r:Math.random()})).sort((a,b)=>a.u-b.u||a.r-b.r).slice(0,nb).map(x=>x.i);
  order.forEach(i=>use[sec+":"+i]=(use[sec+":"+i]||0)+1); store.set("bankUse",use);
  const out=order.map(i=>bankRaw(sec,i)); const qs=new Set(out.map(x=>x.q)); let guard=0;
  while(out.length<n&&guard<500){ guard++; const g=makeGen(sec); if(!qs.has(g.q)){ qs.add(g.q); out.push(g); } }
  return R.shuffle(out).map(prep);
}
function startTest(kind,sec,n){
  let items=[],secs=[],title,mins;
  if(kind==="full"){ for(const s of SECS){ const its=sectionItems(s.k,s.marks); secs.push({k:s.k,from:items.length,to:items.length+its.length}); items=items.concat(its); } title="Full mock test"; mins=90; }
  else if(kind==="pyq"){ items=pyqItems(sec,!!n); secs=[{k:"pyq",from:0,to:items.length}]; title=PYQ[sec].title+(n?" (2026-syllabus questions only)":""); mins=(!n&&sec==="2019")?90:Math.ceil(items.length*0.9); }
  else { items=sectionItems(sec,n); secs=[{k:sec,from:0,to:items.length}]; title=`Sectional test: ${SEC[sec].name}`; mins=Math.ceil(n*0.9); }
  const neg=kind==="pyq"?PYQ[sec].neg:NEG; const resultSecs=[...SECS.map(s=>s.k),"old"].filter(k=>items.some(i=>i.sec===k));
  const now=Date.now();
  EX={id:now,kind,title,items,secs,neg,resultSecs,ans:items.map(()=>null),st:items.map(()=>0),cur:0,start:now,end:now+mins*60000,mins,done:false};
  EX.st[0]=1; saveEX(); VIEW="exam"; render(); startTick(); window.scrollTo(0,0);
}
function saveEX(){ store.set("exam",EX); }
let tick=null;
function startTick(){ clearInterval(tick); tick=setInterval(()=>{ if(!EX||EX.done){clearInterval(tick);return;} const left=EX.end-Date.now(); const t=$("#timer"); if(t){ t.textContent=fmtTime(left); t.classList.toggle("low",left<5*60000); } if(left<=0){ clearInterval(tick); submitTest(true); } },1000); }
function renderTests(){
  const saved=store.get("exam",null); const resumable=saved&&!saved.done;
  const secCards=SECS.map(s=>{ const opts=s.k==="math"?[20,40]:[s.marks,25,50]; return `<div class="card tile" style="cursor:default"><span class="t">${esc(s.name)}</span>
    <span class="m">${s.marks} marks in the exam · target ${s.target}</span>
    <div class="row"><label class="m" for="n-${s.k}">Questions</label><select id="n-${s.k}">${opts.map(o=>`<option value="${o}">${o} (${Math.ceil(o*0.9)} min)</option>`).join("")}</select>
    <button class="btn" data-sect="${s.k}">Start</button></div></div>`; }).join("");
  $("#app").innerHTML=`<h1>Tests</h1>
  <p class="lead">Timed tests in the WBPSC IDO format: 1 mark per correct answer, ${NEG} deducted per wrong answer, nothing for a skipped question. After you submit, every question is evaluated with its explanation.</p>
  ${resumable?`<div class="banner" style="margin-top:16px"><span>You have an unfinished test: ${esc(saved.title)} (${fmtTime(saved.end-Date.now())} left).</span><span class="row"><button class="btn" id="discard">Discard</button><button class="btn primary" id="resume">Resume</button></span></div>`:""}
  <div class="section"><div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
    <h2>Full mock test</h2>
    <p style="margin:0" class="m">100 questions · 90 minutes · same section order and marks as the 2026 notification. A new paper is built each time from the question bank and generators, preferring questions you have seen least.</p>
    <div class="tablewrap"><table><thead><tr><th>Section</th><th class="n">Questions</th><th class="n">Your target</th></tr></thead><tbody>
    ${SECS.map(s=>`<tr><td>${esc(s.name)}</td><td class="n">${s.marks}</td><td class="n">${s.target}</td></tr>`).join("")}
    <tr><td><b>Total</b></td><td class="n"><b>100</b></td><td class="n"><b>${TARGET_FULL}+ net</b></td></tr></tbody></table></div>
    <div class="row"><button class="btn primary" id="startFull">Start full mock (90 min)</button><span class="hint">Suggested order in the real exam: computers & safety, English, environment, West Bengal, science, reasoning, then arithmetic.</span></div>
  </div></div>
  <div class="section"><h2>Previous year papers</h2><p class="lead" style="margin:0">The real WBPSC IDO papers, with the original question numbers and option order. Questions on topics that are no longer in the 2026 syllabus (history, geography, polity, biology, general economy) are tagged, and you can leave them out.</p><div class="grid">${pyqCards()}</div></div>
  <div class="section"><h2>Sectional tests</h2><p class="lead" style="margin:0">One subject at a time, timed at the exam’s pace (about 54 seconds a question). Good for a daily 15-minute check.</p><div class="grid">${secCards}</div></div>`;
  $("#startFull").onclick=()=>{ if(resumable) store.set("exam",null); startTest("full"); };
  document.querySelectorAll("[data-pyq]").forEach(b=>b.onclick=()=>{ if(resumable) store.set("exam",null); startTest("pyq",b.dataset.pyq,b.dataset.only==="1"?1:0); });
  document.querySelectorAll("[data-pyqp]").forEach(b=>b.onclick=()=>startPaperQuiz(b.dataset.pyqp,b.dataset.only==="1"));
  document.querySelectorAll("[data-sect]").forEach(b=>b.onclick=()=>{ if(resumable) store.set("exam",null); startTest("sect",b.dataset.sect,+$("#n-"+b.dataset.sect).value); });
  if(resumable){ $("#resume").onclick=()=>{ EX=saved; if(Date.now()>=EX.end){ submitTest(true); return; } VIEW="exam"; render(); startTick(); }; $("#discard").onclick=()=>{ store.set("exam",null); render(); }; }
}
function pyqCards(){ return Object.entries(PYQ).sort((a,b)=>b[0]-a[0]).map(([y,P])=>{ const all=P.qs.length, cur=P.qs.filter(q=>q[1]!=="old").length; const cnt={}; P.qs.forEach(q=>cnt[q[1]]=(cnt[q[1]]||0)+1);
  const last=store.get("tests",[]).find(t=>t.kind==="pyq"&&t.paper===y);
  return `<div class="card tile" style="cursor:default"><span class="t">${esc(P.title)}</span>
   <span class="m">${all} questions · ${cur} still in the 2026 syllabus · marked −${fmt(P.neg)} per wrong answer</span>
   <span class="chiprow">${[...SECS.map(s=>s.k),"old"].filter(k=>cnt[k]).map(k=>`<span class="chip ${k==="old"?"":"acc"} num">${esc(SEC[k].short)} ${cnt[k]}</span>`).join("")}</span>
   <span class="m">${esc(P.note)}</span>
   ${last?`<span class="m num">Last timed attempt: net ${fmt(last.net)} / ${last.total}</span>`:""}
   <div class="row" style="gap:8px"><button class="btn primary" data-pyq="${y}" data-only="0">Timed: all ${all} (${(y==="2019")?90:Math.ceil(all*0.9)} min)</button><button class="btn" data-pyq="${y}" data-only="1">Timed: ${cur} in 2026 syllabus (${Math.ceil(cur*0.9)} min)</button></div>
   <div class="row" style="gap:8px"><button class="btn" data-pyqp="${y}" data-only="0">Practise one by one</button><button class="btn ghost" data-pyqp="${y}" data-only="1">One by one, 2026 syllabus only</button></div></div>`; }).join(""); }
function secOf(i){ return EX.secs.find(s=>i>=s.from&&i<s.to); }
function statusClass(st){ return ["nv","na","an","mk","am"][st]; }
function setStatusAfterLeave(i){ if(EX.st[i]===0||EX.st[i]===1) EX.st[i]=EX.ans[i]===null?1:2; }
function goQ(i){ if(i<0||i>=EX.items.length) return; setStatusAfterLeave(EX.cur); EX.cur=i; if(EX.st[i]===0) EX.st[i]=1; saveEX(); render(); }
function renderExam(){
  const i=EX.cur, it=EX.items[i], cs=secOf(i);
  const counts=[0,0,0,0,0]; EX.st.forEach((s,j)=>{ let x=s; if(j===i&&x<=1) x=EX.ans[j]===null?1:2; counts[x]++; });
  const answered=EX.ans.filter(a=>a!==null).length, total=EX.items.length;
  const tabs=EX.secs.length>1?`<div class="sectabs" role="tablist">${EX.secs.map(s=>{const a=EX.ans.slice(s.from,s.to).filter(x=>x!==null).length;return `<button data-tab="${s.from}" aria-current="${s===cs}">${esc(SEC[s.k].short)} <span class="num">${a}/${s.to-s.from}</span></button>`;}).join("")}</div>`:"";
  const pal=[]; for(let j=cs.from;j<cs.to;j++){ let s=EX.st[j]; if(j===i&&s<=1) s=EX.ans[j]===null?1:2; pal.push(`<button class="${statusClass(s)}${j===i?" cur":""}" data-q="${j}" aria-label="Question ${j+1}">${j+1}</button>`); }
  $("#app").innerHTML=`
  <div class="card exambar"><span class="ttl">${esc(EX.title)}</span><span class="m num">${answered}/${total} answered</span><span class="timer num" id="timer">${fmtTime(EX.end-Date.now())}</span><button class="btn primary" id="submitBtn">Submit test</button></div>
  ${answered===total?`<div class="banner"><span>All ${total} questions answered. Submit to see your evaluation.</span><button class="btn primary" id="submitBtn2">Submit and evaluate</button></div>`:""}
  ${tabs}
  <div class="exam">
    <div class="card exq">
      <div class="exmeta"><span>Question <b class="num">${i+1}</b> of ${total}${it.orig?` · paper Q${it.orig}`:""} · ${esc(SEC[it.sec].short)}</span><span>+1 for correct · −${fmt(EX.neg??NEG)} for wrong</span></div>
      <div class="qtext">${esc(it.q)}</div>
      <div class="opts">${it.opts.map((o,k)=>`<button class="opt${EX.ans[i]===k?" sel":""}" data-k="${k}" aria-pressed="${EX.ans[i]===k}"><span class="k">${LETTERS[k]}</span><span>${esc(o)}</span></button>`).join("")}</div>
      <div class="exnav">
        <button class="btn" id="markBtn">${EX.st[i]>=3?"Unmark review":"Mark for review"} & next</button>
        <button class="btn ghost" id="clearBtn" ${EX.ans[i]===null?"disabled":""}>Clear response</button>
        <span class="sp"></span>
        <button class="btn" id="prevBtn" ${i===0?"disabled":""}>← Back</button>
        <button class="btn primary" id="nextBtn">${i===total-1?"Save":"Save & next →"}</button>
      </div>
    </div>
    <details class="card palette" id="palD" ${PAL_OPEN?"open":""}><summary><b>${esc(SEC[cs.k].name)}</b> <span class="m num">· palette (${answered}/${total} answered)</span></summary>
      <div class="pgrid">${pal.join("")}</div>
      <div class="legend num">
        <span><i class="sw" style="background:var(--good)"></i>Answered ${counts[2]}</span>
        <span><i class="sw" style="background:var(--bad-bg);border-color:var(--bad)"></i>Not answered ${counts[1]}</span>
        <span><i class="sw"></i>Not visited ${counts[0]}</span>
        <span><i class="sw" style="background:var(--mark)"></i>Marked ${counts[3]}</span>
        <span style="grid-column:1/-1"><i class="sw" style="background:var(--mark);box-shadow:inset 0 0 0 3px var(--good)"></i>Answered & marked ${counts[4]} (counted)</span>
      </div>
    </details>
  </div>`;
  const pd=$("#palD"); if(pd) pd.ontoggle=()=>{ PAL_OPEN=pd.open; };
  document.querySelectorAll(".opt[data-k]").forEach(b=>b.onclick=()=>{ const k=+b.dataset.k; EX.ans[i]=k; EX.st[i]=EX.st[i]>=3?4:2; saveEX(); render(); });
  document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>goQ(+b.dataset.q));
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>goQ(+b.dataset.tab));
  $("#markBtn").onclick=()=>{ EX.st[i]=EX.st[i]>=3?(EX.ans[i]===null?1:2):(EX.ans[i]===null?3:4); saveEX(); if(i<total-1){ EX.cur=i+1; if(EX.st[i+1]===0) EX.st[i+1]=1; saveEX(); } render(); };
  $("#clearBtn").onclick=()=>{ EX.ans[i]=null; EX.st[i]=EX.st[i]>=3?3:1; saveEX(); render(); };
  $("#prevBtn").onclick=()=>goQ(i-1);
  $("#nextBtn").onclick=()=>{ if(i<total-1) goQ(i+1); else { setStatusAfterLeave(i); saveEX(); render(); } };
  $("#submitBtn").onclick=confirmSubmit; const s2=$("#submitBtn2"); if(s2) s2.onclick=confirmSubmit;
}
function confirmSubmit(){
  const total=EX.items.length, ans=EX.ans.filter(a=>a!==null).length, mk=EX.st.filter(s=>s===3).length;
  modal(`<h3>Submit the test?</h3><div class="tablewrap"><table><tbody>
   <tr><td>Answered</td><td class="n">${ans}</td></tr><tr><td>Not answered</td><td class="n">${total-ans}</td></tr><tr><td>Marked for review without an answer</td><td class="n">${mk}</td></tr>
   <tr><td>Time left</td><td class="n">${fmtTime(EX.end-Date.now())}</td></tr></tbody></table></div>
   <div class="row"><button class="btn primary" id="yesSubmit">Submit and evaluate</button><button class="btn" onclick="closeModal()">Keep working</button></div>`);
  $("#yesSubmit").onclick=()=>{ closeModal(); submitTest(false); };
}
function evaluate(ex){
  const per={}; let c=0,w=0,s=0; const ng=ex.neg??NEG;
  ex.items.forEach((it,i)=>{ const p=per[it.sec]=per[it.sec]||{q:0,c:0,w:0,s:0}; p.q++; const a=ex.ans[i]; if(a===null){p.s++;s++;} else if(a===it.ans){p.c++;c++;} else {p.w++;w++;} });
  return {c,w,s,net:c-ng*w,total:ex.items.length,per,neg:ng};
}
let RES=null;
function submitTest(auto){
  clearInterval(tick); EX.done=true; EX.submitted=Math.min(Date.now(),EX.end); EX.auto=!!auto;
  const ev=evaluate(EX); ev.paper=EX.kind==="pyq"?EX.items[0].paper:undefined; const subs={}; EX.items.forEach((it,i)=>{ if(!it.sub||EX.ans[i]===null) return; const y=((subs[it.sec]=subs[it.sec]||{})[it.sub]=subs[it.sec][it.sub]||{a:0,r:0}); y.a++; if(EX.ans[i]===it.ans) y.r++; }); const rec={subs,id:EX.id,date:new Date(EX.start).toISOString(),kind:EX.kind,title:EX.title,mins:EX.mins,used:EX.submitted-EX.start,...ev,secs:EX.resultSecs||EX.secs.map(s=>s.k)};
  const hist=store.get("tests",[]); hist.unshift(rec); store.set("tests",hist.slice(0,200));
  const full=store.get("testsFull",[]); full.unshift({id:EX.id,items:EX.items,ans:EX.ans}); store.set("testsFull",full.slice(0,10));
  store.set("exam",null);
  RES={rec,items:EX.items,ans:EX.ans,filter:"all",secFilter:"all"}; EX=null; VIEW="result"; render(); window.scrollTo(0,0);
}
function renderResult(){
  const {rec,items,ans}=RES; const NG=rec.neg??NEG; const isFull=rec.kind==="full"; const pct=rec.total?Math.round(rec.c/rec.total*100):0;
  const tgt=isFull?TARGET_FULL:rec.secs.reduce((acc,k)=>acc+Math.round(((rec.per[k]||{}).q||0)*SEC_RATIO(k)),0);
  const rows=rec.secs.map(k=>{ const p=rec.per[k]||{q:0,c:0,w:0,s:0}; const net=p.c-NG*p.w; const t=isFull?SEC[k].target:Math.round(p.q*SEC_RATIO(k)); return `<tr><td>${esc(SEC[k].name)}</td><td class="n">${p.q}</td><td class="n">${p.c}</td><td class="n">${p.w}</td><td class="n">${p.s}</td><td class="n"><b>${fmt(net)}</b></td><td class="n">${t}</td><td>${net>=t?`<span class="chip good">On target</span>`:`<span class="chip bad">${fmt(t-net)} short</span>`}</td></tr>`; }).join("");
  const list=items.map((it,i)=>({it,i,a:ans[i]})).filter(x=>{ const st=x.a===null?"skip":x.a===x.it.ans?"right":"wrong"; return (RES.filter==="all"||RES.filter===st)&&(RES.secFilter==="all"||x.it.sec===RES.secFilter); });
  const cards=list.map(({it,i,a})=>{ const st=a===null?"skip":a===it.ans?"right":"wrong";
    return `<div class="card rv"><div class="rvhead"><span>Q${i+1}${it.orig?` (paper Q${it.orig})`:""} · ${esc(SEC[it.sec].short)}${it.sub?" · "+esc(it.sub):""}</span>${st==="right"?`<span class="chip good">Correct +1</span>`:st==="wrong"?`<span class="chip bad">Wrong −${fmt(NG)}</span>`:`<span class="chip">Not attempted 0</span>`}</div>
    <div class="qtext" style="margin:0">${esc(it.q)}</div>
    <div class="opts">${it.opts.map((o,k)=>`<div class="opt${k===it.ans?" right":k===a?" wrong":""}"><span class="k">${LETTERS[k]}</span><span>${esc(o)}${k===a?" <b>(your answer)</b>":""}</span></div>`).join("")}</div>
    <div class="explain ${st==="right"?"good":st==="wrong"?"bad":""}"><b>${st==="right"?"You got this right.":"Correct answer: "+LETTERS[it.ans]+". "+esc(it.opts[it.ans])}</b><p>${esc(it.exp)}</p></div></div>`; }).join("");
  const nW=items.filter((it,i)=>ans[i]!==null&&ans[i]!==it.ans).length, nS=ans.filter(a=>a===null).length;
  $("#app").innerHTML=`<div class="row" style="justify-content:space-between"><h1>${esc(rec.title)}: evaluation</h1><span class="m">${new Date(rec.date).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}${rec.auto?" · auto-submitted when time ran out":""}</span></div>
  <div class="section"><div class="stats">
    <div class="card stat"><div class="v num">${fmt(rec.net)}<span style="font-size:1rem;color:var(--muted)"> / ${rec.total}</span></div><div class="l">Net score (after −${fmt(NG)} per wrong)</div></div>
    <div class="card stat"><div class="v num" style="color:var(--good)">${rec.c}</div><div class="l">Correct</div></div>
    <div class="card stat"><div class="v num" style="color:var(--bad)">${rec.w}</div><div class="l">Wrong (−${fmt(rec.w*fmt(NG))})</div></div>
    <div class="card stat"><div class="v num">${rec.s}</div><div class="l">Not attempted</div></div>
    <div class="card stat"><div class="v num">${pct}%</div><div class="l">Accuracy on all questions</div></div>
    <div class="card stat"><div class="v num">${fmtTime(rec.used)}</div><div class="l">Time used of ${rec.mins} min</div></div>
  </div>
  <p style="margin:0">${rec.net>=tgt?`<span class="chip good">At or above target</span> Net ${fmt(rec.net)} against a target of ${tgt}.`:`<span class="chip bad">Below target</span> Net ${fmt(rec.net)} against a target of ${tgt}: ${fmt(tgt-rec.net)} marks to find. The section table shows where.`}</p>
  <div class="card tablewrap"><table><thead><tr><th>Section</th><th class="n">Qs</th><th class="n">Correct</th><th class="n">Wrong</th><th class="n">Skipped</th><th class="n">Net</th><th class="n">Target</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="row"><button class="btn primary" id="again">${isFull?"Take another full mock":"Another sectional test"}</button><button class="btn" id="toQuiz">Practise in the daily quiz</button></div></div>
  <div class="section"><h2>Question-by-question evaluation</h2>
   <div class="filters">${[["all",`All ${items.length}`],["wrong",`Wrong ${nW}`],["skip",`Not attempted ${nS}`],["right",`Correct ${rec.c}`]].map(([k,l])=>`<button data-f="${k}" aria-pressed="${RES.filter===k}">${l}</button>`).join("")}
   ${rec.secs.length>1?`<select id="secF"><option value="all">All sections</option>${rec.secs.map(k=>`<option value="${k}" ${RES.secFilter===k?"selected":""}>${esc(SEC[k].short)}</option>`).join("")}</select>`:""}</div>
   ${cards||`<p class="m">No questions in this filter.</p>`}</div>`;
  document.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ RES.filter=b.dataset.f; render(); });
  const sf=$("#secF"); if(sf) sf.onchange=()=>{ RES.secFilter=sf.value; render(); };
  $("#again").onclick=()=>{ if(isFull) startTest("full"); else go("tests"); };
  if(rec.kind==="pyq") $("#again").textContent="Back to tests";
  $("#toQuiz").onclick=()=>go("quiz");
}

// ---------- progress ----------
function mockChart(m,W=640){
  H=200,P={l:34,r:12,t:14,b:26}; const n=m.length; const x=i=>P.l+(n===1?(W-P.l-P.r)/2:i*(W-P.l-P.r)/(n-1)); const y=v=>P.t+(1-v/100)*(H-P.t-P.b);
  const grid=[0,25,50,72,100].map(v=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v===72?"var(--good)":"var(--line)"}" ${v===72?'stroke-dasharray="4 4"':""}/><text x="${P.l-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`).join("");
  const pts=m.map((t,i)=>`${x(i)},${y(Math.max(0,t.net))}`).join(" ");
  const dots=m.map((t,i)=>`<circle cx="${x(i)}" cy="${y(Math.max(0,t.net))}" r="${i===n-1?5:4}" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/><circle cx="${x(i)}" cy="${y(Math.max(0,t.net))}" r="12" fill="transparent" data-tip="${esc(`<b>${new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</b><br>Net ${fmt(t.net)} / ${t.total} · ${t.c} right, ${t.w} wrong`)}"/><text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</text>`).join("");
  const last=m[n-1];
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" role="img" aria-label="Net scores of recent full mocks; target 72">${grid}<text x="${W-P.r}" y="${y(72)-5}" text-anchor="end" font-size="11" fill="var(--good)">target 72</text>${n>1?`<polyline points="${pts}" fill="none" stroke="var(--series)" stroke-width="2"/>`:""}${dots}<text x="${x(n-1)}" y="${y(Math.max(0,last.net))-10}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${fmt(last.net)}</text></svg>`;
}

// ---------- keyboard ----------
document.addEventListener("keydown",e=>{
  if(!$("#modal").classList.contains("hidden")){ if(e.key==="Escape") closeModal(); return; }
  if(e.target.tagName==="SELECT"||e.target.tagName==="INPUT") return;
  const k=e.key.toLowerCase(); const idx="1234".indexOf(k)>=0?"1234".indexOf(k):"abcd".indexOf(k);
  if(VIEW==="quizrun"){ if(QZ.picked===null&&idx>=0&&!e.ctrlKey&&!e.metaKey){ answerQ(idx); e.preventDefault(); } else if(QZ.picked!==null&&(k==="enter"||k==="n")){ nextQ(); e.preventDefault(); } }
  else if(VIEW==="exam"&&EX&&idx>=0&&!e.ctrlKey&&!e.metaKey){ EX.ans[EX.cur]=idx; EX.st[EX.cur]=EX.st[EX.cur]>=3?4:2; saveEX(); render(); }
});

// ---------- start ----------
(function init(){
  if(CLOUD_MODE){ PROFILE=null; GATE.cmode="loading"; renderProfileBox(); render(); window.addEventListener("cloud-ready",cloudStart,{once:true}); return; }
  renderProfileBox(); if(!signedIn()){ render(); return; } RANGE=loadRange();
  const saved=store.get("exam",null);
  if(saved&&!saved.done){ EX=saved; if(Date.now()>=EX.end){ submitTest(true); return; } VIEW="exam"; render(); startTick(); return; }
  const h=(location.hash||"").replace("#",""); VIEW=h==="profile"?"history":["quiz","tests","history"].includes(h)?h:"quiz"; render();
})();
