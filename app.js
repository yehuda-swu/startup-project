import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebaseConfig.js';

const el = document.getElementById('app');
const toastEl = document.getElementById('toast');
const CATEGORIES = ['The Middle East','Water','Climate and Sustainability','Misinformation and Media','Culture and Society','Health and Medicine','Food and Agriculture'];
const STAGES = [
  {id:'discover',name:'Discover',detail:'Form your team and agree on an Israel related dilemma.'},
  {id:'investigate',name:'Investigate',detail:'Research the dilemma, existing responses and the gap.'},
  {id:'innovate',name:'Innovate',detail:'Design and explain your proposed StartUp solution.'},
  {id:'present',name:'Present and Review',detail:'Share your first draft and receive feedback.'},
  {id:'refine',name:'Refine',detail:'Improve your research, concept and final presentation.'},
  {id:'pitch',name:'Pitch',detail:'Present your completed StartUp at graduation.'}
];
const PROJECT_FIELDS = [
  ['name','StartUp name','text'], ['category','Subject category','select'],
  ['dilemma','The Israel related dilemma','textarea'], ['summary','Research summary','textarea'],
  ['existing','Existing responses','textarea'], ['gap','The gap we identified','textarea'],
  ['solution','Our StartUp solution','textarea'], ['audience','Who benefits','textarea'],
  ['operation','How it works','textarea'], ['partners','Potential partners','textarea'],
  ['impact','Expected impact','textarea'], ['nextSteps','Next steps','textarea']
];
const DEFAULT_STAGES = Object.fromEntries(STAGES.map(s=>[s.id,'not_started']));
const state = {user:null,profile:null,view:'dashboard',teams:[],directory:[],requests:[],users:[],team:null,project:null,updates:[],resources:[],uploads:[],feedback:[],tab:'overview',signUp:false,loading:false};
const configured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE_') && !firebaseConfig.projectId.includes('PASTE_'));
let app, auth, db;
if(configured){
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth,async user=>{
    state.user=user;
    if(!user){ state.profile=null; state.team=null; state.view='dashboard'; render(); return; }
    await loadAccount();
  });
}else render();

function h(value=''){return String(value ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function paragraphs(value=''){return h(value).replace(/\n/g,'<br>');}
function formValue(form,name){return (new FormData(form).get(name)||'').toString().trim();}
function opts(values,selected){return values.map(v=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(v)}</option>`).join('');}
function humanDate(value){if(!value)return 'Just now';try {const date=value.toDate?value.toDate():new Date(value);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date);}catch{return 'Recently';}}
function toast(msg,error=false){toastEl.textContent=msg;toastEl.className=`toast show${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{toastEl.className='toast';},4200);}
function errorText(err){const code=err?.code||'';if(code==='permission-denied')return 'Permission denied. Check your team membership and the Firebase security rules.';if(code.includes('network'))return 'A network error occurred. Please try again.';if(code.includes('auth/invalid-credential'))return 'The email or password is incorrect.';if(code.includes('auth/email-already-in-use'))return 'An account already exists with this email address.';if(code.includes('auth/weak-password'))return 'Use a stronger password of at least six characters.';return (err?.message||'Something went wrong. Please try again.').replace(/^Firebase: /,'').slice(0,210);}
async function withBusy(fn){if(state.loading)return;state.loading=true;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);try {await fn();}catch(e){console.error(e);toast(errorText(e),true);}finally{state.loading=false;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=false);}}
function brand(){return `<span class="brandmark">S</span><span>StartUp<small>StandWithUs UK · Project Portal</small></span>`;}
function shell(body){return `<div class="shell"><header class="topbar"><div class="topinner"><a href="#" class="brand" data-action="home">${brand()}</a><div class="topactions"><span class="muted" style="font-size:12px">${h(state.profile?.name||'')}</span>${state.profile?.role==='admin'?`<button class="btn small outline" data-action="admin">Admin</button>`:''}<button class="btn small outline" data-action="home">Dashboard</button><button class="btn small secondary" data-action="signout">Sign out</button></div></div></header><main class="container">${body}</main><footer class="foot">StandWithUs UK | StartUp Project Portal</footer></div>`;}
function hero(kicker,title,description){return `<section class="hero"><div class="eyebrow">${h(kicker)}</div><h1>${h(title)}</h1><p>${h(description)}</p></section>`;}
function empty(title,text){return `<div class="empty"><strong>${h(title)}</strong>${h(text)}</div>`;}
function progress(teams){const stages=teams.map(t=>Number(t.progress||0));return stages.length?Math.round(stages.reduce((a,b)=>a+b,0)/stages.length):0;}
function render(){
  if(!configured){el.innerHTML=`<main class="authwrap"><section class="authaside"><a class="brand" href="#">${brand()}</a><div><h1>Ideas that begin with a question.</h1><p>A shared home for your team's research, creativity and impact.</p></div><div>DISCOVER · INVESTIGATE · INNOVATE · PITCH</div></section><section class="authmain"><div class="authbox"><div class="eyebrow">First time setup</div><h2>Connect your Firebase project</h2><p>The website is ready. To enable accounts, research sharing and document links, replace the example values in <span class="code">firebaseConfig.js</span> with your Firebase web application settings.</p><div class="alert">Read the included README for the complete setup instructions and security rules.</div></div></section></main>`;return;}
  if(!state.user){el.innerHTML=renderAuth();return;}
  if(!state.profile){el.innerHTML=shell(`<div class="card narrow"><h2>Account setup required</h2><p>Your login is recognised, but a user profile has not been created yet. If you are an administrator, follow the bootstrap instructions in README.md. If you just registered, try refreshing this page.</p><button class="btn primary" data-action="reload">Try again</button></div>`);return;}
  if(state.view==='team'&&state.team){el.innerHTML=shell(renderTeam());return;}
  if(state.view==='admin'&&state.profile.role==='admin'){el.innerHTML=shell(renderAdmin());return;}
  el.innerHTML=shell(renderDashboard());
}
function renderAuth(){return `<main class="authwrap"><section class="authaside"><a href="#" class="brand">${brand()}</a><div><div class="eyebrow" style="color:#ace7ff">STARTUP 2026/27</div><h1>Research. Create.<br>Make an impact.</h1><p>One place for your team to explore a real dilemma involving Israel, develop your ideas and get feedback from your supervisor.</p><div class="authfeatures"><div class="authfeature">01 &nbsp; Discover your challenge</div><div class="authfeature">02 &nbsp; Share your team's research</div><div class="authfeature">03 &nbsp; Develop and present your StartUp</div></div></div><div style="font-size:12px;opacity:.7">StandWithUs UK · Explore Programme</div></section><section class="authmain"><div class="authbox"><div class="eyebrow">Welcome to StartUp</div><h2>${state.signUp?'Create your account':'Sign in to your workspace'}</h2><p>${state.signUp?'Create a student account. Your supervisor will approve your request to join a team.':'Your team's research and latest updates are waiting for you.'}</p><form data-form="auth" class="stack" style="margin-top:25px">${state.signUp?`<div class="field"><label for="name">Your name</label><input name="name" id="name" autocomplete="name" maxlength="70" required placeholder="First name and surname"></div>`:''}<div class="field"><label for="email">Email address</label><input name="email" id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div><div class="field"><label for="password">Password</label><input name="password" id="password" type="password" minlength="6" autocomplete="${state.signUp?'new-password':'current-password'}" required placeholder="At least six characters"></div><button class="btn primary" type="submit">${state.signUp?'Create student account':'Sign in'}</button></form><div class="divider"></div><button data-action="toggleSignup" class="btn outline" style="width:100%">${state.signUp?'Already registered? Sign in':'New student? Create an account'}</button>${!state.signUp?`<div style="text-align:center;margin-top:17px"><button data-action="resetPassword" class="btn small secondary">Forgotten your password?</button></div>`:''}<p class="hint">Student accounts cannot access projects until an administrator approves their team membership.</p></div></section></main>`;}

async function loadAccount(){
  try{
    const snap=await getDoc(doc(db,'users',state.user.uid));
    state.profile=snap.exists()?snap.data():null;
    if(!state.profile){render();return;}
    await loadDashboard();
  }catch(e){toast(errorText(e),true);state.profile=null;render();}
}
async function loadDashboard(){
  const uid=state.user.uid;
  const profile=state.profile;
  let teamSnaps=[];
  if(profile.role==='admin')teamSnaps=(await getDocs(collection(db,'teams'))).docs;
  else if(profile.role==='supervisor')teamSnaps=(await getDocs(query(collection(db,'teams'),where('supervisorUids','array-contains',uid)))).docs;
  else teamSnaps=(await getDocs(query(collection(db,'teams'),where('memberUids','array-contains',uid)))).docs;
  state.teams=teamSnaps.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  // The team cards show real stage progress stored in each team's project document.
  await Promise.all(state.teams.map(async team=>{
    const project=await getDoc(doc(db,'projects',team.id));
    if(project.exists()){team.stageStatuses=project.data().stageStatuses||DEFAULT_STAGES;team.dilemma=project.data().dilemma||team.dilemma;}
  }));
  const dirs=await getDocs(collection(db,'teamDirectory'));
  state.directory=dirs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  if(profile.role==='admin'){
    const [rq,us]=await Promise.all([getDocs(collection(db,'requests')),getDocs(collection(db,'users'))]);
    state.requests=rq.docs.map(d=>({id:d.id,...d.data()}));
    state.users=us.docs.map(d=>({id:d.id,...d.data()}));
  }else{
    state.requests=[];state.users=[];
    if(profile.role==='student'){
      const rq=await getDocs(query(collection(db,'requests'),where('uid','==',uid)));
      state.requests=rq.docs.map(d=>({id:d.id,...d.data()}));
    }
  }
  state.view=state.view==='admin'&&profile.role==='admin'?'admin':'dashboard';
  render();
}
function teamCard(t){const completed=STAGES.filter(s=>t?.stageStatuses?.[s.id]==='complete').length;const perc=Math.round(100*completed/STAGES.length);return `<article class="card teamcard"><div class="teammeta"><span class="pill">${h(t.category||'StartUp')}</span><span class="pill dim">${h(t.cohort||'2026/27')}</span></div><h3>${h(t.name)}</h3><p class="muted cardsummary">${h((t.dilemma||'The team is preparing its dilemma statement.').slice(0,140))}</p><div class="row between subtle"><span>Project stages completed</span><strong>${completed}/${STAGES.length}</strong></div><div class="progressline"><span style="width:${perc}%"></span></div><div class="row between" style="margin-top:15px"><span class="subtle">${(t.memberUids||[]).length} students</span><button class="btn primary small" data-action="openTeam" data-id="${h(t.id)}">Open workspace</button></div></article>`;}
function renderDashboard(){
  const first=(state.profile.name||'there').split(' ')[0];
  const isAdmin=state.profile.role==='admin';
  const roleLabel=isAdmin?'ADMINISTRATOR':state.profile.role==='supervisor'?'SUPERVISOR':'STUDENT';
  const pending=state.requests.filter(r=>r.status==='pending').length;
  let sections=hero(`STARTUP PROJECT PORTAL · ${roleLabel}`,`Welcome back, ${first}.`,state.profile.role==='student'?'Every great idea begins with a real problem. Follow your team’s progress and build your StartUp here.':'Follow your teams, review their research and help them turn ideas into solutions.');
  if(isAdmin)sections+=`<div class="pagehead"><h2>Programme overview</h2><button class="btn primary" data-action="admin">Manage programme</button></div><div class="statrow"><div class="stat"><strong>${state.teams.length}</strong><span>Project teams</span></div><div class="stat"><strong>${state.users.filter(u=>u.role==='student').length}</strong><span>Student accounts</span></div><div class="stat"><strong>${pending}</strong><span>Access requests waiting</span></div></div>`;
  sections+=`<div class="pagehead"><h2>${isAdmin?'All teams':state.profile.role==='supervisor'?'Your supervised teams':'Your team'}</h2><button class="btn outline small" data-action="reload">Refresh</button></div>`;
  sections+=state.teams.length?`<div class="grid">${state.teams.map(teamCard).join('')}</div>`:empty('No team assigned yet',state.profile.role==='student'?'Choose your team below and request access. A supervisor will approve it.':'An administrator can create teams and assign supervisors.');
  if(state.profile.role==='student'){
    const joined=new Set(state.teams.map(t=>t.id));
    const pendingIds=new Set(state.requests.filter(r=>r.status==='pending').map(r=>r.teamId));
    const available=state.directory.filter(d=>!joined.has(d.id));
    sections+=`<div class="pagehead"><h2>Join a team</h2></div><div class="card narrow"><p class="muted" style="margin-top:0">Select your team from the list below. Your request must be approved before you can see its work.</p>${available.length?`<form data-form="join"><div class="field"><label for="teamid">Team</label><select name="teamid" id="teamid" required><option value="">Select your group</option>${available.map(d=>`<option value="${h(d.id)}">${h(d.name)} (${h(d.cohort||'StartUp')})${pendingIds.has(d.id)?' · request pending':''}</option>`).join('')}</select></div><button class="btn primary" type="submit">Request team access</button></form>`:empty('No available teams','Your administrator has not published any team names yet.')}${state.requests.filter(r=>r.status==='pending').length?`<p class="hint">Pending requests: ${state.requests.filter(r=>r.status==='pending').map(r=>h(state.directory.find(d=>d.id===r.teamId)?.name||'Team')).join(', ')}</p>`:''}</div>`;
  }
  return sections;
}

async function openTeam(id){
  const team=state.teams.find(t=>t.id===id);if(!team)return toast('This team is not assigned to your account.',true);
  state.team=team;state.view='team';state.tab='overview';render();await loadTeam();
}
async function loadTeam(){
  const id=state.team.id;
  const [p,up,res,fl,fb]=await Promise.all([
    getDoc(doc(db,'projects',id)),
    getDocs(query(collection(db,'teams',id,'updates'),orderBy('createdAt','desc'))),
    getDocs(query(collection(db,'teams',id,'resources'),orderBy('createdAt','desc'))),
    getDocs(query(collection(db,'teams',id,'uploads'),orderBy('createdAt','desc'))),
    getDocs(query(collection(db,'teams',id,'feedback'),orderBy('createdAt','desc')))
  ]);
  state.project=p.exists()?p.data():{};
  state.updates=up.docs.map(d=>({id:d.id,...d.data()}));
  state.resources=res.docs.map(d=>({id:d.id,...d.data()}));
  state.uploads=fl.docs.map(d=>({id:d.id,...d.data()}));
  state.feedback=fb.docs.map(d=>({id:d.id,...d.data()}));
  render();
}
function supervisorHere(){return state.profile.role==='admin'||state.profile.role==='supervisor'&&(state.team.supervisorUids||[]).includes(state.user.uid);}
function renderTeam(){
  const t=state.team,p=state.project||{};
  const stageStatuses=p.stageStatuses||DEFAULT_STAGES;
  const completed=STAGES.filter(s=>stageStatuses[s.id]==='complete').length;
  const percent=Math.round(completed/STAGES.length*100);
  const tabs=[['overview','Overview'],['stages','Project stages'],['research',`Research (${state.resources.length})`],['journal',`Progress journal (${state.updates.length})`],['uploads',`Presentations (${state.uploads.length})`],['feedback',`Feedback (${state.feedback.length})`]];
  return `<div style="margin-bottom:15px"><button class="btn outline small" data-action="home">← All teams</button></div><section class="card"><div class="teamheader"><div><span class="pill">${h(t.category||'StartUp')}</span> <span class="pill dim">${h(t.cohort||'2026/27')}</span><h2>${h(t.name)}</h2><p class="muted" style="margin:0">${h(p.dilemma||'Your dilemma statement will appear here.')}</p></div><button class="btn outline small" data-action="refreshTeam">Refresh team</button></div><div class="row between" style="margin-top:22px"><span class="subtle">Stage completion</span><b style="font-size:13px">${percent}% complete</b></div><div class="progressline"><span style="width:${percent}%"></span></div></section><nav class="tabs" aria-label="Team workspace sections">${tabs.map(([id,label])=>`<button class="tab ${state.tab===id?'active':''}" data-action="tab" data-id="${id}">${h(label)}</button>`).join('')}</nav>${({overview:renderOverview,stages:renderStages,research:renderResearch,journal:renderJournal,uploads:renderUploads,feedback:renderFeedback}[state.tab]||renderOverview)()}`;
}
function renderOverview(){const p=state.project||{};return `<div class="grid2"><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Project planning</h3><span class="pill">Shared document</span></div><p class="hint">Everyone in your team can update these fields. Please save your changes before switching sections.</p><form data-form="project">${PROJECT_FIELDS.map(([key,label,kind])=>`<div class="field"><label for="p_${key}">${h(label)}</label>${kind==='textarea'?`<textarea id="p_${key}" name="${key}" maxlength="3500" placeholder="Add your team's thoughts here…">${h(p[key]||'')}</textarea>`:kind==='select'?`<select id="p_${key}" name="${key}"><option value="">Choose a subject</option>${opts(CATEGORIES,p[key]||'')}</select>`:`<input id="p_${key}" name="${key}" maxlength="140" value="${h(p[key]||'')}" placeholder="Enter your StartUp name">`}</div>`).join('')}<button class="btn primary" type="submit">Save project plan</button></form></div><aside class="stack"><div class="card"><h3 class="sectiontitle">Your project journey</h3><p class="muted" style="font-size:13px;line-height:1.6">Start with an actual dilemma involving Israel. Understand it, research existing responses, identify the gap and create a new solution.</p>${STAGES.map((s,i)=>`<div class="row" style="padding:8px 0;border-top:1px solid #eff3f7"><div class="introicon" style="width:29px;height:29px;font-size:12px">${i+1}</div><div style="flex:1"><strong style="font-size:13px">${h(s.name)}</strong></div><span class="pill ${p.stageStatuses?.[s.id]==='complete'?'good':'dim'}">${p.stageStatuses?.[s.id]==='complete'?'Done':'Open'}</span></div>`).join('')}</div><div class="card"><h3 class="sectiontitle">Recent activity</h3>${state.updates.length?state.updates.slice(0,3).map(x=>`<div class="item"><strong style="font-size:13px">${h(x.title)}</strong><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div></div>`).join(''):empty('Nothing recorded yet','Add your first progress update to start the team journal.')}</div></aside></div>`;}
function renderStages(){const statuses=state.project?.stageStatuses||DEFAULT_STAGES;const statusNames={'not_started':'Not started','in_progress':'In progress','complete':'Completed'};return `<div class="card"><div class="sectionhead"><h3 class="sectiontitle">Track your six project stages</h3><span class="pill">Team progress</span></div><p class="muted" style="font-size:13px;line-height:1.5">Update each stage as your team works through the StartUp Challenge. Changes are saved immediately and are visible to your supervisor.</p><div class="stagegrid">${STAGES.map((s,i)=>`<article class="stagecard"><div class="number">${i+1}</div><h4>${h(s.name)}</h4><p>${h(s.detail)}</p><label for="stage_${s.id}" class="subtle">Current status</label><select id="stage_${s.id}" data-stage="${s.id}">${Object.entries(statusNames).map(([val,name])=>`<option value="${val}" ${statuses[s.id]===val?'selected':''}>${name}</option>`).join('')}</select></article>`).join('')}</div></div>`;}
function itemActions(type,item){return (item.authorUid===state.user.uid||supervisorHere())?`<button class="btn small danger" data-action="deleteItem" data-type="${type}" data-id="${h(item.id)}">Remove</button>`:'';}
function renderResearch(){return `<div class="grid2"><div class="card"><h3 class="sectiontitle">Add a research source</h3><p class="hint">Record articles, reports, organisations and useful websites. Cite your source so your supervisor can review it.</p><form data-form="resource"><div class="field"><label>Source title</label><input name="title" maxlength="140" required placeholder="For example: Research report on regional water access"></div><div class="field"><label>Website or document link</label><input name="url" type="url" required placeholder="https://example.org/report"></div><div class="field"><label>Key findings and relevance</label><textarea name="notes" maxlength="2200" required placeholder="What did you learn and why is it important to your dilemma?"></textarea></div><button class="btn primary" type="submit">Add source</button></form></div><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Shared research library</h3><span class="pill">${state.resources.length} sources</span></div>${state.resources.length?state.resources.map(x=>`<article class="item"><div class="row between"><h4>${h(x.title)}</h4>${itemActions('resources',x)}</div><div class="meta">Added by ${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.notes)}</p><a class="linkline" href="${h(safeLink(x.url))}" target="_blank" rel="noopener noreferrer">View source</a></article>`).join(''):empty('No sources added yet','Add the first source your team has researched.')}</div></div>`;}
function renderJournal(){return `<div class="grid2"><div class="card"><h3 class="sectiontitle">Record a progress update</h3><p class="hint">Use the journal to share what has been completed, ask questions and record what needs to happen next.</p><form data-form="update"><div class="field"><label>Update type</label><select name="type">${opts(['Progress update','Milestone','Question for supervisor'],'Progress update')}</select></div><div class="field"><label>Title</label><input name="title" maxlength="140" required placeholder="For example: We identified our research gap"></div><div class="field"><label>Details</label><textarea name="body" maxlength="3500" required placeholder="What has your team achieved or what help do you need?"></textarea></div><button type="submit" class="btn primary">Post update</button></form></div><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Team journal</h3><span class="pill">${state.updates.length} updates</span></div>${state.updates.length?state.updates.map(x=>`<article class="item"><div class="row between"><span class="pill dim">${h(x.type)}</span>${itemActions('updates',x)}</div><h4 style="margin-top:11px">${h(x.title)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.body)}</p></article>`).join(''):empty('No updates yet','Share your first research or project milestone.')}</div></div>`;}
function renderUploads(){return `<div class="grid2"><div class="card"><h3 class="sectiontitle">Share your presentations and documents</h3><p class="muted" style="font-size:13px">Save your PowerPoint, PDF or research document in your school approved Google Drive or OneDrive account, then share its link here. The StartUp portal itself does not store files.</p><div class="note">IMPORTANT: Give access to your team and assigned supervisors only. Avoid public sharing or links that allow anyone to view pupils' work.</div><form data-form="fileLink" style="margin-top:22px"><div class="field"><label>Document or presentation name</label><input name="description" required maxlength="140" placeholder="For example: February first draft"></div><div class="field"><label>Secure document link</label><input name="url" type="url" required placeholder="https://docs.google.com/presentation/..."></div><button class="btn primary" type="submit">Share document link</button></form></div><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Shared presentations and documents</h3><span class="pill">${state.uploads.length} links</span></div>${state.uploads.length?state.uploads.map(x=>`<article class="item fileitem"><div class="row" style="min-width:0"><div class="filetype">${x.kind==='link'?'LINK':'FILE'}</div><div style="min-width:0"><h4>${h(x.description)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><div class="subtle" style="overflow-wrap:anywhere">${x.kind==='link'?'External document':'Previous file upload'}</div></div></div><div class="row">${x.kind==='link'?`<a href="${h(safeLink(x.url))}" target="_blank" rel="noopener noreferrer" class="btn outline small">Open</a>`:`<span class="subtle">Share again as a link</span>`}${itemActions('uploads',x)}</div></article>`).join(''):empty('No documents shared yet','Add a secure link to your first draft or other project work.')}</div></div>`;}
function renderFeedback(){return `<div class="grid2">${supervisorHere()?`<div class="card"><h3 class="sectiontitle">Leave supervisor feedback</h3><p class="hint">Explain what the team has done well and what should be improved before the next stage.</p><form data-form="feedback"><div class="field"><label>Feedback heading</label><input name="title" maxlength="140" required placeholder="For example: First draft review"></div><div class="field"><label>Feedback and next steps</label><textarea name="body" maxlength="3500" required placeholder="What is strong? What should be changed? What needs to happen next?"></textarea></div><button class="btn primary" type="submit">Share feedback</button></form></div>`:`<div class="card"><h3 class="sectiontitle">Supervisor feedback</h3><p class="muted">Your supervisors can leave feedback here. Use the Progress journal to ask questions or flag anything you need help with.</p><div class="note">Supervisors can see all research, project updates and document links shared by your team.</div></div>`}<div class="card"><div class="sectionhead"><h3 class="sectiontitle">Feedback history</h3><span class="pill">${state.feedback.length} comments</span></div>${state.feedback.length?state.feedback.map(x=>`<article class="item"><h4>${h(x.title)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.body)}</p></article>`).join(''):empty('No feedback yet','Supervisor comments will be shown here.')}</div></div>`;}

function renderAdmin(){
 const pending=state.requests.filter(r=>r.status==='pending');
 const supervisors=state.users.filter(u=>u.role==='supervisor'||u.role==='admin');
 return `${hero('PROGRAMME ADMINISTRATION','Manage StartUp teams','Create team workspaces, approve membership requests and assign supervisors.')}
 <div class="pagehead"><h2>Programme management</h2><button data-action="reload" class="btn outline small">Refresh data</button></div>
 <div class="admincols"><div class="card"><h3 class="sectiontitle">Create a team</h3><form data-form="newTeam"><div class="field"><label>Team name</label><input name="name" required maxlength="90" placeholder="For example: Waze Team A"></div><div class="field"><label>Cohort</label><input name="cohort" maxlength="35" value="2026/27" required></div><div class="field"><label>Subject (optional)</label><select name="category"><option value="">Not selected yet</option>${opts(CATEGORIES,'')}</select></div><div class="field"><label>Assign supervisor</label><select name="supervisor"><option value="">Assign later</option>${supervisors.map(u=>`<option value="${h(u.id)}">${h(u.name)} (${h(u.email)})</option>`).join('')}</select><p class="hint">Supervisors must register an account and be promoted below before they can be assigned.</p></div><button class="btn primary" type="submit">Create team</button></form></div>
 <div class="card"><div class="sectionhead"><h3 class="sectiontitle">Membership requests</h3><span class="pill">${pending.length} pending</span></div>${pending.length?pending.map(r=>`<div class="item"><h4>${h(r.studentName||r.email||'Student')}</h4><p>${h(r.email||'')}</p><div class="subtle">Requested: ${h(state.directory.find(t=>t.id===r.teamId)?.name||'Unknown team')}</div><div class="row" style="margin-top:11px"><button class="btn primary small" data-action="approve" data-id="${h(r.id)}">Approve</button><button class="btn danger small" data-action="reject" data-id="${h(r.id)}">Decline</button></div></div>`).join(''):empty('No pending requests','Student requests will appear here for approval.')}</div></div>
 <div class="pagehead"><h2>Team assignments</h2></div><div class="card tablewrap">${state.teams.length?`<table class="table"><thead><tr><th>Team</th><th>Students</th><th>Supervisor</th><th>Assign supervisor</th></tr></thead><tbody>${state.teams.map(t=>`<tr><td><strong>${h(t.name)}</strong><br><span class="subtle">${h(t.cohort||'')}</span></td><td>${(t.memberUids||[]).length}</td><td>${h((t.supervisorUids||[]).map(uid=>state.users.find(u=>u.id===uid)?.name||'Supervisor').join(', ')||'None')}</td><td><select data-team-supervisor="${h(t.id)}" aria-label="Assign supervisor to ${h(t.name)}"><option value="">Select an educator</option>${supervisors.map(u=>`<option value="${h(u.id)}">${h(u.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`:empty('No teams yet','Use the form above to create the first team.')}</div>
 <div class="pagehead"><h2>Registered people</h2></div><div class="card tablewrap">${state.users.length?`<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Change role</th></tr></thead><tbody>${state.users.sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(u=>`<tr><td>${h(u.name)}</td><td>${h(u.email)}</td><td><span class="pill dim">${h(u.role)}</span></td><td>${u.id===state.user.uid?'Your account':`<select data-user-role="${h(u.id)}" aria-label="Change role for ${h(u.name)}">${opts(['student','supervisor','admin'],u.role)}</select>`}</td></tr>`).join('')}</tbody></table>`:empty('No accounts','Student and supervisor accounts will appear here.')}</div><div class="alert warning" style="margin-top:16px">Only give administrator access to trusted staff. Administrators can view all teams, assign students and change other accounts' roles.</div>`;
}

async function createPost(section,data){await addDoc(collection(db,'teams',state.team.id,section),{...data,authorUid:state.user.uid,authorName:state.profile.name,createdAt:serverTimestamp()});await loadTeam();}
function safeLink(url){try{const v=new URL(String(url));return ['https:','http:'].includes(v.protocol)?v.href:'#';}catch{return '#';}}

// Single delegated event listener keeps behaviour working after each render.
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b)return;
 event.preventDefault();const action=b.dataset.action,id=b.dataset.id;
 if(action==='toggleSignup'){state.signUp=!state.signUp;render();return;}
 if(action==='home'){state.team=null;state.view='dashboard';await withBusy(loadDashboard);return;}
 if(action==='admin'){state.view='admin';render();return;}
 if(action==='signout'){await withBusy(()=>signOut(auth));return;}
 if(action==='reload'){await withBusy(loadAccount);return;}
 if(action==='openTeam'){await withBusy(()=>openTeam(id));return;}
 if(action==='refreshTeam'){await withBusy(loadTeam);toast('Team workspace refreshed.');return;}
 if(action==='tab'){state.tab=id;render();return;}
 if(action==='resetPassword'){
   const email=prompt('Enter the email address for your account:');if(!email)return;
   await withBusy(async()=>{await sendPasswordResetEmail(auth,email.trim());toast('If the email is registered, a password reset message will be sent.');});return;
 }
 if(action==='approve'||action==='reject'){
   const request=state.requests.find(r=>r.id===id);if(!request)return;
   await withBusy(async()=>{
     if(action==='approve'){
       await updateDoc(doc(db,'teams',request.teamId),{memberUids:arrayUnion(request.uid)});
       await updateDoc(doc(db,'requests',id),{status:'approved',reviewedAt:serverTimestamp()});
     }else await updateDoc(doc(db,'requests',id),{status:'declined',reviewedAt:serverTimestamp()});
     await loadDashboard();toast(action==='approve'?'Access approved.':'Request declined.');
   });return;
 }
 if(action==='deleteItem'){
   if(!['updates','resources','uploads'].includes(b.dataset.type))return;
   if(!confirm('Remove this item from the team workspace?'))return;
   await withBusy(async()=>{await deleteDoc(doc(db,'teams',state.team.id,b.dataset.type,id));await loadTeam();toast('Item removed.');});return;
 }
});

document.addEventListener('change',async event=>{
 const node=event.target;
 if(node.matches('select[data-stage]')){
   const stage=node.dataset.stage,value=node.value;
   await withBusy(async()=>{
     await updateDoc(doc(db,'projects',state.team.id),{[`stageStatuses.${stage}`]:value,updatedBy:state.user.uid,updatedAt:serverTimestamp()});
     const current=state.teams.find(t=>t.id===state.team.id);
     const next={...(state.project?.stageStatuses||DEFAULT_STAGES),[stage]:value};
     if(current)current.stageStatuses=next;
     await loadTeam();toast('Stage status updated.');
   });return;
 }
 if(node.matches('select[data-team-supervisor]')){
   if(!node.value)return;
   await withBusy(async()=>{await updateDoc(doc(db,'teams',node.dataset.teamSupervisor),{supervisorUids:arrayUnion(node.value)});await loadDashboard();toast('Supervisor assigned.');});return;
 }
 if(node.matches('select[data-user-role]')){
   await withBusy(async()=>{await updateDoc(doc(db,'users',node.dataset.userRole),{role:node.value});await loadDashboard();toast('Account role updated.');});return;
 }
});

document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-form]'))return;
 event.preventDefault();const type=form.dataset.form;
 if(type==='auth'){
   await withBusy(async()=>{
     const email=formValue(form,'email'),password=formValue(form,'password');
     if(state.signUp){
       const name=formValue(form,'name');
       const result=await createUserWithEmailAndPassword(auth,email,password);
       await setDoc(doc(db,'users',result.user.uid),{name,email:result.user.email||email,role:'student',createdAt:serverTimestamp()});
       state.signUp=false;await loadAccount();toast('Account created. Request access to your team.');
     }else{await signInWithEmailAndPassword(auth,email,password);toast('Welcome back.');}
   });return;
 }
 if(type==='join'){
   const teamId=formValue(form,'teamid');if(!state.directory.find(t=>t.id===teamId))return toast('Choose a team.',true);
   if(state.requests.some(r=>r.teamId===teamId&&r.status==='pending'))return toast('Your request is already pending.',true);
   await withBusy(async()=>{await setDoc(doc(db,'requests',`${state.user.uid}_${teamId}`),{uid:state.user.uid,teamId,status:'pending',studentName:state.profile.name,email:state.user.email,createdAt:serverTimestamp()});await loadDashboard();toast('Request sent for approval.');});return;
 }
 if(type==='newTeam'){
   await withBusy(async()=>{
     const name=formValue(form,'name'),cohort=formValue(form,'cohort'),category=formValue(form,'category'),supervisor=formValue(form,'supervisor');
     const team=await addDoc(collection(db,'teams'),{name,cohort,category,dilemma:'',memberUids:[],supervisorUids:supervisor?[supervisor]:[],createdBy:state.user.uid,createdAt:serverTimestamp()});
     await Promise.all([
       setDoc(doc(db,'teamDirectory',team.id),{name,cohort,createdAt:serverTimestamp()}),
       setDoc(doc(db,'projects',team.id),{name:'',category,dilemma:'',summary:'',existing:'',gap:'',solution:'',audience:'',operation:'',partners:'',impact:'',nextSteps:'',stageStatuses:DEFAULT_STAGES,updatedBy:state.user.uid,updatedAt:serverTimestamp()})
     ]);
     await loadDashboard();toast('Team created. Students can now request access.');
   });return;
 }
 if(type==='project'){
   await withBusy(async()=>{
     const values={};for(const [key] of PROJECT_FIELDS)values[key]=formValue(form,key);
     await updateDoc(doc(db,'projects',state.team.id),{...values,updatedBy:state.user.uid,updatedAt:serverTimestamp()});
     state.project={...state.project,...values};render();toast('Project plan saved.');
   });return;
 }
 if(type==='resource'){
   const url=formValue(form,'url');if(safeLink(url)==='#')return toast('Enter a valid website address.',true);
   await withBusy(async()=>{await createPost('resources',{title:formValue(form,'title'),url,notes:formValue(form,'notes')});toast('Research source shared.');});return;
 }
 if(type==='update'){
   await withBusy(async()=>{await createPost('updates',{type:formValue(form,'type'),title:formValue(form,'title'),body:formValue(form,'body')});toast('Progress update posted.');});return;
 }
 if(type==='feedback'){
   await withBusy(async()=>{await createPost('feedback',{title:formValue(form,'title'),body:formValue(form,'body')});toast('Feedback shared with the team.');});return;
 }
 if(type==='fileLink'){
   const url=formValue(form,'url');if(safeLink(url)==='#'||!url.startsWith('https://'))return toast('Enter a secure HTTPS document link.',true);
   await withBusy(async()=>{await createPost('uploads',{kind:'link',description:formValue(form,'description'),url,fileName:''});toast('Presentation link added.');});return;
 }

});
