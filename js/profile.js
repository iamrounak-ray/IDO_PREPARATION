// ===== Email profiles (stored in this browser) + progress charts =====
// Passcodes are stored only as salted PBKDF2 hashes. Each works once on a device.
const CODE_HASHES=["c2601e0a5f9ee7f0ebcc7099e7bc8aa60eaf6629440f49f5e3aab38520277181","de1372741b8dfb2dcf3228636d665816bf2e6d309b0c2b608da5dec72787510c"];
async function hashCode(code){
  const enc=new TextEncoder(); const key=await crypto.subtle.importKey("raw",enc.encode(code),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode("ido-practice-room-v1"),iterations:150000,hash:"SHA-256"},key,256);
  return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
const normEmail=e=>String(e||"").trim().toLowerCase();
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function profiles(){ const p=PSTORE.get("profiles",[]); return Array.isArray(p)?p:[]; }
function emailProfiles(){ return profiles().filter(p=>p.email); }
function saveProfiles(p){ PSTORE.set("profiles",p); }
function currentProfile(){ if(CLOUD_MODE) return CLOUDSTORE.profile?{id:PROFILE,...CLOUDSTORE.profile}:null; return profiles().find(p=>p.id===PROFILE&&p.email)||null; }
function signedIn(){ return PROFILE!==null && !!currentProfile(); }
function hasData(id){ try{ const pre="ido:"+(id?"p:"+id+":":""); return !!(localStorage.getItem(pre+"quizStats")||localStorage.getItem(pre+"tests")); }catch(e){ return false; } }
function legacySources(){ // progress saved before email profiles existed
  const out=[]; const ps=profiles();
  if(!ps.some(p=>p.id===""&&p.email) && hasData("")) out.push({id:"",label:(ps.find(p=>p.id==="")||{}).name||"Progress already saved on this device"});
  ps.filter(p=>!p.email&&p.id!==""&&hasData(p.id)).forEach(p=>out.push({id:p.id,label:p.name||"Earlier profile"}));
  return out;
}
function enterProfile(id){
  PROFILE=id; PSTORE.set("session",id);
  Object.assign(QZ,{sec:null,cur:null,picked:null,n:0,right:0,streak:0,review:[],seen:{},recentQ:[],list:null});
  AI.enabled=store.get("aiOn",true); RANGE=loadRange(); renderProfileBox();
  const saved=store.get("exam",null); if(saved&&!saved.done){ EX=saved; if(Date.now()>=EX.end){ submitTest(true); return; } VIEW="exam"; render(); startTick(); return; }
  EX=null; VIEW="quiz"; render(); window.scrollTo(0,0);
}
function signOut(){
  if(CLOUD_MODE){ if(EX&&!EX.done){ modal(`<h3>A test is running</h3><p>Submit the test before signing out.</p><div class="row"><button class="btn primary" onclick="closeModal()">Back to the test</button></div>`); return; } return cloudSignOut(); }
  if(EX&&!EX.done){ modal(`<h3>A test is running</h3><p>Submit the test before signing out.</p><div class="row"><button class="btn primary" onclick="closeModal()">Back to the test</button></div>`); return; }
  PROFILE=null; PSTORE.set("session",null); EX=null; GATE.mode=null; GATE.msg=""; renderProfileBox(); VIEW="gate"; render();
}
function switchProfile(id){ enterProfile(id); }
const dispName=p=>p?(p.name||p.email):"";
function renderProfileBox(){
  const box=$("#profileBox"); if(!box) return; const cur=currentProfile();
  document.body.classList.toggle("locked",!cur);
  box.innerHTML=cur?`<span class="pbox"><span class="who"><b>${esc(dispName(cur))}</b><span class="m">${esc(cur.email)}</span></span><button class="btn ghost sm" id="signOutBtn">Sign out</button></span>`:"";
  const b=$("#signOutBtn"); if(b) b.onclick=signOut;
}
let GATE={mode:null,msg:"",busy:false,form:{}};
function renderGate(){
  if(CLOUD_MODE) return renderCloudGate();
  const known=emailProfiles(); const legacy=legacySources(); const f=GATE.form;
  const back=`<button type="button" class="btn ghost sm" id="gBack">← Back</button>`;
  let body="";
  if(!GATE.mode){
    body=`<div class="choice">
      <button class="choicebtn" data-mode="new"><span class="ct">New user</span><span class="m">First time here? Create your profile with your name, email and the passcode you were given.</span></button>
      <button class="choicebtn" data-mode="ret"><span class="ct">Returning user</span><span class="m">Already registered on this device? Just enter your email.</span></button>
    </div>`;
  } else if(GATE.mode==="ret"){
    body=`${back}<form id="retForm" class="gform" novalidate>
      <h2>Returning user</h2>
      <label for="rEmail">Email address</label><input id="rEmail" class="txt" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="name@example.com" value="${esc(f.rEmail||"")}" required>
      ${known.length?`<div class="m">Or tap your profile:</div><div class="chiprow">${known.map(p=>`<button type="button" class="pchip" data-pid="${esc(p.id)}">${esc(dispName(p))}</button>`).join("")}</div>`:""}
      <p class="err" id="gErr" aria-live="polite">${esc(GATE.msg)}</p>
      <button class="btn primary big" type="submit">Continue</button>
    </form>`;
  } else {
    body=`${back}<form id="newForm" class="gform" novalidate>
      <h2>New user</h2>
      <label for="nName">Profile name</label><input id="nName" class="txt" type="text" autocomplete="name" maxlength="30" placeholder="e.g. Rina" value="${esc(f.nName||"")}" required>
      <label for="nEmail">Email address</label><input id="nEmail" class="txt" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="name@example.com" value="${esc(f.nEmail||"")}" required>
      <label for="nCode">Passcode</label><input id="nCode" class="txt" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="12" placeholder="6-digit passcode" value="${esc(f.nCode||"")}" required>
      ${legacy.length?`<label for="nLegacy">Progress already on this device</label><select id="nLegacy">${legacy.map((l,i)=>`<option value="${esc(l.id)}" ${(f.nLegacy?f.nLegacy===l.id:i===0)?"selected":""}>Bring over: ${esc(l.label)}</option>`).join("")}<option value="__none" ${f.nLegacy==="__none"?"selected":""}>Start fresh</option></select>`:""}
      <p class="m" style="margin:0">You need the passcode only once. After this, sign in as a returning user with your email.</p>
      <p class="err" id="gErr" aria-live="polite">${esc(GATE.msg)}</p>
      <button class="btn primary big" type="submit" ${GATE.busy?"disabled":""}>${GATE.busy?"Checking passcode…":"Create my profile"}</button>
    </form>`;
  }
  $("#app").innerHTML=`<div class="gate card"><div><h1>IDO Practice Room</h1><p class="lead">Practice for the WBPSC Industrial Development Officer exam: daily quizzes, timed mock tests, previous year papers and progress charts.</p></div>${body}
    <p class="m small" style="margin:0">Profiles and progress are saved in this browser on this device.</p></div>`;
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{ GATE.mode=b.dataset.mode; GATE.msg=""; render(); const i=$("#app input"); if(i) i.focus(); });
  const bk=$("#gBack"); if(bk) bk.onclick=()=>{ GATE.mode=null; GATE.msg=""; render(); };
  const fail=m=>{ GATE.msg=m; const el=$("#gErr"); if(el){ el.textContent=m; } };
  if(GATE.mode==="ret"){
    document.querySelectorAll("[data-pid]").forEach(b=>b.onclick=()=>{ GATE.msg=""; GATE.form={}; enterProfile(b.dataset.pid); });
    $("#retForm").onsubmit=e=>{ e.preventDefault(); const em=normEmail($("#rEmail").value); f.rEmail=em;
      if(!validEmail(em)) return fail("Enter a valid email address, like name@example.com.");
      const p=known.find(x=>x.email===em);
      if(!p) return fail("This email isn’t registered on this device. If you registered on a different phone or computer, register here as a new user.");
      GATE.msg=""; GATE.form={}; enterProfile(p.id); };
  } else if(GATE.mode==="new"){
    $("#newForm").onsubmit=async e=>{ e.preventDefault(); if(GATE.busy) return;
      const name=$("#nName").value.trim().replace(/\s+/g," "), em=normEmail($("#nEmail").value), code=$("#nCode").value.trim(); const lg=$("#nLegacy")?$("#nLegacy").value:"__none";
      Object.assign(f,{nName:name,nEmail:em,nCode:code,nLegacy:lg});
      if(!name) return fail("Enter a profile name.");
      if(!validEmail(em)) return fail("Enter a valid email address, like name@example.com.");
      if(known.some(x=>x.email===em)) return fail("This email is already registered on this device. Go back and choose Returning user.");
      if(!/^\d{4,12}$/.test(code)) return fail("Enter the passcode you were given (digits only).");
      GATE.busy=true; GATE.msg=""; render();
      let h=""; try{ h=await hashCode(code); }catch(err){ GATE.busy=false; render(); return fail("This browser could not check the passcode. Please update your browser and try again."); }
      GATE.busy=false; const used=PSTORE.get("usedCodes",[]);
      if(!CODE_HASHES.includes(h)){ f.nCode=""; render(); return fail("That passcode is not valid. Check it with the person who shared this page."); }
      if(used.includes(h)){ f.nCode=""; render(); return fail("That passcode has already been used. Ask for a new one."); }
      const ps=profiles(); let id; const now=new Date().toISOString();
      if(lg!=="__none"&&legacy.some(l=>l.id===lg)){ id=lg; const ex=ps.find(x=>x.id===lg); if(ex) Object.assign(ex,{email:em,name,created:now}); else ps.push({id:lg,email:em,name,created:now}); }
      else { id="e"+Date.now().toString(36); ps.push({id,email:em,name,created:now}); }
      saveProfiles(ps); used.push(h); PSTORE.set("usedCodes",used); GATE.msg=""; GATE.form={}; GATE.mode=null; enterProfile(id); };
  }
}
function deleteProfileDialog(){
  const cur=currentProfile(); if(!cur) return;
  if(CLOUD_MODE){ modal(`<h3>Delete the profile ${esc(cur.email)}?</h3><p>This permanently deletes its quiz history, tests and charts on every device. It cannot be undone, and registering this email again needs a new passcode.</p><div class="row"><button class="btn" id="pdel" style="border-color:var(--bad);color:var(--bad)">Delete permanently</button><button class="btn primary" onclick="closeModal()">Keep it</button></div>`); $("#pdel").onclick=async()=>{ $("#pdel").disabled=true; try{ for(const k of Object.keys(CLOUDSTORE.timers)) clearTimeout(CLOUDSTORE.timers[k]); CLOUDSTORE.timers={}; await CLOUD.deleteProfile(); for(const k of SYNC_KEYS){ try{ localStorage.removeItem("ido:"+pk(k)); }catch(e){} } closeModal(); await cloudSignOut(); }catch(e){ closeModal(); modal(`<h3>Could not delete</h3><p>${esc(e.message||e)}</p><div class="row"><button class="btn primary" onclick="closeModal()">OK</button></div>`); } }; return; }
  modal(`<h3>Delete the profile ${esc(cur.email)}?</h3><p>This permanently removes its quiz history, tests and charts from this device. It cannot be undone, and creating the profile again will need a new passcode.</p>
   <div class="row"><button class="btn" id="pdel" style="border-color:var(--bad);color:var(--bad)">Delete permanently</button><button class="btn primary" onclick="closeModal()">Keep it</button></div>`);
  $("#pdel").onclick=()=>{ for(const k of ["quizStats","tests","testsFull","exam","bankUse","aiOn","range"]){ try{ localStorage.removeItem("ido:"+pk(k)); }catch(e){} }
    saveProfiles(profiles().filter(p=>p.id!==cur.id)); closeModal(); PROFILE=null; PSTORE.set("session",null); EX=null; GATE.mode=null; renderProfileBox(); VIEW="gate"; render(); };
}

// ---------- date range ----------
let RANGE=null;
function addDays(key,n){ const d=new Date(key+"T12:00:00"); d.setDate(d.getDate()+n); return dayKey(d); }
function daysBetween(a,b){ return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5); }
function firstDataDay(){ const q=Object.keys(store.get("quizStats",{})).sort()[0]; const t=store.get("tests",[]).map(x=>dayKey(new Date(x.date))).sort()[0]; return [q,t].filter(Boolean).sort()[0]||dayKey(); }
function presetRange(p){ const to=dayKey(); if(p==="all") return {from:firstDataDay(),to}; return {from:addDays(to,-(+p-1)),to}; }
function loadRange(){ const r=store.get("range",null); const base=r&&r.preset?r:{preset:"30",src:"all"}; const fr=base.preset==="custom"&&base.from&&base.to?{from:base.from,to:base.to}:presetRange(base.preset); return {...base,...fr}; }
function setRange(r){ RANGE={...RANGE,...r}; if(RANGE.from>RANGE.to) [RANGE.from,RANGE.to]=[RANGE.to,RANGE.from]; store.set("range",RANGE); render(); }

// ---------- data ----------
function dailyData(src){ // day -> sec -> {a,r,t:{topic:{a,r}}}
  const out={}; const add=(d,sec,a,r,t)=>{ const x=((out[d]=out[d]||{})[sec]=out[d][sec]||{a:0,r:0,t:{}}); x.a+=a; x.r+=r; if(t) for(const [k,v] of Object.entries(t)){ const y=x.t[k]=x.t[k]||{a:0,r:0}; y.a+=v.a; y.r+=v.r; } };
  if(src!=="tests"){ const qs=store.get("quizStats",{}); for(const [d,secs] of Object.entries(qs)) for(const [sec,v] of Object.entries(secs)) add(d,sec,v.a,v.r,v.t); }
  if(src!=="quiz"){ for(const t of store.get("tests",[])){ const d=dayKey(new Date(t.date)); for(const [sec,p] of Object.entries(t.per||{})) add(d,sec,p.c+p.w,p.c,(t.subs||{})[sec]); } }
  return out;
}
function buckets(from,to){
  const span=daysBetween(from,to)+1; const mode=span<=62?"day":span<=400?"week":"month"; const list=[];
  if(mode==="day"){ for(let d=from;d<=to;d=addDays(d,1)) list.push({from:d,to:d,label:new Date(d+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}); }
  else if(mode==="week"){ let d=from; while(d<=to){ const e=addDays(d,6)<to?addDays(d,6):to; list.push({from:d,to:e,label:"Week of "+new Date(d+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}); d=addDays(e,1);} }
  else { let d=from; while(d<=to){ const dt=new Date(d+"T12:00:00"); const end=dayKey(new Date(dt.getFullYear(),dt.getMonth()+1,0)); const e=end<to?end:to; list.push({from:d,to:e,label:dt.toLocaleDateString("en-IN",{month:"short",year:"numeric"})}); d=addDays(e,1);} }
  return {mode,list};
}
function sumRange(data,from,to,sec){ const s={a:0,r:0,t:{},days:new Set()}; for(const [d,secs] of Object.entries(data)){ if(d<from||d>to) continue; for(const [k,v] of Object.entries(secs)){ if(sec&&k!==sec) continue; if(v.a>0) s.days.add(d); s.a+=v.a; s.r+=v.r; for(const [tk,tv] of Object.entries(v.t||{})){ const y=s.t[tk]=s.t[tk]||{a:0,r:0}; y.a+=tv.a; y.r+=tv.r; } } } return s; }
const pct=(r,a)=>a?Math.round(r/a*100):null;

// ---------- charts ----------
function tipShow(e,html){ const t=$("#tip"); t.innerHTML=html; t.classList.remove("hidden"); const pad=14; let x=e.clientX+pad,y=e.clientY+pad; const r=t.getBoundingClientRect(); if(x+r.width>innerWidth-8) x=e.clientX-r.width-pad; if(y+r.height>innerHeight-8) y=e.clientY-r.height-pad; t.style.left=x+"px"; t.style.top=y+"px"; }
function tipHide(){ $("#tip").classList.add("hidden"); }
document.addEventListener("pointerdown",e=>{ if(!(e.target.closest&&e.target.closest("[data-tip]"))) tipHide(); });
window.addEventListener("scroll",()=>tipHide(),{passive:true});
let lastW=innerWidth; window.addEventListener("resize",()=>{ clearTimeout(window.__rz); window.__rz=setTimeout(()=>{ if(Math.abs(innerWidth-lastW)>40){ lastW=innerWidth; if(VIEW==="history") render(); } },200); });
const boxW=(el,def)=>Math.max(280,Math.floor((el&&el.clientWidth)||def));
function bindTips(root){ root.querySelectorAll("[data-tip]").forEach(el=>{ el.addEventListener("mousemove",e=>tipShow(e,el.dataset.tip)); el.addEventListener("mouseleave",tipHide); el.addEventListener("pointerdown",e=>{ if(e.pointerType!=="mouse"){ e.stopPropagation(); tipShow(e,el.dataset.tip); } }); el.addEventListener("focus",e=>{ const r=el.getBoundingClientRect(); tipShow({clientX:r.left+r.width/2,clientY:r.top},el.dataset.tip); }); el.addEventListener("blur",tipHide); }); }
function overviewChart(rows,W=640){ // horizontal bars: accuracy by subject + target tick
  const narrow=W<480; const rowH=narrow?50:34,L=narrow?14:170,Rm=narrow?20:110,H=rows.length*rowH+24; const x=v=>L+v/100*(W-L-Rm);
  const grid=[0,25,50,75,100].map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="4" y2="${H-20}" stroke="var(--grid)"/><text x="${x(v)}" y="${H-6}" text-anchor="middle" class="ax">${v}%</text>`).join("");
  const bars=rows.map((r,i)=>{ const y=i*rowH+(narrow?24:8), h=narrow?14:16, acc=r.acc; const w=acc==null?0:Math.max(0,x(acc)-L); const tgt=r.target;
    const tip=esc(`<b>${r.name}</b><br>${acc==null?"No questions in this range":`${acc}% correct (${r.r} of ${r.a})`}<br>Target ${tgt}%`);
    return `<g>${narrow?`<text x="${L}" y="${y-6}" class="lb">${esc(r.short)}</text><text x="${W-Rm}" y="${y-6}" text-anchor="end" class="val">${acc==null?"–":acc+"%"}<tspan class="ax"> · ${r.a} Qs</tspan></text>`:`<text x="${L-10}" y="${y+h/2+4}" text-anchor="end" class="lb">${esc(r.short)}</text>`}
      ${acc==null?`<text x="${L+6}" y="${y+h/2+4}" class="ax">no data</text>`:`<path d="M${L},${y} h${Math.max(0,w-4)} a4,4 0 0 1 4,4 v${h-8} a4,4 0 0 1 -4,4 h-${Math.max(0,w-4)} z" fill="var(--series)"/>`}
      <line x1="${x(tgt)}" x2="${x(tgt)}" y1="${y-4}" y2="${y+h+4}" stroke="var(--ink)" stroke-width="2"/>
      ${narrow?"":`<text x="${W-Rm+10}" y="${y+h/2+4}" class="val">${acc==null?"–":acc+"%"}<tspan class="ax"> · ${r.a} Qs</tspan></text>`}
      <rect x="0" y="${y-(narrow?22:8)}" width="${W}" height="${rowH}" fill="transparent" data-tip="${tip}" tabindex="0" aria-label="${esc(r.name)}: ${acc==null?"no data":acc+"% correct"}, target ${tgt}%"/></g>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" role="img" aria-label="Accuracy by subject against target">${grid}${bars}</svg>
   <div class="legendline"><span><i class="sw" style="background:var(--series)"></i>Accuracy in range</span><span><i class="tick"></i>Target accuracy (from the study plan)</span></div>`;
}
function subjectChart(sec,data,bk,target,W=560){
  const P={l:36,r:10},H1=130,H2=46,gap=10,T=8; const n=bk.list.length; const step=(W-P.l-P.r)/n; const cx=i=>P.l+step*(i+.5);
  const pts=bk.list.map(b=>{ const s=sumRange(data,b.from,b.to,sec); return {a:s.a,r:s.r,acc:pct(s.r,s.a),b}; });
  const y=v=>T+(1-v/100)*(H1-T); const maxA=Math.max(1,...pts.map(p=>p.a)); const y2top=H1+gap+18, y2=v=>y2top+H2-(v/maxA)*H2;
  let grid=[0,50,100].map(v=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${P.l-6}" y="${y(v)+4}" text-anchor="end" class="ax">${v}%</text>`).join("");
  grid+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y(target)}" y2="${y(target)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W-P.r}" y="${y(target)-5}" text-anchor="end" class="ax">target ${target}%</text>`;
  let segs="",cur=[]; pts.forEach((p,i)=>{ if(p.acc==null){ if(cur.length>1) segs+=`<polyline points="${cur.join(" ")}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"/>`; cur=[]; } else cur.push(`${cx(i)},${y(p.acc)}`); });
  if(cur.length>1) segs+=`<polyline points="${cur.join(" ")}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"/>`;
  const lastI=pts.map(p=>p.acc!=null).lastIndexOf(true);
  const dots=pts.map((p,i)=>p.acc==null?"":`<circle cx="${cx(i)}" cy="${y(p.acc)}" r="${i===lastI?5:4}" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/>`).join("");
  const lastLbl=lastI>=0?`<text x="${Math.min(cx(lastI),W-P.r-14)}" y="${y(pts[lastI].acc)-10}" text-anchor="middle" class="val">${pts[lastI].acc}%</text>`:"";
  const bw=Math.max(2,Math.min(18,step-2));
  const bars=pts.map((p,i)=>p.a?`<path d="M${cx(i)-bw/2},${y2top+H2} v-${Math.max(0,y2top+H2-y2(p.a)-Math.min(4,bw/2))} a${Math.min(4,bw/2)},${Math.min(4,bw/2)} 0 0 1 ${Math.min(4,bw/2)},-${Math.min(4,bw/2)} h${Math.max(0,bw-2*Math.min(4,bw/2))} a${Math.min(4,bw/2)},${Math.min(4,bw/2)} 0 0 1 ${Math.min(4,bw/2)},${Math.min(4,bw/2)} v${Math.max(0,y2top+H2-y2(p.a)-Math.min(4,bw/2))} z" fill="var(--vol)"/>`:"").join("");
  const every=Math.ceil(n/Math.max(3,Math.floor(W/90))); const xl=pts.map((p,i)=>(i%every===0||i===n-1)&&(i===n-1||n-1-i>=every/2||i===0)?`<text x="${cx(i)}" y="${y2top+H2+16}" text-anchor="middle" class="ax">${esc(bk.mode==="day"?p.b.label:bk.mode==="week"?new Date(p.b.from+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"}):p.b.label)}</text>`:"").join("");
  const hits=pts.map((p,i)=>`<rect x="${cx(i)-step/2}" y="0" width="${step}" height="${y2top+H2}" fill="transparent" data-tip="${esc(`<b>${p.b.label}</b><br>${p.a?`${p.r} of ${p.a} correct (${p.acc}%)`:"No questions"}`)}"/>`).join("");
  const empty=pts.every(p=>!p.a)?`<text x="${(W+P.l)/2}" y="${H1/2+4}" text-anchor="middle" class="ax">No questions answered in this range</text>`:"";
  return `<svg viewBox="0 0 ${W} ${y2top+H2+22}" width="${W}" height="${y2top+H2+22}" style="max-width:100%;height:auto" role="img" aria-label="${esc(SEC[sec].name)}: accuracy and questions answered by ${bk.mode}">
    ${grid}${segs}${dots}${lastLbl}${empty}
    <text x="${P.l}" y="${y2top-6}" class="ax">Questions answered per ${bk.mode} (max ${maxA})</text>
    <line x1="${P.l}" x2="${W-P.r}" y1="${y2top+H2}" y2="${y2top+H2}" stroke="var(--grid)"/>${bars}${xl}${hits}</svg>`;
}

// ---------- the profile view (replaces the old progress view) ----------
function renderHistory(){
  if(!RANGE) RANGE=loadRange();
  const cur=currentProfile(); const data=dailyData(RANGE.src); const {from,to}=RANGE; const span=daysBetween(from,to)+1;
  const pFrom=addDays(from,-span), pTo=addDays(from,-1);
  const tot=sumRange(data,from,to), prevTot=sumRange(data,pFrom,pTo);
  const tests=store.get("tests",[]).filter(t=>{ const d=dayKey(new Date(t.date)); return d>=from&&d<=to; }); const full=store.get("testsFull",[]);
  const mocks=tests.filter(t=>t.kind==="full"); const best=mocks.length?Math.max(...mocks.map(t=>t.net)):null;
  const bk=buckets(from,to);
  const rows=SECS.map(s=>{ const x=sumRange(data,from,to,s.k); return {k:s.k,name:s.name,short:s.short,a:x.a,r:x.r,acc:pct(x.r,x.a),target:Math.round(s.target/s.marks*100)}; });
  const delta=(a,b)=>a==null||b==null?"":`<span class="chip ${a>=b?"good":"bad"} num">${a>=b?"▲":"▼"} ${Math.abs(a-b)} pts vs previous ${span} days</span>`;
  const accAll=pct(tot.r,tot.a), accPrev=pct(prevTot.r,prevTot.a);
  const cards=SECS.map(s=>{ const x=sumRange(data,from,to,s.k), px=sumRange(data,pFrom,pTo,s.k); const acc=pct(x.r,x.a); const tg=Math.round(s.target/s.marks*100);
    const topics=Object.entries(x.t).filter(([k,v])=>k&&v.a>=3).map(([k,v])=>({k,a:v.a,acc:pct(v.r,v.a)})).sort((a,b)=>a.acc-b.acc).slice(0,3);
    const status=acc==null?`<span class="chip">No data yet</span>`:acc>=tg?`<span class="chip good">✓ On target</span>`:`<span class="chip bad">! ${tg-acc} pts below target</span>`;
    return `<div class="card scard"><div class="shead"><div><h3>${esc(s.name)}</h3><span class="m">${s.marks} exam marks · target ${tg}% correct</span></div>
      <div class="sbig"><span class="v num">${acc==null?"–":acc+"%"}</span><span class="m num">${x.r}/${x.a} correct · ${x.days.size} day${x.days.size===1?"":"s"}</span></div></div>
      <div class="chiprow">${status}${delta(acc,pct(px.r,px.a))}</div>
      <div class="chartbox" data-sec="${s.k}" data-tg="${tg}"></div>
      ${topics.length?`<div class="m"><b>Weakest topics:</b> ${topics.map(t=>`<span class="chip bad num">${esc(t.k)} ${t.acc}% (${t.a})</span>`).join(" ")}</div>`:x.a?`<div class="m">Topic breakdown appears once a topic has 3 or more answers.</div>`:""}
      <div class="row" style="gap:8px"><button class="btn" data-practise="${s.k}">Practise ${esc(s.short)}</button></div></div>`; }).join("");
  const trows=tests.map(t=>{ const has=full.some(f=>f.id===t.id); return `<tr><td>${new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</td><td>${esc(t.title)}</td><td class="n"><b>${fmt(t.net)}</b> / ${t.total}</td><td class="n">${t.c}</td><td class="n">${t.w}</td><td class="n">${t.s}</td><td>${has?`<button class="btn" data-rv="${t.id}">Review</button>`:""}</td></tr>`; }).join("");
  const presets=[["7","7 days"],["30","30 days"],["90","90 days"],["all","All time"]];
  $("#app").innerHTML=`<div class="row" style="justify-content:space-between;align-items:flex-end">
    <div><h1 class="em">${esc(dispName(cur))}</h1><p class="lead em">${esc(cur.email)} · ${CLOUD_MODE?"progress is synced to this email on every device.":"progress saved in this browser on this device."}</p></div>
    <div class="row" style="gap:8px"><button class="btn" id="pOut">Sign out</button><button class="btn ghost" id="pDel">Delete profile</button></div></div>
  <div class="card filterbar">
    <div class="filters" role="group" aria-label="Date range">${presets.map(([k,l])=>`<button data-pre="${k}" aria-pressed="${RANGE.preset===k}">${l}</button>`).join("")}<button data-pre="custom" aria-pressed="${RANGE.preset==="custom"}">Custom</button></div>
    <div class="row" style="gap:8px"><label class="m" for="rFrom">From</label><input type="date" id="rFrom" class="txt" value="${from}" max="${dayKey()}"><label class="m" for="rTo">to</label><input type="date" id="rTo" class="txt" value="${to}" max="${dayKey()}"></div>
    <div class="row" style="gap:8px"><label class="m" for="rSrc">Count</label><select id="rSrc"><option value="all" ${RANGE.src==="all"?"selected":""}>Quiz and tests</option><option value="quiz" ${RANGE.src==="quiz"?"selected":""}>Daily quiz only</option><option value="tests" ${RANGE.src==="tests"?"selected":""}>Tests only</option></select></div>
  </div>
  <div class="section"><div class="stats">
    <div class="card stat"><div class="v num">${tot.a}</div><div class="l">Questions answered</div></div>
    <div class="card stat"><div class="v num">${accAll==null?"–":accAll+"%"}</div><div class="l">Correct ${accPrev!=null&&accAll!=null?`(${accAll>=accPrev?"+":""}${accAll-accPrev} vs previous period)`:""}</div></div>
    <div class="card stat"><div class="v num">${tot.days.size}<span style="font-size:1rem;color:var(--muted)"> / ${span}</span></div><div class="l">Days practised</div></div>
    <div class="card stat"><div class="v num">${mocks.length}</div><div class="l">Full mocks${best!=null?` · best net ${fmt(best)}`:""}</div></div>
  </div></div>
  <div class="section"><h2>Accuracy by subject</h2><p class="m" style="margin:0">${new Date(from+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} – ${new Date(to+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}. The black tick is the target accuracy for that subject in the study plan.</p>
    <div class="card" style="padding:16px"><div id="ovChart"></div></div></div>
  <div class="section"><h2>Each subject over time</h2><p class="m" style="margin:0">Top: % correct per ${bk.mode}, dashed line = target. Bottom: how many questions were answered. Hover for the numbers.</p><div class="sgrid">${cards}</div></div>
  ${mocks.length?`<div class="section"><h2>Full mock scores</h2><div class="card" style="padding:16px"><div id="mockBox"></div></div></div>`:""}
  <div class="section"><h2>Tests in this range</h2>${tests.length?`<div class="card tablewrap"><table><thead><tr><th>Date</th><th>Test</th><th class="n">Net</th><th class="n">Correct</th><th class="n">Wrong</th><th class="n">Skipped</th><th></th></tr></thead><tbody>${trows}</tbody></table></div>`:`<p class="m">No tests in this range.</p>`}</div>
  <div class="section"><h2>Table view</h2><div class="card tablewrap"><table><thead><tr><th>Subject</th><th class="n">Answered</th><th class="n">Correct</th><th class="n">Accuracy</th><th class="n">Target</th><th class="n">Previous period</th></tr></thead><tbody>
   ${rows.map(r=>{ const p=sumRange(data,pFrom,pTo,r.k); return `<tr><td>${esc(r.name)}</td><td class="n">${r.a}</td><td class="n">${r.r}</td><td class="n">${r.acc==null?"–":r.acc+"%"}</td><td class="n">${r.target}%</td><td class="n">${pct(p.r,p.a)==null?"–":pct(p.r,p.a)+"%"}</td></tr>`; }).join("")}</tbody></table></div>
   <p class="m" style="margin:0">Practice streak: ${streakDays()} day(s).</p></div>`;
  const ov=$("#ovChart"); ov.innerHTML=overviewChart(rows,boxW(ov,640));
  document.querySelectorAll(".chartbox[data-sec]").forEach(el=>{ el.innerHTML=subjectChart(el.dataset.sec,data,bk,+el.dataset.tg,boxW(el,520)); });
  const mb=$("#mockBox"); if(mb) mb.innerHTML=mockChart(mocks.slice(0,20).reverse(),boxW(mb,640));
  bindTips($("#app"));
  document.querySelectorAll("[data-pre]").forEach(b=>b.onclick=()=>{ const p=b.dataset.pre; if(p==="custom") setRange({preset:"custom"}); else setRange({preset:p,...presetRange(p)}); });
  $("#rFrom").onchange=e=>{ if(e.target.value) setRange({preset:"custom",from:e.target.value}); };
  $("#rTo").onchange=e=>{ if(e.target.value) setRange({preset:"custom",to:e.target.value}); };
  $("#rSrc").onchange=e=>setRange({src:e.target.value});
  $("#pOut").onclick=signOut; $("#pDel").onclick=deleteProfileDialog;
  document.querySelectorAll("[data-practise]").forEach(b=>b.onclick=()=>{ VIEW="quizrun"; startQuiz(b.dataset.practise); });
  document.querySelectorAll("[data-rv]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.rv; const all=store.get("tests",[]); const t=all.find(x=>x.id===id), f=full.find(x=>x.id===id); RES={rec:t,items:f.items,ans:f.ans,filter:"all",secFilter:"all"}; VIEW="result"; render(); window.scrollTo(0,0); });
}

// ===== Cloud (Firebase) sign-in: email link + one-time passcode =====
function cloudErrMsg(e){ const c=(e&&e.code)||""; const m={
 "auth/invalid-email":"That email address doesn’t look right.",
 "auth/quota-exceeded":"Today’s limit for sign-in emails has been reached. Please try again tomorrow.",
 "auth/too-many-requests":"Too many attempts. Please wait a few minutes and try again.",
 "auth/invalid-action-code":"This sign-in link has expired or was already used. Request a new one.",
 "auth/expired-action-code":"This sign-in link has expired. Request a new one.",
 "auth/unauthorized-continue-uri":"This website’s address isn’t authorised in Firebase yet (see README, step 3).",
 "auth/unauthorized-domain":"This website’s address isn’t authorised in Firebase yet (see README, step 3).",
 "auth/operation-not-allowed":"Email-link sign-in isn’t switched on in Firebase yet (see README, step 3).",
 "auth/network-request-failed":"No internet connection. Check your connection and try again.",
 "auth/invalid-credential":"Email or password is incorrect.",
 "auth/wrong-password":"Email or password is incorrect.",
 "auth/user-not-found":"No account with this email. Choose New user to register.",
 "auth/invalid-login-credentials":"Email or password is incorrect.",
 "auth/email-already-in-use":"An account with this email already exists. Go back and choose Returning user.",
 "auth/weak-password":"Your password must be exactly 6 digits (numbers only).",
 "auth/missing-password":"Enter your 6-digit password.",
 "auth/user-disabled":"This account has been disabled."}; return m[c]||("Something went wrong: "+((e&&e.message)||e)); }
function reasonMsg(r){ return r.reason==="used"?"That passcode has already been used. Ask for a new one.":r.reason==="invalid"?"That passcode is not valid. Check it with the person who shared this page.":"Could not reach the database. Check your connection and try again."; }
async function cloudStart(){
  const C=window.CLOUD;
  if(!C||C.failed||!C.enabled){ GATE.cmode="failed"; GATE.msg=(C&&C.error)||"Firebase could not start."; render(); return; }
  if(C.hasLink()){
    const pend=C.pending.get();
    if(pend&&pend.email){ GATE.cmode="loading"; render(); try{ await C.completeLink(pend.email); }catch(e){ GATE.cmode="linkerr"; GATE.msg=cloudErrMsg(e); render(); return; } }
    else if(!C.user){ GATE.cmode="confirm"; GATE.msg=""; render(); return; }
  }
  await afterAuth();
}
async function afterAuth(){
  const C=window.CLOUD;
  if(!C.user){ GATE.cmode=null; render(); return; }
  GATE.cmode="loading"; render();
  let prof=null; try{ prof=await C.getProfile(); }catch(e){ GATE.cmode="neterr"; GATE.msg="Could not reach the database. Check your connection and try again."; render(); return; }
  if(!prof){
    const pend=C.pending.get();
    if(pend&&pend.mode==="new"&&pend.code&&normEmail(pend.email)===normEmail(C.user.email)){
      const r=await C.createProfile(pend.name,pend.code);
      if(r.ok){ C.pending.clear(); prof=await C.getProfile(); }
      else { GATE.cmode="finish"; GATE.form={nName:pend.name}; GATE.msg=reasonMsg(r); render(); return; }
    } else { GATE.cmode="finish"; GATE.form={}; GATE.msg=pend&&pend.mode==="ret"?"There is no profile for this email yet. Enter your name and a passcode to create one.":""; render(); return; }
  }
  C.pending.clear(); await openCloudProfile(prof);
}
function mergeStores(local,remote,remoteOk){
  const out={};
  for(const k of SYNC_KEYS){
    const L=local[k], Rm=remote[k];
    if(k==="quizStats"&&L&&Rm){ const m=JSON.parse(JSON.stringify(Rm)); for(const [d,secs] of Object.entries(L)){ m[d]=m[d]||{}; for(const [s,v] of Object.entries(secs)){ const r=m[d][s]; if(!r||v.a>r.a) m[d][s]=v; } } out[k]=m; }
    else if((k==="tests"||k==="testsFull")&&(L||Rm)){ const seen=new Set(); out[k]=[...(Rm||[]),...(L||[])].filter(t=>t&&!seen.has(t.id)&&seen.add(t.id)).sort((x,y)=>y.id-x.id).slice(0,k==="tests"?200:10); }
    else if(remoteOk){ if(Rm!==undefined&&Rm!==null) out[k]=Rm; }
    else if(L!==undefined) out[k]=L;
  }
  return out;
}
async function openCloudProfile(prof){
  const C=window.CLOUD; PROFILE="c:"+C.user.uid;
  let remote={}, remoteOk=false; try{ remote=await C.loadStore(); remoteOk=true; }catch(e){ console.warn(e); }
  const local={}; for(const k of SYNC_KEYS){ const v=PSTORE.get(pk(k),undefined); if(v!==undefined&&v!==null) local[k]=v; }
  const merged=mergeStores(local,remote,remoteOk);
  Object.assign(CLOUDSTORE,{on:true,cache:merged,timers:{},profile:{name:prof.name,email:prof.email}});
  for(const k of SYNC_KEYS){ if(merged[k]===undefined){ try{ localStorage.removeItem("ido:"+pk(k)); }catch(e){} continue; } PSTORE.set(pk(k),merged[k]); if(remoteOk&&JSON.stringify(merged[k])!==JSON.stringify(remote[k])) C.saveKey(k,merged[k]).catch(()=>{}); }
  GATE.cmode=null; GATE.msg=""; enterProfile(PROFILE);
}
async function cloudSignOut(){
  cloudFlush(); try{ await window.CLOUD.signOut(); }catch(e){}
  Object.assign(CLOUDSTORE,{on:false,cache:{},timers:{},profile:null}); PROFILE=null; EX=null; GATE.cmode=null; GATE.mode=null; GATE.msg=""; renderProfileBox(); VIEW="gate"; render();
}
function renderCloudGate(){
  const C=window.CLOUD||{}; const f=GATE.form||(GATE.form={}); const m=GATE.cmode;
  const back=`<button type="button" class="btn ghost sm" id="gBack">← Back</button>`;
  const err=`<p class="err" id="gErr" aria-live="polite">${esc(GATE.msg||"")}</p>`;
  let body="";
  if(m==="loading") body=`<p class="loading" style="text-align:left;padding:8px 0">Signing you in…</p>`;
  else if(m==="failed") body=`<p class="err">The sign-in service could not start. ${esc(GATE.msg)}</p><p class="m">If you set this site up yourself, check js/config.js (README, step 2). Otherwise, check your internet connection and reload.</p>`;
  else if(m==="sent"){ const pd=C.pending&&C.pending.get(); body=`<h2>Check your email</h2><p style="margin:0">We sent a sign-in link to <b class="em">${esc(pd?pd.email:"")}</b>. Open it <b>on this device, in this browser</b> to continue.</p><p class="m" style="margin:0">It can take a minute. Check your Spam or Promotions folder if you don’t see it.</p>${err}<div class="row"><button class="btn" id="gResend">Send the link again</button><button class="btn ghost" id="gOther">Use a different email</button></div>`; }
  else if(m==="confirm") body=`<form id="cfForm" class="gform" novalidate><h2>Confirm your email</h2><p class="m" style="margin:0">You opened the sign-in link in a different browser. Enter the email address the link was sent to.</p><label for="cfEmail">Email address</label><input id="cfEmail" class="txt" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>${err}<button class="btn primary big" type="submit">Continue</button></form>`;
  else if(m==="linkerr"||m==="neterr") body=`${err}<div class="row"><button class="btn primary" id="gRetry">${m==="neterr"?"Try again":"Start again"}</button></div>`;
  else if(m==="finish") body=`<form id="fnForm" class="gform" novalidate><h2>Finish creating your profile</h2><p class="m" style="margin:0">Signed in as <b class="em">${esc(C.user?C.user.email:"")}</b>.</p>
      <label for="fName">Profile name</label><input id="fName" class="txt" type="text" maxlength="30" value="${esc(f.nName||"")}" required>
      <label for="fCode">Passcode</label><input id="fCode" class="txt" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="12" placeholder="6-digit passcode" required>
      ${err}<div class="row"><button class="btn primary big" type="submit" ${GATE.busy?"disabled":""}>${GATE.busy?"Checking…":"Create my profile"}</button><button type="button" class="btn ghost" id="gSignOut">Sign out</button></div></form>`;
  else if(GATE.mode==="ret") body=`${back}<form id="retForm" class="gform" novalidate><h2>Returning user</h2>
      <label for="rEmail">Email address</label><input id="rEmail" class="txt" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="name@example.com" value="${esc(f.rEmail||"")}" required>
      <label for="rPass">6-digit password</label><div class="pwrow"><input id="rPass" class="txt" type="password" inputmode="numeric" autocomplete="current-password" value="${esc(f.rPass||"")}" required><button type="button" class="btn ghost sm" data-show="rPass">Show</button></div>
      ${err}<button class="btn primary big" type="submit" ${GATE.busy?"disabled":""}>${GATE.busy?"Signing in…":"Sign in"}</button>
      <button type="button" class="linkbtn" id="gForgot" style="align-self:flex-start">Forgot password?</button></form>`;
  else if(GATE.mode==="new") body=`${back}<form id="newForm" class="gform" novalidate><h2>New user</h2>
      <label for="nName">Profile name</label><input id="nName" class="txt" type="text" autocomplete="name" maxlength="30" placeholder="e.g. Rina" value="${esc(f.nName||"")}" required>
      <label for="nEmail">Email address</label><input id="nEmail" class="txt" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="name@example.com" value="${esc(f.nEmail||"")}" required>
      <label for="nPass">Choose a 6-digit password</label><div class="pwrow"><input id="nPass" class="txt" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" placeholder="6 digits, e.g. 482915" value="${esc(f.nPass||"")}" required><button type="button" class="btn ghost sm" data-show="nPass">Show</button></div>
      <label for="nCode">Invitation passcode (given to you)</label><input id="nCode" class="txt" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="12" placeholder="Passcode you received" value="${esc(f.nCode||"")}" required>
      <p class="m" style="margin:0">The invitation passcode is used only once. After this, sign in as a returning user with your email and your own 6-digit password, on any device.</p>
      ${err}<button class="btn primary big" type="submit" ${GATE.busy?"disabled":""}>${GATE.busy?"Creating your profile…":"Create my profile"}</button></form>`;
  else body=`<div class="choice">
      <button class="choicebtn" data-mode="new"><span class="ct">New user</span><span class="m">First time here? Create your profile with your name, email and the passcode you were given.</span></button>
      <button class="choicebtn" data-mode="ret"><span class="ct">Returning user</span><span class="m">Already registered? Sign in with your email and password. Works on any phone or computer.</span></button></div>`;
  $("#app").innerHTML=`<div class="gate card"><div><h1>IDO Practice Room</h1><p class="lead">Practice for the WBPSC Industrial Development Officer exam: daily quizzes, timed mock tests, previous year papers and progress charts.</p></div>${body}
    <p class="m small" style="margin:0">Your progress is saved to your account and syncs across devices.</p></div>`;
  const fail=msg=>{ GATE.msg=msg; const el=$("#gErr"); if(el) el.textContent=msg; };
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{ GATE.mode=b.dataset.mode; GATE.msg=""; render(); const i=$("#app input"); if(i) i.focus(); });
  const on=(id,fn)=>{ const el=$(id); if(el) el.onclick=fn; };
  on("#gBack",()=>{ GATE.mode=null; GATE.msg=""; render(); });
  on("#gOther",()=>{ C.pending.clear(); GATE.cmode=null; GATE.msg=""; render(); });
  on("#gResend",async()=>{ const pd=C.pending.get(); if(!pd) return; try{ await C.sendLink(pd.email,pd); fail("Sent again. Check your inbox."); }catch(e){ fail(cloudErrMsg(e)); } });
  on("#gRetry",()=>{ GATE.msg=""; if(GATE.cmode==="neterr") afterAuth(); else { GATE.cmode=null; render(); } });
  on("#gSignOut",()=>cloudSignOut());
  const sendFlow=async(email,info)=>{ GATE.busy=true; GATE.msg=""; render(); try{ await C.sendLink(email,info); GATE.busy=false; GATE.cmode="sent"; GATE.mode=null; GATE.form={}; render(); }catch(e){ GATE.busy=false; render(); fail(cloudErrMsg(e)); } };
  document.querySelectorAll("[data-show]").forEach(b=>b.onclick=()=>{ const i=$("#"+b.dataset.show); const s=i.type==="password"; i.type=s?"text":"password"; b.textContent=s?"Hide":"Show"; });
  const rf=$("#retForm"); if(rf) rf.onsubmit=async e=>{ e.preventDefault(); if(GATE.busy) return; const em=normEmail($("#rEmail").value), pw=$("#rPass").value; f.rEmail=em; f.rPass=pw;
    if(!validEmail(em)) return fail("Enter a valid email address, like name@example.com."); if(!pw) return fail("Enter your password.");
    GATE.busy=true; GATE.msg=""; render(); try{ await C.login(em,pw); GATE.busy=false; GATE.form={}; await afterAuth(); }catch(x){ GATE.busy=false; render(); fail(cloudErrMsg(x)); } };
  on("#gForgot",async()=>{ const em=normEmail(($("#rEmail")||{}).value); if(!validEmail(em)) return fail("Type your email address above first, then tap Forgot password."); f.rEmail=em;
    try{ await C.resetPassword(em); fail("If an account exists for "+em+", a password-reset email is on its way. Open it, choose a new password, then sign in here. Check Spam if you don’t see it."); }catch(x){ fail(cloudErrMsg(x)); } });
  const nf=$("#newForm"); if(nf) nf.onsubmit=async e=>{ e.preventDefault(); if(GATE.busy) return; const name=$("#nName").value.trim().replace(/\s+/g," "), em=normEmail($("#nEmail").value), pw=$("#nPass").value, code=$("#nCode").value.trim(); Object.assign(f,{nName:name,nEmail:em,nCode:code,nPass:pw});
    if(!name) return fail("Enter a profile name."); if(!validEmail(em)) return fail("Enter a valid email address, like name@example.com."); if(!/^\d{6}$/.test(pw)) return fail("Your password must be exactly 6 digits (numbers only)."); if(!/^\d{4,12}$/.test(code)) return fail("Enter the passcode you were given (digits only).");
    GATE.busy=true; GATE.msg=""; render();
    try{ await C.register(em,pw); }catch(x){ GATE.busy=false; render(); return fail(cloudErrMsg(x)); }
    const r=await C.createProfile(name,code); GATE.busy=false;
    if(!r.ok){ GATE.cmode="finish"; GATE.form={nName:name}; GATE.msg=reasonMsg(r)+" Your account was created; enter a valid passcode to finish."; render(); return; }
    let prof=null; try{ prof=await C.getProfile(); }catch(x){} if(!prof){ render(); return fail("Profile saved, but could not be read back. Reload the page."); }
    GATE.form={}; await openCloudProfile(prof); };
  const cf=$("#cfForm"); if(cf) cf.onsubmit=async e=>{ e.preventDefault(); const em=normEmail($("#cfEmail").value); if(!validEmail(em)) return fail("Enter a valid email address."); GATE.cmode="loading"; render(); try{ await C.completeLink(em); await afterAuth(); }catch(x){ GATE.cmode="linkerr"; GATE.msg=cloudErrMsg(x); render(); } };
  const ff=$("#fnForm"); if(ff) ff.onsubmit=async e=>{ e.preventDefault(); if(GATE.busy) return; const name=$("#fName").value.trim().replace(/\s+/g," "), code=$("#fCode").value.trim(); f.nName=name;
    if(!name) return fail("Enter a profile name."); if(!/^\d{4,12}$/.test(code)) return fail("Enter the passcode you were given (digits only).");
    GATE.busy=true; GATE.msg=""; render(); const r=await C.createProfile(name,code); GATE.busy=false;
    if(!r.ok){ render(); return fail(reasonMsg(r)); }
    let prof=null; try{ prof=await C.getProfile(); }catch(x){} if(!prof){ render(); return fail("Profile saved, but could not be read back. Reload the page."); }
    await openCloudProfile(prof); };
}
