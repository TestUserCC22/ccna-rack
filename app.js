"use strict";
/* CCNA Rack: offline study app for CCNA 200-301 v2.0. All data stays on this device. */

/* ---------- syllabus ---------- */
const DOMAINS=[
 {n:1,short:"Infra",name:"Network infrastructure and connectivity",w:25,topics:[["1.1","Diagnose interface and cable faults, copper and fiber"],["1.2","Hypervisors, virtual machines and containers"],["1.3","Troubleshoot IPv4 addressing and subnetting"],["1.4","Troubleshoot IPv6 addressing and prefix sizing"],["1.5","Wireless principles"],["1.6","Troubleshoot wired and wireless client connectivity"],["1.7","Troubleshoot DHCPv4 client, server and relay on IOS"]]},
 {n:2,short:"Switching",name:"Switching and network access",w:25,topics:[["2.1","Switch-to-switch and switch-to-router links"],["2.2","Layer 2 port settings: VLANs, PoE, port channels, LACP"],["2.3","Check documentation with CDP and LLDP"],["2.4","Troubleshoot Layer 2/3 with show, ping, traceroute, captures"],["2.5","Rapid PVST+ operation"]]},
 {n:3,short:"Routing",name:"IP routing",w:20,topics:[["3.1","Read a routing table to find the next hop"],["3.2","Troubleshoot IPv4 and IPv6 static routes"],["3.3","Single-area OSPFv2 and OSPFv3"],["3.4","HSRP and VRRP operational status"]]},
 {n:4,short:"Services",name:"Network services and security",w:20,topics:[["4.1","Local users and AAA clients (TACACS+, RADIUS)"],["4.2","Secure file transfer with SFTP and SCP"],["4.3","NAT and PAT on IOS XE routers"],["4.4","Diagnose DNS records (A, AAAA, CNAME, MX, NS, PTR)"],["4.5","IPsec remote-access and site-to-site VPNs"],["4.6","IPv4 ACLs: standard, extended, numbered, named"],["4.7","Layer 2 security features"]]},
 {n:5,short:"AI + Ops",name:"AI, network operations and management",w:10,topics:[["5.1","Agentic AI in network operations"],["5.2","Choosing a prompt for a generative AI system"],["5.3","Management approaches: device, cloud, controller, automation, IaC"],["5.4","What SNMP does"],["5.5","Configuration management with Ansible"],["5.6","Read syslog messages: content, severity, facility"]]}
];
const ALL=DOMAINS.flatMap(d=>d.topics.map(t=>({id:t[0],label:t[1],d})));
const TOPIC=id=>ALL.find(t=>t.id===id);
const B=window.BANK||{};
const V2_OPENS="2027-02-03", KEY="ccna-rack-v1";
const ST=["Not started","Learning","Confident"];
const RANKS=[[0,"Trainee"],[100,"Help Desk"],[300,"NOC Technician"],[700,"Network Admin"],[1500,"Network Engineer"],[3000,"Senior Engineer"],[6000,"Network Architect"]];
const RM=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- dates ---------- */
const iso=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const today=()=>iso(new Date());
const parse=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const nice=s=>parse(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
const shortDate=s=>parse(s).toLocaleDateString(undefined,{day:"numeric",month:"short"});

/* ---------- state ---------- */
const DEF={v:1,exam:"2027-02-17",status:{},lab:{},miss:{},qstat:{},cards:{},act:{},mocks:[],subnet:{n:0,ok:0},cmd:{n:0,ok:0},xp:0,newPerDay:10,newDone:{},sound:true,skin:"teal",theme:"auto",timer:null,hideInstall:false};
const clone=o=>JSON.parse(JSON.stringify(o));
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||"null");if(v&&v.v===1)return Object.assign(clone(DEF),v)}catch(e){}return clone(DEF)}
let S=load(), P=null, booted=false, lastRoute=null, installEvt=null, AC=null, pendingConfirm=null;
let storageOk=true;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));storageOk=true}catch(e){if(storageOk)toast("Progress could not be saved on this device. Make a backup under Settings.");storageOk=false}}

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const hashOf=id=>"t-"+id.replace(".","-");

/* ---------- derived ---------- */
const stOf=id=>S.status[id]||0;
const domainPct=d=>d.topics.reduce((a,t)=>a+stOf(t[0])/2,0)/d.topics.length;
const overallPct=()=>DOMAINS.reduce((a,d)=>a+d.w*domainPct(d),0);
function accuracy(){let s=0,w=0;Object.values(S.qstat).forEach(q=>{s+=q.s;w+=q.w});return s?(s-w)/s:0}
function readiness(){
  const cov=overallPct(),ms=S.mocks.slice(0,3);
  const mock=ms.length?ms.reduce((a,m)=>a+m.right/m.total,0)/ms.length*100:0;
  const labs=ALL.filter(t=>S.lab[t.id]).length/ALL.length*100;
  const score=Math.round(cov*.4+mock*.4+labs*.1+accuracy()*100*.1);
  return {score,verdict:score>=80?"Ready to book":score>=60?"Close":"Not yet"};
}
function studiedOn(d){const a=S.act[d];return !!(a&&(a.n||a.m))}
function streak(){let n=0,d=today();if(!studiedOn(d))d=addDays(d,-1);while(studiedOn(d)){n++;d=addDays(d,-1)}return n}
function nextTopic(){
  const open=ALL.filter(t=>stOf(t.id)<2);if(!open.length)return null;
  return open.slice().sort((a,b)=>((S.miss[b.id]||0)-(S.miss[a.id]||0))||(stOf(b.id)-stOf(a.id)))[0];
}
function act(kind,n){const d=today();const a=S.act[d]||{n:0,m:0};if(kind==="m")a.m+=n;else a.n+=(n||1);S.act[d]=a}
function rankOf(x){let i=0;RANKS.forEach((r,k)=>{if(x>=r[0])i=k});return i}
function xp(n){
  if(!n)return;const before=rankOf(S.xp);S.xp=Math.max(0,S.xp+n);const after=rankOf(S.xp);
  if(after>before){setTimeout(()=>{toast("Promoted to "+RANKS[after][1]+"!");sfx("level");burstAt(innerWidth/2,innerHeight/3,44)},250)}
}

/* ---------- cards ---------- */
function cardOf(id){
  const m=id.match(/^b:(\d\.\d):(\d+)$/);
  if(m){const t=B[m[1]],c=t&&t.c[+m[2]];return c?{topic:m[1],f:c[0],b:c[1]}:null}
  const q=id.match(/^q:(\d\.\d)#(\d+)$/);
  if(q){const t=B[q[1]],x=t&&t.q[+q[2]];return x?{topic:q[1],f:x[0],b:x[1][x[2]]+"\n\n"+x[3]}:null}
  return null;
}
function dueIds(){const d=today();return Object.keys(S.cards).filter(id=>S.cards[id].due<=d&&cardOf(id))}
function newIds(){
  const order=ALL.slice().sort((a,b)=>(stOf(b.id)>0)-(stOf(a.id)>0));
  const out=[];order.forEach(t=>((B[t.id]||{}).c||[]).forEach((_,i)=>{const id="b:"+t.id+":"+i;if(!S.cards[id])out.push(id)}));
  return out;
}
function newLeft(){return Math.max(0,S.newPerDay-(S.newDone[today()]||0))}
function cardsToday(){return dueIds().length+Math.min(newLeft(),newIds().length)}

/* ---------- sound and effects ---------- */
function sfx(k){
  if(!S.sound)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();const t=AC.currentTime;
    const seq={ok:[[880,0,.08],[1320,.07,.1]],bad:[[170,0,.18]],tick:[[700,0,.05]],flip:[[520,0,.04]],done:[[660,0,.12],[880,.12,.12],[1320,.24,.28]],level:[[523,0,.1],[659,.1,.1],[784,.2,.1],[1047,.3,.35]]}[k]||[];
    seq.forEach(([f,d,l])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=k==="bad"?"sawtooth":"triangle";o.frequency.value=f;
      g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(k==="bad"?.04:.07,t+d+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d+l);
      o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+l+.03)});
  }catch(e){}
}
function buzz(ms){try{if(S.sound&&navigator.vibrate)navigator.vibrate(ms)}catch(e){}}
function burstAt(x,y,n){
  if(RM)return;const box=document.createElement("div");box.className="burst";
  const cols=["var(--led-green)","var(--led-amber)","var(--accent)"];
  for(let i=0;i<n;i++){const p=document.createElement("i"),a=Math.random()*Math.PI*2,d=40+Math.random()*120;
    p.style.cssText=`left:${x}px;top:${y}px;background:${cols[i%3]};--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-30}px;--r:${Math.random()*540-270}deg`;box.appendChild(p)}
  document.body.appendChild(box);setTimeout(()=>box.remove(),1000);
}
function burstFrom(el,n){if(typeof el==="string")el=$(el);if(!el)return;const r=el.getBoundingClientRect();burstAt(r.left+r.width/2,r.top+r.height/2,n||22)}
let toastT=null;
function toast(msg,btn,fn){
  document.querySelectorAll(".toast").forEach(t=>t.remove());clearTimeout(toastT);
  const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;
  if(btn){const b=document.createElement("button");b.textContent=btn;b.onclick=()=>{t.remove();fn()};t.appendChild(b)}
  document.body.appendChild(t);toastT=setTimeout(()=>t.remove(),btn?9000:3200);
}
function countUp(){
  if(RM)return;
  document.querySelectorAll("#view .tile b").forEach(el=>{
    const m=el.textContent.match(/^(\d+)(.*)$/);if(!m||!+m[1])return;
    const n=+m[1],suf=m[2],t0=performance.now();
    (function f(t){const k=Math.min(1,(t-t0)/700),e=1-Math.pow(1-k,3);el.textContent=Math.round(n*e)+suf;if(k<1&&el.isConnected)requestAnimationFrame(f)})(t0);
  });
}
setInterval(()=>{if(RM||document.hidden)return;const ps=document.querySelectorAll('.port[data-s="2"]');if(!ps.length)return;const p=ps[Math.floor(Math.random()*ps.length)];p.classList.add("tx");setTimeout(()=>p.classList.remove("tx"),70)},170);

/* ---------- shared pieces ---------- */
function faceplate(){
  let i=0;const boot=!booted;booted=true;
  return `<section class="plate ${boot?"boot":""}" aria-label="Exam topics as switch ports">
    <div class="top"><h1>AOS-2029 <span>· 200-301</span></h1>
      <div class="leds"><span class="led on"><i></i>SYST</span><span class="led ${S.timer?"wait":""}"><i></i>STUDY</span><span class="led ${readiness().score>=80?"on":""}"><i></i>READY</span></div></div>
    <div class="groups">${DOMAINS.map(d=>`<div class="group"><div class="cap"><span>${d.n}.0 ${esc(d.short)}</span><span>${Math.round(domainPct(d)*100)}%</span></div><div class="ports">${d.topics.map(t=>`<button class="port" style="--i:${i++}" data-s="${stOf(t[0])}" ${S.miss[t[0]]&&stOf(t[0])<2?"data-m":""} data-go="${hashOf(t[0])}" aria-label="Topic ${t[0]}: ${esc(t[1])}, ${ST[stOf(t[0])]}"><i></i><b></b><span>${t[0]}</span></button>`).join("")}</div></div>`).join("")}</div>
  </section>`;
}
function statusPill(id){const s=stOf(id);return `<span class="pill ${s===2?"good":s===1?"warn":""}">${ST[s]}</span>`}
function timeLeft(){if(!S.timer)return 0;return Math.max(0,S.timer.end-Date.now())}
function fmt(ms){const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}

/* ---------- routing ---------- */
const ICONS={
 home:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M11 10v4M15 10v4"/></svg>',
 topics:'<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg>',
 practice:'<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
 cards:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="14" height="12" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/></svg>',
 stats:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
};
function route(){const h=location.hash.replace("#","");return h||"home"}
function go(h){if(location.hash.replace("#","")===h)render(true);else location.hash=h}
function renderTabs(){
  const r=route(),top=r.startsWith("t-")?"topics":r==="settings"?"":r;
  const due=cardsToday();
  $("#tabs").innerHTML=[["home","Home"],["topics","Topics"],["practice","Practice"],["cards","Cards"],["stats","Stats"]].map(([k,l])=>`<a href="#${k}" ${top===k?'aria-current="page"':""}>${ICONS[k]}${l}${k==="cards"&&due?`<b>${due>99?"99+":due}</b>`:""}</a>`).join("");
  const tl=timeLeft();
  $("#chips").innerHTML=`${S.timer?`<a class="chip timer" href="#practice" id="tchip"><i>●</i><span id="tclock">${fmt(tl)}</span></a>`:""}<a class="chip" href="#stats" title="${S.xp} XP">L${rankOf(S.xp)+1}<span class="rk"> · ${esc(RANKS[rankOf(S.xp)][1])}</span></a><a class="chip" href="#settings" aria-label="Settings">⚙</a>`;
}
function render(force){
  const r=route(),v=$("#view");
  const a=document.activeElement;
  if(!force&&a&&a.tagName==="INPUT"&&a.type==="text"&&a.value)return;
  renderTabs();
  const entering=r!==lastRoute;lastRoute=r;
  let html;
  if(r==="home")html=viewHome();
  else if(r==="topics")html=viewTopics();
  else if(r.startsWith("t-")){const t=TOPIC(r.slice(2).replace("-","."));html=t?viewTopic(t):viewTopics()}
  else if(r==="practice")html=viewPractice();
  else if(r==="cards")html=viewCards();
  else if(r==="stats")html=viewStats();
  else if(r==="settings")html=viewSettings();
  else html=viewHome();
  v.classList.toggle("enter",entering&&!RM);
  v.innerHTML=html;
  if(entering){window.scrollTo(0,0);countUp()}
}

/* ---------- views ---------- */
function viewHome(){
  const left=daysBetween(today(),S.exam),nt=nextTopic(),R=readiness(),due=cardsToday();
  const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  let install="";
  if(!standalone&&!S.hideInstall){
    if(installEvt)install=`<div class="note row between"><span>Install CCNA Rack as an app for offline use.</span><span class="row"><button class="btn small primary" data-act="install">Install</button><button class="btn small ghost" data-act="hide-install">Not now</button></span></div>`;
    else if(ios)install=`<div class="note row between"><span>To install: tap the Share button in Safari, then Add to Home Screen.</span><button class="btn small ghost" data-act="hide-install">OK</button></div>`;
  }
  return `${install}${faceplate()}
  <div class="tiles">
    <div class="tile"><b>${Math.round(overallPct())}%</b><span>of the exam covered</span></div>
    <div class="tile"><b>${R.score}</b><span>readiness · ${R.verdict.toLowerCase()}</span></div>
    <div class="tile"><b>${streak()}</b><span>day streak</span></div>
    <div class="tile"><b>${left}</b><span>days to ${shortDate(S.exam)}</span></div>
  </div>
  <section class="card">
    <h2>Study next</h2>
    ${nt?`<a class="trow" style="border:0;padding:0" href="#${hashOf(nt.id)}"><span class="mono">${nt.id}</span><span>${esc(nt.label)}</span>${statusPill(nt.id)}</a>
    <div class="grid2"><a class="btn primary" href="#${hashOf(nt.id)}">Read the note</a><button class="btn" data-act="quiz" data-id="${nt.id}">Quiz this topic</button></div>`:`<div>Every topic is marked confident. Run full mock exams until you score 85% or more.</div>`}
  </section>
  <div class="grid2">
    <button class="btn action" data-act="cards-today"><b>Flashcards</b><span>${due?due+" ready today":"All done for today"}</span></button>
    <button class="btn action" data-act="mock"><b>Quick mock</b><span>10 questions, all domains</span></button>
    <button class="btn action" data-act="subnet"><b>Subnetting</b><span>${S.subnet.n?Math.round(S.subnet.ok/S.subnet.n*100)+"% right so far":"Random drills"}</span></button>
    <button class="btn action" data-act="focus" data-m="25"><b>Focus 25</b><span>${S.timer?"Running now":"Timed study session"}</span></button>
  </div>`;
}
function viewTopics(){
  return `<div><p class="title">Topics</p><p class="sub">29 topics in five domains, weighted like the exam.</p></div>
  ${DOMAINS.map(d=>`<section class="card domain">
    <div class="dhead"><b>${d.n}.0 ${esc(d.name)}</b><span class="mono">${d.w}%</span><div class="bar"><i style="width:${domainPct(d)*100}%"></i></div></div>
    ${d.topics.map(t=>`<a class="trow" href="#${hashOf(t[0])}"><span class="mono">${t[0]}</span><span>${esc(t[1])}${S.miss[t[0]]?` <span class="pill bad">${S.miss[t[0]]} missed</span>`:""}${S.lab[t[0]]?` <span class="pill">lab ✓</span>`:""}</span><span class="dot" data-s="${stOf(t[0])}" aria-label="${ST[stOf(t[0])]}"></span></a>`).join("")}
  </section>`).join("")}`;
}
function viewTopic(t){
  const b=B[t.id]||{q:[],c:[],k:[]},seen=b.q.map((_,i)=>S.qstat[t.id+"#"+i]).filter(Boolean);
  const s=seen.reduce((a,x)=>a+x.s,0),w=seen.reduce((a,x)=>a+x.w,0);
  const ids=ALL.map(x=>x.id),i=ids.indexOf(t.id);
  return `<div><a class="btn small ghost" href="#topics">‹ All topics</a></div>
  <div><span class="silk">${t.d.n}.0 ${esc(t.d.name)} · ${t.d.w}%</span><p class="title"><span class="mono" style="font-size:.8em">${t.id}</span> ${esc(t.label)}</p></div>
  <div class="seg" role="group" aria-label="Your status for this topic">${ST.map((l,k)=>`<button data-act="set-status" data-id="${t.id}" data-s="${k}" aria-pressed="${stOf(t.id)===k}">${l}</button>`).join("")}</div>
  <section class="card"><h2>Study note</h2><div class="prose">${esc(b.n)}</div></section>
  <div class="grid2">
    <button class="btn action" data-act="quiz" data-id="${t.id}"><b>Quiz</b><span>${b.q.length} questions${s?` · ${Math.round((s-w)/s*100)}% right so far`:""}</span></button>
    <button class="btn action" data-act="topic-cards" data-id="${t.id}"><b>Flashcards</b><span>${b.c.length} cards${Object.keys(S.cards).filter(k=>k.startsWith("q:"+t.id+"#")).length?" + your missed questions":""}</span></button>
    ${b.k.length?`<button class="btn action" data-act="cmd" data-id="${t.id}"><b>IOS commands</b><span>${b.k.length} command drills</span></button>`:""}
    <button class="btn action" data-act="lab" data-id="${t.id}"><b>${S.lab[t.id]?"Lab done ✓":"Mark lab done"}</b><span>${S.lab[t.id]?"Tap to undo":"After you finish the lab below"}</span></button>
  </div>
  <section class="card"><h2>Lab</h2><div class="prose">${esc(b.l)}</div><div class="empty">Cisco Packet Tracer is free from Cisco Networking Academy.</div></section>
  <div class="row between">${i>0?`<a class="btn small" href="#${hashOf(ids[i-1])}">‹ ${ids[i-1]}</a>`:"<span></span>"}${i<ids.length-1?`<a class="btn small" href="#${hashOf(ids[i+1])}">${ids[i+1]} ›</a>`:""}</div>`;
}
function viewPractice(){
  if(P)return viewSession();
  const tl=timeLeft();
  return `<div><p class="title">Practice</p><p class="sub">Everything works offline.</p></div>
  <div class="grid2">
    <button class="btn action" data-act="mock"><b>Quick mock</b><span>10 questions across all domains</span></button>
    <button class="btn action" data-act="mock-full"><b>Full mock</b><span>60 questions, 72 minutes, scored at the end</span></button>
    <button class="btn action" data-act="weak"><b>Weak spots</b><span>10 questions you missed or never saw</span></button>
    <button class="btn action" data-act="cmd-mix"><b>IOS commands</b><span>10 mixed command drills</span></button>
    <button class="btn action" data-act="subnet"><b>Subnetting</b><span>Network, broadcast, hosts</span></button>
    <button class="btn action" data-act="cards-today"><b>Flashcards</b><span>${cardsToday()} ready today</span></button>
  </div>
  <section class="card">
    <h2>Focus timer</h2>
    ${S.timer?`${ring(tl,S.timer.min)}<div class="row" style="justify-content:center"><button class="btn" data-act="focus-stop">Stop</button></div>`
    :`<div class="empty">Study without your phone pulling you away. Finished sessions count towards your streak and XP.</div><div class="grid2"><button class="btn primary" data-act="focus" data-m="25">25 minutes</button><button class="btn" data-act="focus" data-m="50">50 minutes</button></div>`}
  </section>`;
}
function ring(ms,min){const r=62,C=2*Math.PI*r,f=ms/(min*60000);return `<svg class="ring" viewBox="0 0 150 150" role="img" aria-label="Time left"><circle class="bgc" cx="75" cy="75" r="${r}"/><circle class="fg" id="ringfg" cx="75" cy="75" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-f)).toFixed(1)}"/><text x="75" y="84" id="ringtxt">${fmt(ms)}</text></svg>`}

/* ---------- sessions ---------- */
function qObj(topic,i){
  const x=B[topic].q[i],order=shuffle([0,1,2,3]);
  return {id:topic+"#"+i,topic,q:x[0],opts:order.map(k=>x[1][k]),ans:order.indexOf(x[2]),why:x[3]};
}
function weight(id){const s=S.qstat[id];if(!s)return 2+Math.random();return s.w/s.s+Math.random()*.6}
function pickFrom(pool,n){return pool.map(x=>({x,w:weight(x.topic+"#"+x.i)})).sort((a,b)=>b.w-a.w).slice(0,n).map(o=>o.x)}
function poolOf(d){return d.topics.flatMap(t=>(B[t[0]]?B[t[0]].q:[]).map((_,i)=>({topic:t[0],i})))}
function startQuiz(id){
  const b=B[id];if(!b)return;
  P={kind:"quiz",title:"Quiz · "+id,topic:id,qs:shuffle(b.q.map((_,i)=>qObj(id,i))),i:0,ans:{},exam:false};go("practice");
}
function startMock(full){
  const mix=full?[15,15,12,12,6]:[3,2,2,2,1];
  let qs=DOMAINS.flatMap((d,k)=>pickFrom(poolOf(d),mix[k])).map(o=>qObj(o.topic,o.i));qs=shuffle(qs);
  P={kind:"mock",title:full?"Full mock exam":"Quick mock",qs,i:0,ans:{},exam:full,endAt:full?Date.now()+qs.length*72000:0};go("practice");
}
function startWeak(){
  const pool=DOMAINS.flatMap(poolOf);
  const qs=pickFrom(pool,10).map(o=>qObj(o.topic,o.i));
  P={kind:"mock",title:"Weak spots",qs:shuffle(qs),i:0,ans:{},exam:false};go("practice");
}
function finishQuiz(){
  if(P.done)return;P.done=true;P.finishedAt=Date.now();
  let right=0;const byDom={};
  P.qs.forEach((q,k)=>{
    const ok=P.ans[k]===q.ans;if(ok)right++;
    const st=S.qstat[q.id]||{s:0,w:0};st.s++;if(!ok){st.w++;S.miss[q.topic]=(S.miss[q.topic]||0)+1;const cid="q:"+q.id;if(!S.cards[cid])S.cards[cid]={iv:0,due:today()};else S.cards[cid].due=today()}S.qstat[q.id]=st;
    const dn=q.topic[0];byDom[dn]=byDom[dn]||[0,0];byDom[dn][1]++;if(ok)byDom[dn][0]++;
  });
  P.right=right;P.byDom=byDom;
  if(P.kind==="quiz"&&stOf(P.topic)===0)S.status[P.topic]=1;
  if(P.kind==="mock"&&P.title!=="Weak spots"){S.mocks.unshift({at:today(),right,total:P.qs.length,full:!!P.exam});S.mocks=S.mocks.slice(0,30)}
  act("n");xp(right*3);save();
  if(right===P.qs.length){sfx("done");setTimeout(()=>burstFrom("#score",44),80)}else sfx("done");
}
function viewSession(){
  if(P.kind==="cards")return viewCardSession();
  if(P.kind==="cmd")return viewCmdSession();
  if(P.kind==="subnet")return viewSubnet();
  const head=`<div class="row between"><div><span class="silk">${esc(P.title)}</span></div><button class="btn small ghost" data-act="quit">${P.done?"Close":"Quit"}</button></div>`;
  if(P.done)return head+viewResults();
  const q=P.qs[P.i],a=P.ans[P.i],shown=!P.exam&&a!==undefined;
  const answered=Object.keys(P.ans).length;
  return `${head}
  ${P.exam?`<div class="row between"><span class="mono" id="examclock">${fmt(P.endAt-Date.now())} left</span><span class="mono empty">${answered}/${P.qs.length} answered</span></div>`:`<div class="bar"><i style="width:${(P.i+(shown?1:0))/P.qs.length*100}%"></i></div>`}
  <section class="card qcard ${P.anim?"next":""}">
    <div class="row between"><span class="mono empty">Question ${P.i+1} of ${P.qs.length}</span>${shown||P.kind==="quiz"?`<span class="pill">${q.topic}</span>`:""}</div>
    <p class="qtext">${esc(q.q)}</p>
    <div class="opts">${q.opts.map((o,j)=>`<button class="btn opt ${shown&&j===q.ans?"right":""} ${shown&&a===j&&j!==q.ans?"wrong":""} ${P.exam&&a===j?"sel":""} ${shown&&P.just===P.i&&(j===q.ans||j===a)?"just":""}" data-act="ans" data-j="${j}" ${shown?"disabled":""}>${esc(o)}</button>`).join("")}</div>
    ${shown?`<p class="why ${P.just===P.i?"just":""}"><b style="color:${a===q.ans?"var(--good)":"var(--bad)"}">${a===q.ans?"Correct.":"Not quite."}</b> ${esc(q.why)}</p>`:""}
  </section>
  ${P.exam?`<div class="row between"><button class="btn" data-act="qprev" ${P.i?"":"disabled"}>‹ Back</button><button class="btn" data-act="qnext" ${P.i<P.qs.length-1?"":"disabled"}>Next ›</button></div>
    <div class="qnav">${P.qs.map((_,k)=>`<button data-act="qjump" data-k="${k}" class="${P.ans[k]!==undefined?"a":""} ${k===P.i?"cur":""}" aria-label="Question ${k+1}">${k+1}</button>`).join("")}</div>
    <button class="btn primary block" data-act="finish">Finish and score</button>`
  :shown?`<button class="btn primary block" data-act="qnext-learn">${P.i<P.qs.length-1?"Next question ›":"See results"}</button>`:""}`;
}
function viewResults(){
  const n=P.qs.length,pct=Math.round(P.right/n*100),wrong=P.qs.map((q,k)=>({q,k})).filter(o=>P.ans[o.k]!==o.q.ans);
  return `<section class="card" id="score" style="align-items:center;text-align:center">
    <span class="silk">${esc(P.title)}</span>
    <b class="mono" style="font-size:48px;line-height:1">${pct}%</b>
    <span>${P.right} of ${n} right${P.exam&&P.finishedAt?` · ${fmt(P.finishedAt-(P.endAt-n*72000))} used`:""}</span>
    ${P.kind!=="quiz"?`<span class="pill ${pct>=85?"good":pct>=70?"warn":"bad"}">${pct>=85?"Exam level":pct>=70?"Getting close":"Keep studying"}</span>`:""}
  </section>
  ${P.kind!=="quiz"?`<section class="card"><h2>By domain</h2>${DOMAINS.filter(d=>P.byDom[d.n]).map(d=>`<div class="dhead" style="margin:0"><b>${d.n}.0 ${esc(d.short)}</b><span class="mono">${P.byDom[d.n][0]}/${P.byDom[d.n][1]}</span><div class="bar"><i style="width:${P.byDom[d.n][0]/P.byDom[d.n][1]*100}%"></i></div></div>`).join("")}</section>`:""}
  ${P.kind==="quiz"&&P.right===n&&stOf(P.topic)<2?`<button class="btn primary" data-act="set-status" data-id="${P.topic}" data-s="2">Perfect score. Mark ${P.topic} confident</button>`:""}
  ${wrong.length?`<section class="card"><h2>Review your mistakes</h2><div class="empty">They are now in your flashcards.</div>${wrong.map(o=>`<div style="border-top:1px dashed var(--line);padding-top:10px"><p style="margin:0 0 6px;font-weight:500">${esc(o.q.q)}</p><p class="why" style="color:var(--bad)">You: ${P.ans[o.k]===undefined?"no answer":esc(o.q.opts[P.ans[o.k]])}</p><p class="why" style="color:var(--good)">Right: ${esc(o.q.opts[o.q.ans])}</p><p class="why">${esc(o.q.why)}</p></div>`).join("")}</section>`:""}
  <div class="grid2"><button class="btn primary" data-act="again">Go again</button><button class="btn" data-act="quit">Done</button></div>`;
}

/* cards */
function startCards(ids,title){
  if(!ids.length){toast("No cards to review right now.");return}
  P={kind:"cards",title,queue:ids,show:false,done:0,total:ids.length};go("practice");
}
function startTodayCards(){
  const due=shuffle(dueIds()),nw=newIds().slice(0,newLeft());
  startCards(due.concat(nw),"Today's flashcards");
}
function viewCardSession(){
  const id=P.queue[0],c=id&&cardOf(id);
  const head=`<div class="row between"><span class="silk">${esc(P.title)}</span><button class="btn small ghost" data-act="quit">${c?"Quit":"Close"}</button></div>`;
  if(!c)return `${head}<section class="card" style="align-items:center;text-align:center" id="score"><b class="mono" style="font-size:40px">${P.done}</b><span>cards reviewed. Come back tomorrow for the next ones.</span></section><button class="btn primary" data-act="quit">Done</button>`;
  const isNew=!S.cards[id];
  return `${head}
  <div class="row between"><span class="mono empty">${P.queue.length} left</span><span class="row">${isNew?`<span class="pill">new</span>`:""}<span class="pill">${c.topic}</span></span></div>
  <div class="flash ${P.show?"shown":""} ${P.noanim?"noanim":""}" data-act="card-flip" role="button" tabindex="0" aria-label="${P.show?"Answer shown":"Show the answer"}">
    <div class="in"><div class="face front"><span class="silk">Question</span><p>${esc(c.f)}</p><span class="empty" style="margin-top:auto">Tap to flip</span></div>
    <div class="face back"><span class="silk">Answer</span><p>${esc(c.b)}</p></div></div>
  </div>
  ${P.show?`<div class="grid2" style="grid-template-columns:repeat(3,1fr)"><button class="btn" data-act="grade" data-g="0">Again</button><button class="btn primary" data-act="grade" data-g="1">Good</button><button class="btn" data-act="grade" data-g="2">Easy</button></div>`:`<button class="btn primary block" data-act="card-flip">Show answer</button>`}`;
}
function grade(g){
  const id=P.queue[0];if(!id)return;
  const wasNew=!S.cards[id],c=S.cards[id]||{iv:0,due:today()};
  if(wasNew){const d=today();S.newDone[d]=(S.newDone[d]||0)+1;Object.keys(S.newDone).forEach(k=>{if(k<addDays(d,-7))delete S.newDone[k]})}
  if(g===0){c.iv=0;c.due=today();P.queue.push(P.queue.shift())}
  else{c.iv=g===1?(c.iv?Math.round(c.iv*2.3):1):Math.max(4,Math.round((c.iv||1)*3.5));c.due=addDays(today(),c.iv);P.queue.shift();P.done++}
  S.cards[id]=c;act("n");if(g)xp(1);save();sfx(g?"tick":"bad");
  P.show=false;P.noanim=true;
}

/* commands */
const IFN=["gigabitethernet","fastethernet","tengigabitethernet","ethernet","serial","loopback","vlan","port-channel","tunnel"];
function normCmd(s){
  s=String(s).toLowerCase().trim().replace(/\s+/g," ").replace(/\b([a-z][a-z-]*)\s+(\d+\/[\d\/.]+)/g,"$1$2");
  return s.split(" ").map(tok=>{const m=tok.match(/^([a-z][a-z-]*)(\d[\d\/.]*)$/);if(m){const full=IFN.find(n=>n.startsWith(m[1]));if(full)return full+m[2]}return tok});
}
function cmdMatch(user,answers){
  const u=normCmd(user);if(!u.length||!u[0])return false;
  return answers.some(a=>{const t=normCmd(a);return t.length===u.length&&t.every((tok,i)=>tok===u[i]||(/^[a-z][a-z-]*$/.test(tok)&&u[i].length>=2&&tok.startsWith(u[i])))});
}
function startCmd(items,title){P={kind:"cmd",title,items:shuffle(items),i:0,res:[]};go("practice");setTimeout(()=>{const el=$("#cmdin");if(el)el.focus()},60)}
function cmdItems(id){return ((B[id]||{}).k||[]).map(k=>({topic:id,goal:k[0],prompt:k[1],ans:k[2],acc:k[3]}))}
function viewCmdSession(){
  const head=`<div class="row between"><span class="silk">${esc(P.title)}</span><button class="btn small ghost" data-act="quit">${P.i>=P.items.length?"Close":"Quit"}</button></div>`;
  const hist=P.res.map((r,k)=>{const it=P.items[k];return `<div class="goal">${k+1}. ${esc(it.goal)}</div><div>${esc(it.prompt)} <span class="${r.ok?"ok":"no"}">${esc(r.text)}</span> ${r.ok?'<span class="ok">✓</span>':'<span class="no">✗</span>'}</div>${r.ok?"":`<div class="ans">expected: ${esc(it.ans)}</div>`}`}).join("");
  if(P.i>=P.items.length){
    const ok=P.res.filter(r=>r.ok).length;
    return `${head}<section class="card" id="score" style="align-items:center;text-align:center"><b class="mono" style="font-size:44px">${ok}/${P.items.length}</b><span>commands right</span></section><div class="term">${hist}</div><div class="grid2"><button class="btn primary" data-act="again">Go again</button><button class="btn" data-act="quit">Done</button></div>`;
  }
  const it=P.items[P.i];
  return `${head}<div class="row between"><span class="mono empty">${P.i+1} of ${P.items.length}</span><span class="pill">${it.topic}</span></div>
  <div class="term">${hist}<div class="goal">${P.i+1}. ${esc(it.goal)}</div>
    <form data-form="cmd"><label for="cmdin">${esc(it.prompt)}</label><input id="cmdin" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Your command"></form></div>
  <div class="grid2"><button class="btn primary" data-act="cmd-check">Check</button><button class="btn" data-act="cmd-skip">Show answer</button></div>
  <div class="empty">Abbreviations work the way they do in IOS, for example "sh ip int br" or "gi0/1".</div>`;
}
function cmdSubmit(skip){
  const el=$("#cmdin");if(!el)return;const it=P.items[P.i],text=skip?"":el.value.trim();if(!text&&!skip)return;
  const ok=!skip&&cmdMatch(text,[it.ans].concat(it.acc||[]));
  P.res.push({text:skip?"(skipped)":text,ok});P.i++;S.cmd.n++;if(ok){S.cmd.ok++;xp(3)}else S.miss[it.topic]=(S.miss[it.topic]||0)+1;
  act("n");save();sfx(ok?"ok":"bad");if(!ok)buzz(60);
  render(true);const n=$("#cmdin");if(n)n.focus();else if(P.res.every(r=>r.ok))setTimeout(()=>burstFrom("#score",40),60);
}

/* subnetting */
function ipStr(n){return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".")}
function newSubnet(){
  const prefix=17+Math.floor(Math.random()*14),f=[10,172,192][Math.floor(Math.random()*3)];
  const second=f===172?16+Math.floor(Math.random()*16):f===192?168:Math.floor(Math.random()*256);
  const ip=f*16777216+second*65536+Math.floor(Math.random()*256)*256+1+Math.floor(Math.random()*253);
  const mask=(0xFFFFFFFF<<(32-prefix))>>>0,net=(ip&mask)>>>0,bc=(net|(~mask>>>0))>>>0;
  return {ip:ipStr(ip),prefix,mask:ipStr(mask),net:ipStr(net),bc:ipStr(bc),hosts:Math.pow(2,32-prefix)-2,res:null};
}
function startSubnet(){P={kind:"subnet",title:"Subnetting",q:newSubnet(),streak:0,n:0,ok:0};go("practice")}
function viewSubnet(){
  const q=P.q;
  return `<div class="row between"><span class="silk">Subnetting${P.n?` · ${P.ok}/${P.n} this round${P.streak>1?` · ${P.streak} in a row`:""}`:""}</span><button class="btn small ghost" data-act="quit">Close</button></div>
  <section class="card" id="score"><span class="empty">Host</span><b class="mono" style="font-size:26px">${q.ip}/${q.prefix}</b><span class="mono empty">mask ${q.mask}</span></section>
  <form class="subnet" data-form="subnet">
    <label>Network address<input type="text" id="sn-net" inputmode="decimal" autocomplete="off" ${q.res?"disabled":""} value="${q.res?esc(q.res.net):""}"></label>
    <label>Broadcast address<input type="text" id="sn-bc" inputmode="decimal" autocomplete="off" ${q.res?"disabled":""} value="${q.res?esc(q.res.bc):""}"></label>
    <label>Usable hosts<input type="text" id="sn-h" inputmode="numeric" autocomplete="off" ${q.res?"disabled":""} value="${q.res?esc(q.res.h):""}"></label>
    ${q.res?"":`<button class="btn primary">Check</button>`}
  </form>
  ${q.res?`<section class="card"><div class="row"><span class="pill ${q.res.ok?"good":"bad"}">${q.res.ok?"All correct":"Not quite"}</span></div><div class="mono">network ${q.net}<br>broadcast ${q.bc}<br>usable hosts ${q.hosts}</div><div class="empty">Block size ${256-Number(q.mask.split(".").find(x=>x!=="255")||0)} in the octet where the mask stops being 255.</div></section><button class="btn primary block" data-act="subnet-next">Next one ›</button>`:""}`;
}

/* focus */
function startFocus(min){S.timer={end:Date.now()+min*60000,min};save();sfx("tick");render(true);toast(`Focus session started: ${min} minutes.`)}
function stopFocus(){S.timer=null;save();render(true)}
function tick(){
  if(S.timer){
    const left=timeLeft();
    if(left<=0){const m=S.timer.min;S.timer=null;act("m",m);xp(m);save();sfx("done");buzz([120,80,120]);toast(`Focus session done: ${m} minutes logged.`);render(true);burstAt(innerWidth/2,120,36);return}
    const c=$("#tclock");if(c)c.textContent=fmt(left);
    const t=$("#ringtxt");if(t){t.textContent=fmt(left);const f=$("#ringfg"),C=2*Math.PI*62;f.setAttribute("stroke-dashoffset",(C*(1-left/(S.timer.min*60000))).toFixed(1))}
  }
  if(P&&P.exam&&!P.done){
    if(Date.now()>=P.endAt){finishQuiz();toast("Time is up. Your mock exam has been scored.");render(true)}
    else{const e=$("#examclock");if(e)e.textContent=fmt(P.endAt-Date.now())+" left"}
  }
}

function viewCards(){
  const due=dueIds().length,nl=Math.min(newLeft(),newIds().length),total=Object.keys(S.cards).length;
  const missed=Object.keys(S.cards).filter(k=>k.startsWith("q:")).length;
  return `<div><p class="title">Flashcards</p><p class="sub">Spaced repetition: cards you know come back less often.</p></div>
  <div class="tiles"><div class="tile"><b>${due}</b><span>due now</span></div><div class="tile"><b>${nl}</b><span>new today</span></div><div class="tile"><b>${total}</b><span>cards started</span></div><div class="tile"><b>${missed}</b><span>from missed questions</span></div></div>
  <button class="btn primary block" data-act="cards-today" ${due+nl?"":"disabled"}>${due+nl?`Review ${due+nl} cards`:"All done for today"}</button>
  <section class="card"><h2>By topic</h2><div class="empty">Cram one topic. Grading still updates the schedule.</div>
  ${DOMAINS.map(d=>`<div class="row" style="gap:6px">${d.topics.map(t=>`<button class="btn small" data-act="topic-cards" data-id="${t[0]}">${t[0]}</button>`).join("")}</div>`).join("")}</section>
  <section class="card"><h2>New cards per day</h2><div class="row"><input type="number" id="npd" min="0" max="50" value="${S.newPerDay}" data-change="npd" style="width:90px" aria-label="New cards per day"><span class="empty">Topics you marked learning or confident come first.</span></div></section>`;
}
function viewStats(){
  const end=today(),dow=(parse(end).getDay()+6)%7,cells=[];
  for(let d=addDays(end,-(7*15+dow));d<=end;d=addDays(d,1)){const a=S.act[d]||{n:0,m:0},v=a.n*5+a.m;cells.push(`<i data-l="${!v?0:v<20?1:v<60?2:3}" class="${d===end?"now":""}" title="${shortDate(d)}: ${a.n} activities, ${a.m} focus min"></i>`)}
  const R=readiness(),i=rankOf(S.xp),next=RANKS[i+1];
  const focus=Object.values(S.act).reduce((a,x)=>a+(x.m||0),0);
  return `<div><p class="title">Stats</p></div>
  <section class="card"><div class="row between"><h2>Rank</h2><span class="mono empty">${S.xp} XP</span></div><b style="font:700 22px/1 var(--display);letter-spacing:.06em;text-transform:uppercase">Level ${i+1} · ${RANKS[i][1]}</b><div class="bar"><i style="width:${next?(S.xp-RANKS[i][0])/(next[0]-RANKS[i][0])*100:100}%"></i></div><span class="empty">${next?`${next[0]-S.xp} XP to ${next[1]}`:"Top rank reached"}</span></section>
  <section class="card"><div class="row between"><h2>Readiness</h2><span class="pill ${R.score>=80?"good":R.score>=60?"warn":""}">${R.verdict}</span></div><b class="mono" style="font-size:36px;line-height:1">${R.score}</b><span class="empty">40% coverage, 40% your last three mocks, 10% labs, 10% question accuracy. Book the exam at 80 or more.</span></section>
  <section class="card"><div class="row between"><h2>Activity</h2><span class="mono empty">${streak()} day streak · ${focus} focus min</span></div>${heatWrap(cells)}</section>
  <div class="tiles"><div class="tile"><b>${Math.round(accuracy()*100)}%</b><span>question accuracy</span></div><div class="tile"><b>${S.cmd.n?Math.round(S.cmd.ok/S.cmd.n*100)+"%":"–"}</b><span>commands right</span></div><div class="tile"><b>${S.subnet.n?Math.round(S.subnet.ok/S.subnet.n*100)+"%":"–"}</b><span>subnets right</span></div><div class="tile"><b>${ALL.filter(t=>S.lab[t.id]).length}/29</b><span>labs done</span></div></div>
  <section class="card"><h2>Domains</h2>${DOMAINS.map(d=>`<div class="dhead" style="margin:0"><b>${d.n}.0 ${esc(d.short)}</b><span class="mono">${Math.round(domainPct(d)*100)}% · ${d.w}% of exam</span><div class="bar"><i style="width:${domainPct(d)*100}%"></i></div></div>`).join("")}</section>
  <section class="card"><h2>Mock exams</h2>${S.mocks.length?`<table class="mocks">${S.mocks.slice(0,10).map(m=>`<tr><td>${shortDate(m.at)}</td><td>${m.full?"Full":"Quick"}</td><td class="mono">${m.right}/${m.total} · ${Math.round(m.right/m.total*100)}%</td></tr>`).join("")}</table>`:`<div class="empty">No mocks yet. Aim for 85% on full mocks before booking.</div>`}</section>`;
}
const heatWrap=c=>`<div class="heat" role="img" aria-label="Study activity, last 16 weeks">${c.join("")}</div>`;
function viewSettings(){
  return `<div><p class="title">Settings</p></div>
  <section class="card"><h2>Exam date</h2><input type="date" id="exam" data-change="exam" value="${esc(S.exam)}" aria-label="Exam date">
  ${S.exam<V2_OPENS?`<div class="note">That date is before ${nice(V2_OPENS)}, when v2.0 starts. An earlier exam is v1.1, which this app does not cover.</div>`:""}</section>
  <section class="card"><h2>Look and sound</h2>
    <label class="row between">Theme <select id="theme" data-change="theme">${[["auto","Follow device"],["light","Light"],["dark","Dark"]].map(([k,l])=>`<option value="${k}" ${S.theme===k?"selected":""}>${l}</option>`).join("")}</select></label>
    <label class="row between">Chassis colour <select id="skin" data-change="skin">${["teal","graphite","cobalt","oxblood"].map(k=>`<option value="${k}" ${S.skin===k?"selected":""}>${k[0].toUpperCase()+k.slice(1)}</option>`).join("")}</select></label>
    <label class="row between">Sound and vibration <input type="checkbox" id="sound" data-change="sound" ${S.sound?"checked":""} style="width:22px;height:22px"></label></section>
  <section class="card"><h2>Backup</h2><div class="empty">Your progress is stored only on this device. Save a backup file now and then, especially before changing phones.</div>
    <div class="grid2"><button class="btn" data-act="export">Save backup file</button><label class="btn" for="importf">Restore from file</label></div><input type="file" id="importf" accept="application/json,.json" data-change="import" hidden></section>
  ${installEvt?`<button class="btn primary block" data-act="install">Install as an app</button>`:""}
  <section class="card"><h2>Start over</h2><button class="btn" data-act="reset" style="border-color:var(--bad);color:var(--bad)">Erase all progress</button></section>
  <section class="card"><h2>About</h2><div class="empty">CCNA Rack covers the 29 topics of Cisco's CCNA 200-301 v2.0 exam, which starts on ${nice(V2_OPENS)}. The questions are original practice questions, not real exam questions. Always check the topic list against Cisco's official exam topics.</div><div class="mono empty">Version 1.0 · ${Object.values(B).reduce((a,t)=>a+t.q.length,0)} questions · ${Object.values(B).reduce((a,t)=>a+t.c.length,0)} cards · ${Object.values(B).reduce((a,t)=>a+t.k.length,0)} commands</div></section>`;
}
function confirmBox(text,label,fn){
  pendingConfirm=fn;const m=document.createElement("div");m.className="modal";m.id="modal";
  m.innerHTML=`<div class="card" role="dialog" aria-modal="true"><p style="margin:0">${esc(text)}</p><div class="grid2"><button class="btn" data-act="modal-no">Cancel</button><button class="btn primary" data-act="modal-yes" style="background:var(--bad);border-color:var(--bad)">${esc(label)}</button></div></div>`;
  document.body.appendChild(m);
}
function applyLook(){
  const r=document.documentElement;r.dataset.skin=S.skin;
  if(S.theme==="auto")delete r.dataset.theme;else r.dataset.theme=S.theme;
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){go(g.dataset.go);return}
  const b=e.target.closest("[data-act]");if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(a==="quiz")startQuiz(id);
  else if(a==="mock")startMock(false);
  else if(a==="mock-full")startMock(true);
  else if(a==="weak")startWeak();
  else if(a==="subnet")startSubnet();
  else if(a==="cards-today")startTodayCards();
  else if(a==="topic-cards"){const ids=((B[id]||{}).c||[]).map((_,i)=>"b:"+id+":"+i).concat(Object.keys(S.cards).filter(k=>k.startsWith("q:"+id+"#")));startCards(shuffle(ids),"Flashcards · "+id)}
  else if(a==="cmd")startCmd(cmdItems(id),"IOS commands · "+id);
  else if(a==="cmd-mix")startCmd(shuffle(ALL.flatMap(t=>cmdItems(t.id))).slice(0,10),"IOS commands · mixed");
  else if(a==="focus")startFocus(Number(b.dataset.m)||25);
  else if(a==="focus-stop")stopFocus();
  else if(a==="set-status"){const s=Number(b.dataset.s),was=stOf(id);S.status[id]=s;save();render(true);if(s===2&&was<2){sfx("ok");xp(10);burstFrom(b,26)}else sfx("tick")}
  else if(a==="lab"){S.lab[id]=!S.lab[id];if(S.lab[id]){act("n");xp(10);sfx("ok");save();render(true);burstFrom('[data-act="lab"]',22)}else{xp(-10);save();render(true)}}
  else if(a==="quit"){P=null;render(true)}
  else if(a==="again"){const p=P;P=null;if(p.kind==="quiz")startQuiz(p.topic);else if(p.kind==="cmd")startCmd(p.items,p.title);else if(p.title==="Weak spots")startWeak();else startMock(!!p.exam)}
  else if(a==="ans"){
    if(!P||P.done)return;const j=Number(b.dataset.j);
    if(P.exam){P.ans[P.i]=j;sfx("tick");P.anim=false;render(true)}
    else{if(P.ans[P.i]!==undefined)return;P.ans[P.i]=j;P.just=P.i;const ok=j===P.qs[P.i].ans;sfx(ok?"ok":"bad");if(!ok)buzz(60);P.anim=false;render(true)}
  }
  else if(a==="qnext-learn"){if(P.i<P.qs.length-1){P.i++;P.anim=true;P.just=null;render(true);window.scrollTo(0,0)}else{finishQuiz();render(true);window.scrollTo(0,0)}}
  else if(a==="qnext"){if(P.i<P.qs.length-1){P.i++;P.anim=true;render(true)}}
  else if(a==="qprev"){if(P.i>0){P.i--;P.anim=true;render(true)}}
  else if(a==="qjump"){P.i=Number(b.dataset.k);P.anim=true;render(true)}
  else if(a==="finish"){const left=P.qs.length-Object.keys(P.ans).length;if(left)confirmBox(`${left} question${left>1?"s are":" is"} unanswered. Finish and score anyway?`,"Finish",()=>{finishQuiz();render(true);window.scrollTo(0,0)});else{finishQuiz();render(true);window.scrollTo(0,0)}}
  else if(a==="card-flip"){if(!P.show){P.show=true;P.noanim=false;sfx("flip");render(true)}}
  else if(a==="grade"){grade(Number(b.dataset.g));render(true);if(!P.queue.length)setTimeout(()=>burstFrom("#score",30),60)}
  else if(a==="cmd-check")cmdSubmit(false);
  else if(a==="cmd-skip")cmdSubmit(true);
  else if(a==="subnet-next"){P.q=newSubnet();render(true);const el=$("#sn-net");if(el)el.focus()}
  else if(a==="install"){if(installEvt){installEvt.prompt();installEvt.userChoice.finally(()=>{installEvt=null;render(true)})}}
  else if(a==="hide-install"){S.hideInstall=true;save();render(true)}
  else if(a==="export")exportData();
  else if(a==="reset")confirmBox("Erase all progress on this device? This cannot be undone unless you have a backup file.","Erase",()=>{const keep={skin:S.skin,theme:S.theme,sound:S.sound};S=Object.assign(clone(DEF),keep);P=null;save();go("home");toast("Progress erased.")});
  else if(a==="modal-yes"){const fn=pendingConfirm;pendingConfirm=null;$("#modal").remove();if(fn)fn()}
  else if(a==="modal-no"){pendingConfirm=null;$("#modal").remove()}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#modal")){pendingConfirm=null;$("#modal").remove();return}
  if(!P||route()!=="practice"||e.target.tagName==="INPUT")return;
  if(P.kind==="cards"&&P.queue.length){if(!P.show&&(e.key===" "||e.key==="Enter")){e.preventDefault();P.show=true;P.noanim=false;render(true)}else if(P.show&&["1","2","3"].includes(e.key)){grade(Number(e.key)-1);render(true)}}
  if((P.kind==="quiz"||P.kind==="mock")&&!P.done&&["1","2","3","4"].includes(e.key)){const btn=document.querySelectorAll(".opt")[Number(e.key)-1];if(btn&&!btn.disabled)btn.click()}
});
document.addEventListener("submit",e=>{
  e.preventDefault();const f=e.target.closest("[data-form]");if(!f)return;
  if(f.dataset.form==="cmd")cmdSubmit(false);
  else if(f.dataset.form==="subnet"){
    const q=P.q,n=$("#sn-net").value.trim(),bc=$("#sn-bc").value.trim(),h=$("#sn-h").value.trim();
    if(!n&&!bc&&!h)return;
    const ok=n===q.net&&bc===q.bc&&Number(h)===q.hosts;q.res={ok,net:n,bc,h};
    P.n++;S.subnet.n++;if(ok){P.ok++;P.streak++;S.subnet.ok++;xp(3)}else{P.streak=0;S.miss["1.3"]=(S.miss["1.3"]||0)+1}
    act("n");save();sfx(ok?"ok":"bad");if(!ok)buzz(60);render(true);if(ok)burstFrom("#score",P.streak>=5?40:18);
  }
});
document.addEventListener("change",e=>{
  const el=e.target.closest("[data-change]");if(!el)return;const k=el.dataset.change;
  if(k==="exam"&&el.value){S.exam=el.value;save();render(true)}
  else if(k==="npd"){S.newPerDay=Math.max(0,Math.min(50,Number(el.value)||0));save()}
  else if(k==="theme"){S.theme=el.value;save();applyLook()}
  else if(k==="skin"){S.skin=el.value;save();applyLook()}
  else if(k==="sound"){S.sound=el.checked;save();if(S.sound)sfx("ok")}
  else if(k==="import"){const file=el.files&&el.files[0];if(file)importData(file);el.value=""}
});
window.addEventListener("hashchange",()=>{if(route()!=="practice"&&P&&P.kind!=="mock")P=null;render(true)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick();render()}});

/* ---------- backup ---------- */
function exportData(){
  const blob=new Blob([JSON.stringify({app:"ccna-rack",exported:new Date().toISOString(),data:S},null,1)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ccna-rack-backup-${today()}.json`;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast("Backup file saved.");
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{try{const v=JSON.parse(r.result);const d=v&&v.app==="ccna-rack"?v.data:null;if(!d||d.v!==1)throw 0;
    confirmBox(`Replace your current progress with the backup from ${v.exported?new Date(v.exported).toLocaleDateString():"the file"}?`,"Restore",()=>{S=Object.assign(clone(DEF),d);P=null;save();applyLook();go("home");toast("Backup restored.")})}
    catch(e){toast("That file is not a CCNA Rack backup.")}};
  r.readAsText(file);
}

/* ---------- start ---------- */
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;if(["home","settings"].includes(route()))render(true)});
window.addEventListener("appinstalled",()=>{installEvt=null;toast("Installed. Open CCNA Rack from your home screen.")});
try{if("serviceWorker" in navigator&&location.protocol!=="file:"){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    reg.addEventListener("updatefound",()=>{const w=reg.installing;if(!w)return;w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)toast("A new version is ready.","Reload",()=>{w.postMessage("skip");})})});
  }).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloaded){reloaded=true;location.reload()}});
}}catch(e){}
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
applyLook();render(true);setInterval(tick,1000);tick();
