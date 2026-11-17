import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebaseConfig.js?v=5';
import { storageConfig } from './storageConfig.js?v=6';

const el = document.getElementById('app');
const toastEl = document.getElementById('toast');
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['pdf','doc','docx','ppt','pptx','xls','xlsx','txt','csv','png','jpg','jpeg','webp'];
const uploadsReady = Boolean(storageConfig.supabaseUrl?.startsWith('https://') && storageConfig.publishableKey && !storageConfig.publishableKey.startsWith('PASTE_'));
let supabaseFiles = null;
async function getFileStorageClient(){
  if(!uploadsReady) throw new Error('Direct uploads are not connected yet.');
  // Load file storage only on demand. A blocked CDN must never prevent portal sign in.
  if(!supabaseFiles){
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabaseFiles = createClient(storageConfig.supabaseUrl,storageConfig.publishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
  }
  return supabaseFiles;
}
const STREAMS = [{id:'waze',label:'StartUp Waze'},{id:'netafim',label:'StartUp Netafim'}];
const ROLES = ['student','supervisor','waze_admin','netafim_admin','admin'];
function isProgrammeAdmin(){return state.profile?.role==='admin';}
function adminStream(){return state.profile?.role==='waze_admin'?'waze':state.profile?.role==='netafim_admin'?'netafim':'';}
function isAdministrator(){return isProgrammeAdmin()||Boolean(adminStream());}
function streamName(stream){return STREAMS.find(s=>s.id===stream)?.label||'Unassigned cohort';}
function roleName(role){return ({student:'Student',supervisor:'Supervisor',admin:'Main Administrator',waze_admin:'Waze Admin',netafim_admin:'Netafim Admin'})[role]||role;}
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
  },err => {
    console.error('Firebase authentication initialisation failed:',err);
    window.StartUpShowError?.('Sign in is unavailable',
      'Firebase Authentication could not start. Check that Email/Password is enabled and the app configuration is correct.',err);
  });
}else render();

function h(value=''){return String(value ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function paragraphs(value=''){return h(value).replace(/\n/g,'<br>');}
function formValue(form,name){return (new FormData(form).get(name)||'').toString().trim();}
function memberNamesFromForm(form){const raw=formValue(form,'memberNames');const names=raw.split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);const seen=new Set();return names.filter(v=>{const key=v.toLocaleLowerCase('en-GB');if(seen.has(key))return false;seen.add(key);return true;});}
function memberNamesHTML(names){return Array.isArray(names)&&names.length?`<div class="membernames">${names.map(name=>`<span class="memberchip">${h(name)}</span>`).join('')}</div>`:'<p class="subtle">No team members listed yet.</p>'; }
function opts(values,selected){return values.map(v=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(v)}</option>`).join('');}
function humanDate(value){if(!value)return 'Just now';try {const date=value.toDate?value.toDate():new Date(value);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date);}catch{return 'Recently';}}
function toast(msg,error=false){toastEl.textContent=msg;toastEl.className=`toast show${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{toastEl.className='toast';},4200);}
function errorText(err){const code=err?.code||'';if(code==='permission-denied')return 'Permission denied. Check your team membership and the Firebase security rules.';if(code.includes('network'))return 'A network error occurred. Please try again.';if(code.includes('auth/invalid-credential'))return 'The email or password is incorrect.';if(code.includes('auth/email-already-in-use'))return 'An account already exists with this email address.';if(code.includes('auth/weak-password'))return 'Use a stronger password of at least six characters.';return (err?.message||'Something went wrong. Please try again.').replace(/^Firebase: /,'').slice(0,210);}
async function withBusy(fn){if(state.loading)return;state.loading=true;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);try {await fn();}catch(e){console.error(e);toast(errorText(e),true);}finally{state.loading=false;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=false);}}
function brand(){return `<img src="logo.png?v=5" width="64" height="64" style="width:64px;height:64px;max-width:64px;max-height:64px;object-fit:contain;flex-shrink:0" alt="StartUp logo" class="brandlogo"><span>StartUp<small>StandWithUs UK · Project Portal</small></span>`;}
function shell(body){return `<div class="shell"><header class="topbar"><div class="topinner"><a href="#" class="brand" data-action="home">${brand()}</a><div class="topactions"><span class="muted" style="font-size:12px">${h(state.profile?.name||'')}</span>${isAdministrator()?`<button class="btn small outline" data-action="admin">${h(isProgrammeAdmin()?'Main Admin':roleName(state.profile.role))}</button>`:''}<button class="btn small outline" data-action="home">Dashboard</button><button class="btn small secondary" data-action="signout">Sign out</button></div></div></header><main class="container">${body}</main><footer class="foot">StandWithUs UK | StartUp Project Portal</footer></div>`;}
function hero(kicker,title,description){return `<section class="hero"><div class="eyebrow">${h(kicker)}</div><h1>${h(title)}</h1><p>${h(description)}</p></section>`;}
function empty(title,text){return `<div class="empty"><strong>${h(title)}</strong>${h(text)}</div>`;}
function progress(teams){const stages=teams.map(t=>Number(t.progress||0));return stages.length?Math.round(stages.reduce((a,b)=>a+b,0)/stages.length):0;}
function render(){
  if(!configured){el.innerHTML=`<main class="authwrap"><section class="authaside"><a class="brand" href="#">${brand()}</a><div><h1>Ideas that begin with a question.</h1><p>A shared home for your team's research, creativity and impact.</p></div><div>DISCOVER · INVESTIGATE · INNOVATE · PITCH</div></section><section class="authmain"><div class="authbox"><div class="eyebrow">First time setup</div><h2>Connect your Firebase project</h2><p>The website is ready. To enable accounts, research sharing and document links, replace the example values in <span class="code">firebaseConfig.js</span> with your Firebase web application settings.</p><div class="alert">Read the included README for the complete setup instructions and security rules.</div></div></section></main>`;return;}
  if(!state.user){el.innerHTML=renderAuth();return;}
  if(!state.profile){el.innerHTML=shell(`<div class="card narrow"><h2>Account setup required</h2><p>Your login is recognised, but a user profile has not been created yet. If you are an administrator, follow the bootstrap instructions in README.md. If you just registered, try refreshing this page.</p><button class="btn primary" data-action="reload">Try again</button></div>`);return;}
  if(state.view==='team'&&state.team){el.innerHTML=shell(renderTeam());return;}
  if(state.view==='admin'&&isAdministrator()){el.innerHTML=shell(renderAdmin());return;}
  el.innerHTML=shell(renderDashboard());
}
function renderAuth(){
  const creating=Boolean(state.signUp);
  const nameInput=creating ? `<div class="field"><label for="name">Your name</label><input name="name" id="name" autocomplete="name" maxlength="70" required placeholder="First name and surname"></div>` : '';
  const resetButton=creating ? '' : `<div style="text-align:center;margin-top:17px"><button data-action="resetPassword" class="btn small secondary">Forgotten your password?</button></div>`;
  const heading=creating?'Create your account':'Sign in to your workspace';
  const intro=creating?'Create a student account. Your administrator will approve your request to join a team.':'Your team’s research and latest updates are waiting for you.';
  const submitText=creating?'Create student account':'Sign in';
  const toggleText=creating?'Already registered? Sign in':'New student? Create an account';
  const passwordAutoComplete=creating?'new-password':'current-password';
  return `<main class="authwrap">
    <section class="authaside">
      <a href="#" class="brand">${brand()}</a>
      <div><div class="eyebrow" style="color:#dcf7ff">STARTUP 2026/27</div>
        <h1>Research. Create.<br>Make an impact.</h1>
        <p>One place for your team to explore a real dilemma involving Israel, develop your ideas and get feedback from your supervisor.</p>
        <div class="authfeatures">
          <div class="authfeature">01 &nbsp; Discover your challenge</div>
          <div class="authfeature">02 &nbsp; Share your team's research</div>
          <div class="authfeature">03 &nbsp; Develop and present your StartUp</div>
        </div>
      </div>
      <div style="font-size:12px;opacity:.86">StandWithUs UK · Explore Programme</div>
    </section>
    <section class="authmain"><div class="authbox">
      <div class="eyebrow">Welcome to StartUp</div>
      <h2>${heading}</h2><p>${intro}</p>
      <form data-form="auth" class="stack" style="margin-top:25px">
        ${nameInput}
        <div class="field"><label for="email">Email address</label><input name="email" id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div class="field"><label for="password">Password</label><input name="password" id="password" type="password" minlength="6" autocomplete="${passwordAutoComplete}" required placeholder="At least six characters"></div>
        <button class="btn primary" type="submit">${submitText}</button>
      </form>
      <div class="divider"></div>
      <button data-action="toggleSignup" class="btn outline" style="width:100%">${toggleText}</button>
      ${resetButton}
      <p class="hint">Student accounts cannot access projects until an administrator approves their team membership.</p>
    </div></section>
  </main>`;
}

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
  const stream=adminStream();
  let teamSnaps=[];
  if(isProgrammeAdmin())teamSnaps=(await getDocs(collection(db,'teams'))).docs;
  else if(stream)teamSnaps=(await getDocs(query(collection(db,'teams'),where('stream','==',stream)))).docs;
  else if(profile.role==='supervisor')teamSnaps=(await getDocs(query(collection(db,'teams'),where('supervisorUids','array-contains',uid)))).docs;
  else teamSnaps=(await getDocs(query(collection(db,'teams'),where('memberUids','array-contains',uid)))).docs;
  state.teams=teamSnaps.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  await Promise.all(state.teams.map(async team=>{
    const project=await getDoc(doc(db,'projects',team.id));
    if(project.exists()){team.stageStatuses=project.data().stageStatuses||DEFAULT_STAGES;team.dilemma=project.data().dilemma||team.dilemma;}
  }));
  let directorySnaps=[];
  if(stream)directorySnaps=(await getDocs(query(collection(db,'teamDirectory'),where('stream','==',stream)))).docs;
  else if(isProgrammeAdmin()||profile.role==='student'||profile.role==='supervisor')directorySnaps=(await getDocs(collection(db,'teamDirectory'))).docs;
  state.directory=directorySnaps.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  if(isProgrammeAdmin()){
    const [rq,us]=await Promise.all([getDocs(collection(db,'requests')),getDocs(collection(db,'users'))]);
    state.requests=rq.docs.map(d=>({id:d.id,...d.data()}));
    state.users=us.docs.map(d=>({id:d.id,...d.data()}));
  }else if(stream){
    const rq=await getDocs(query(collection(db,'requests'),where('stream','==',stream)));
    state.requests=rq.docs.map(d=>({id:d.id,...d.data()}));
    state.users=[];
  }else{
    state.requests=[];state.users=[];
    if(profile.role==='student'){
      const rq=await getDocs(query(collection(db,'requests'),where('uid','==',uid)));
      state.requests=rq.docs.map(d=>({id:d.id,...d.data()}));
    }
  }
  state.view=state.view==='admin'&&isAdministrator()?'admin':'dashboard';
  render();
}
function teamCard(t){const completed=STAGES.filter(s=>t?.stageStatuses?.[s.id]==='complete').length;const perc=Math.round(100*completed/STAGES.length);return `<article class="card teamcard"><div class="teammeta"><span class="pill">${h(t.category||'StartUp')}</span><span class="pill dim">${h(t.cohort||'2026/27')}</span></div><h3>${h(t.name)}</h3><p class="muted cardsummary">${h((t.dilemma||'The team is preparing its dilemma statement.').slice(0,140))}</p><div class="row between subtle"><span>Project stages completed</span><strong>${completed}/${STAGES.length}</strong></div><div class="progressline"><span style="width:${perc}%"></span></div><div class="row between" style="margin-top:15px"><span class="subtle">${(t.memberNames||[]).length} listed · ${(t.memberUids||[]).length} accounts joined</span><button class="btn primary small" data-action="openTeam" data-id="${h(t.id)}">Open workspace</button></div></article>`;}
function renderDashboard(){
  const first=(state.profile.name||'there').split(' ')[0];
  const admin=isAdministrator();
  const stream=adminStream();
  const roleLabel=admin?roleName(state.profile.role).toUpperCase():state.profile.role==='supervisor'?'SUPERVISOR':'STUDENT';
  const pending=state.requests.filter(r=>r.status==='pending').length;
  let sections=hero(`STARTUP PROJECT PORTAL · ${roleLabel}`,`Welcome back, ${first}.`,state.profile.role==='student'?'Every great idea begins with a real problem. Follow your team’s progress and build your StartUp here.':stream?`Manage your ${streamName(stream)} teams, review their research and help students turn ideas into solutions.`:'Follow your teams, review their research and help them turn ideas into solutions.');
  if(admin)sections+=`<div class="pagehead"><h2>${stream?streamName(stream)+' overview':'Programme overview'}</h2><button class="btn primary" data-action="admin">Manage ${stream?'your cohort':'programme'}</button></div><div class="statrow"><div class="stat"><strong>${state.teams.length}</strong><span>Project teams</span></div>${isProgrammeAdmin()?`<div class="stat"><strong>${state.users.filter(u=>u.role==='student').length}</strong><span>Student accounts</span></div>`:''}<div class="stat"><strong>${pending}</strong><span>Access requests waiting</span></div></div>`;
  sections+=`<div class="pagehead"><h2>${admin?(stream?'Your cohort teams':'All teams'):state.profile.role==='supervisor'?'Your supervised teams':'Your team'}</h2><button class="btn outline small" data-action="reload">Refresh</button></div>`;
  sections+=state.teams.length?`<div class="grid">${state.teams.map(teamCard).join('')}</div>`:empty('No team assigned yet',state.profile.role==='student'?'Choose your team below and request access. An administrator will approve it.':'Create a team from the administration dashboard or ask the main administrator to assign an existing team to your cohort.');
  if(state.profile.role==='student'){
    const joined=new Set(state.teams.map(t=>t.id));
    const pendingIds=new Set(state.requests.filter(r=>r.status==='pending').map(r=>r.teamId));
    const available=state.directory.filter(d=>!joined.has(d.id)&&['waze','netafim'].includes(d.stream));
    sections+=`<div class="pagehead"><h2>Join a team</h2></div><div class="card narrow"><p class="muted" style="margin-top:0">Select your team from the list below. Your request must be approved before you can see its work.</p>${available.length?`<form data-form="join"><div class="field"><label for="teamid">Team</label><select name="teamid" id="teamid" required><option value="">Select your group</option>${available.map(d=>`<option value="${h(d.id)}">${h(d.name)} (${h(streamName(d.stream))})${pendingIds.has(d.id)?' · request pending':''}</option>`).join('')}</select></div><button class="btn primary" type="submit">Request team access</button></form>`:empty('No available teams','Your administrator has not published any teams for joining yet.')}${state.requests.filter(r=>r.status==='pending').length?`<p class="hint">Pending requests: ${state.requests.filter(r=>r.status==='pending').map(r=>h(state.directory.find(d=>d.id===r.teamId)?.name||'Team')).join(', ')}</p>`:''}</div>`;
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
function supervisorHere(){return isProgrammeAdmin()||(Boolean(adminStream())&&state.team?.stream===adminStream())||state.profile.role==='supervisor'&&(state.team.supervisorUids||[]).includes(state.user.uid);}
function renderTeam(){
  const t=state.team,p=state.project||{};
  const stageStatuses=p.stageStatuses||DEFAULT_STAGES;
  const completed=STAGES.filter(s=>stageStatuses[s.id]==='complete').length;
  const percent=Math.round(completed/STAGES.length*100);
  const tabs=[['overview','Overview'],['stages','Project stages'],['research',`Research (${state.resources.length})`],['journal',`Progress journal (${state.updates.length})`],['uploads',`Files (${state.uploads.length})`],['feedback',`Feedback (${state.feedback.length})`]];
  return `<div style="margin-bottom:15px"><button class="btn outline small" data-action="home">← All teams</button></div><section class="card"><div class="teamheader"><div><span class="pill">${h(t.category||'StartUp')}</span> <span class="pill dim">${h(t.cohort||'2026/27')}</span><h2>${h(t.name)}</h2><p class="muted" style="margin:0">${h(p.dilemma||'Your dilemma statement will appear here.')}</p><div class="roster-header"><span class="subtle">Team members</span>${memberNamesHTML(t.memberNames)}</div></div><button class="btn outline small" data-action="refreshTeam">Refresh team</button></div><div class="row between" style="margin-top:22px"><span class="subtle">Stage completion</span><b style="font-size:13px">${percent}% complete</b></div><div class="progressline"><span style="width:${percent}%"></span></div></section><nav class="tabs" aria-label="Team workspace sections">${tabs.map(([id,label])=>`<button class="tab ${state.tab===id?'active':''}" data-action="tab" data-id="${id}">${h(label)}</button>`).join('')}</nav>${({overview:renderOverview,stages:renderStages,research:renderResearch,journal:renderJournal,uploads:renderUploads,feedback:renderFeedback}[state.tab]||renderOverview)()}`;
}
function renderOverview(){const p=state.project||{};return `<div class="grid2"><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Project planning</h3><span class="pill">Shared document</span></div><p class="hint">Everyone in your team can update these fields. Please save your changes before switching sections.</p><form data-form="project">${PROJECT_FIELDS.map(([key,label,kind])=>`<div class="field"><label for="p_${key}">${h(label)}</label>${kind==='textarea'?`<textarea id="p_${key}" name="${key}" maxlength="3500" placeholder="Add your team's thoughts here…">${h(p[key]||'')}</textarea>`:kind==='select'?`<select id="p_${key}" name="${key}"><option value="">Choose a subject</option>${opts(CATEGORIES,p[key]||'')}</select>`:`<input id="p_${key}" name="${key}" maxlength="140" value="${h(p[key]||'')}" placeholder="Enter your StartUp name">`}</div>`).join('')}<button class="btn primary" type="submit">Save project plan</button></form></div><aside class="stack"><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Team members</h3><span class="pill">${(state.team.memberNames||[]).length} listed</span></div>${memberNamesHTML(state.team.memberNames)}${isAdministrator()?`<form data-form="editMembers" style="margin-top:18px"><div class="field"><label for="editMemberNames">Edit team member names</label><textarea id="editMemberNames" name="memberNames" rows="4" maxlength="1500" placeholder="One student per line">${h((state.team.memberNames||[]).join('\n'))}</textarea></div><p class="hint">Names are for the team register only. Students still need approved accounts to sign in.</p><button class="btn secondary" type="submit">Save team members</button></form>`:''}</div><div class="card"><h3 class="sectiontitle">Your project journey</h3><p class="muted" style="font-size:13px;line-height:1.6">Start with an actual dilemma involving Israel. Understand it, research existing responses, identify the gap and create a new solution.</p>${STAGES.map((s,i)=>`<div class="row" style="padding:8px 0;border-top:1px solid #eff3f7"><div class="introicon" style="width:29px;height:29px;font-size:12px">${i+1}</div><div style="flex:1"><strong style="font-size:13px">${h(s.name)}</strong></div><span class="pill ${p.stageStatuses?.[s.id]==='complete'?'good':'dim'}">${p.stageStatuses?.[s.id]==='complete'?'Done':'Open'}</span></div>`).join('')}</div><div class="card"><h3 class="sectiontitle">Recent activity</h3>${state.updates.length?state.updates.slice(0,3).map(x=>`<div class="item"><strong style="font-size:13px">${h(x.title)}</strong><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div></div>`).join(''):empty('Nothing recorded yet','Add your first progress update to start the team journal.')}</div></aside></div>`;}
function renderStages(){const statuses=state.project?.stageStatuses||DEFAULT_STAGES;const statusNames={'not_started':'Not started','in_progress':'In progress','complete':'Completed'};return `<div class="card"><div class="sectionhead"><h3 class="sectiontitle">Track your six project stages</h3><span class="pill">Team progress</span></div><p class="muted" style="font-size:13px;line-height:1.5">Update each stage as your team works through the StartUp Challenge. Changes are saved immediately and are visible to your supervisor.</p><div class="stagegrid">${STAGES.map((s,i)=>`<article class="stagecard"><div class="number">${i+1}</div><h4>${h(s.name)}</h4><p>${h(s.detail)}</p><label for="stage_${s.id}" class="subtle">Current status</label><select id="stage_${s.id}" data-stage="${s.id}">${Object.entries(statusNames).map(([val,name])=>`<option value="${val}" ${statuses[s.id]===val?'selected':''}>${name}</option>`).join('')}</select></article>`).join('')}</div></div>`;}
function itemActions(type,item){return (item.authorUid===state.user.uid||supervisorHere())?`<button class="btn small danger" data-action="deleteItem" data-type="${type}" data-id="${h(item.id)}">Remove</button>`:'';}
function renderResearch(){return `<div class="grid2"><div class="card"><h3 class="sectiontitle">Add a research source</h3><p class="hint">Record articles, reports, organisations and useful websites. Cite your source so your supervisor can review it.</p><form data-form="resource"><div class="field"><label>Source title</label><input name="title" maxlength="140" required placeholder="For example: Research report on regional water access"></div><div class="field"><label>Website or document link</label><input name="url" type="url" required placeholder="https://example.org/report"></div><div class="field"><label>Key findings and relevance</label><textarea name="notes" maxlength="2200" required placeholder="What did you learn and why is it important to your dilemma?"></textarea></div><button class="btn primary" type="submit">Add source</button></form></div><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Shared research library</h3><span class="pill">${state.resources.length} sources</span></div>${state.resources.length?state.resources.map(x=>`<article class="item"><div class="row between"><h4>${h(x.title)}</h4>${itemActions('resources',x)}</div><div class="meta">Added by ${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.notes)}</p><a class="linkline" href="${h(safeLink(x.url))}" target="_blank" rel="noopener noreferrer">View source</a></article>`).join(''):empty('No sources added yet','Add the first source your team has researched.')}</div></div>`;}
function renderJournal(){return `<div class="grid2"><div class="card"><h3 class="sectiontitle">Record a progress update</h3><p class="hint">Use the journal to share what has been completed, ask questions and record what needs to happen next.</p><form data-form="update"><div class="field"><label>Update type</label><select name="type">${opts(['Progress update','Milestone','Question for supervisor'],'Progress update')}</select></div><div class="field"><label>Title</label><input name="title" maxlength="140" required placeholder="For example: We identified our research gap"></div><div class="field"><label>Details</label><textarea name="body" maxlength="3500" required placeholder="What has your team achieved or what help do you need?"></textarea></div><button type="submit" class="btn primary">Post update</button></form></div><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Team journal</h3><span class="pill">${state.updates.length} updates</span></div>${state.updates.length?state.updates.map(x=>`<article class="item"><div class="row between"><span class="pill dim">${h(x.type)}</span>${itemActions('updates',x)}</div><h4 style="margin-top:11px">${h(x.title)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.body)}</p></article>`).join(''):empty('No updates yet','Share your first research or project milestone.')}</div></div>`;}

function renderUploads(){
  const ready=uploadsReady;
  const uploadForm=ready?`<form data-form="fileUpload" class="uploadform" style="margin-top:18px">
    <div class="field"><label for="fileDescription">Document title</label><input id="fileDescription" name="description" maxlength="140" required placeholder="For example: February first draft"></div>
    <div class="field"><label for="projectFile">Choose a file</label><input id="projectFile" name="projectFile" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp"></div>
    <p class="hint">Word, PowerPoint, PDF, spreadsheets, text and images. Maximum 20 MB per file.</p>
    <button class="btn primary" type="submit">Upload file securely</button>
    <div id="uploadProgress" class="upload-progress" aria-live="polite"></div>
  </form>`:`<div class="alert warning" style="margin-top:14px"><strong>Direct uploads are not connected yet.</strong> The programme administrator must complete the free Supabase setup in the included README and enter the two public settings in <code>storageConfig.js</code>. Document links still work below.</div>`;
  const largeFiles = `<div class="largefile-note" id="largeFileNotice" role="note"><strong>For files larger than 20MB please use <a href="https://wetransfer.com/" target="_blank" rel="noopener noreferrer">WeTransfer</a>.</strong><p>Upload the file on WeTransfer, then paste its transfer link into the document link form below. Transfer links may expire. WeTransfer requires users to be at least 16. If you are under 16, please ask your StartUp supervisor to handle the transfer. Only share pupils' work with authorised recipients.</p></div>`;
  return `<div class="grid2"><div class="stack"><div class="card"><div class="sectionhead"><h3 class="sectiontitle">Upload project files</h3><span class="pill good">Private team library</span></div><p class="muted" style="font-size:13px;line-height:1.5">Upload first drafts, presentations, research and supporting documents directly to your team workspace. Only approved team members and authorised staff can request a download.</p>${uploadForm}${largeFiles}</div>
  <div class="card"><h3 class="sectiontitle">Share an existing document link</h3><p class="hint">You can still share a school approved Google Drive or OneDrive document. Grant access to your team and authorised educators only.</p><form data-form="fileLink"><div class="field"><label>Document or presentation title</label><input name="description" maxlength="140" required placeholder="For example: Collaborative research document"></div><div class="field"><label>Secure document link</label><input name="url" type="url" required placeholder="https://docs.google.com/presentation/..."></div><button class="btn secondary" type="submit">Share document link</button></form></div></div>
  <div class="card"><div class="sectionhead"><h3 class="sectiontitle">Team files and presentations</h3><span class="pill">${state.uploads.length} items</span></div><p class="hint">Files are stored privately. Download links are created only when an approved team member opens a file, and they expire shortly afterwards.</p>${state.uploads.length?state.uploads.map(x=>`<article class="item fileitem"><div class="row" style="min-width:0"><div class="filetype">${x.kind==='stored'?'FILE':x.kind==='link'?'LINK':'FILE'}</div><div style="min-width:0"><h4>${h(x.description)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><div class="subtle file-description">${x.kind==='stored'?`${h(x.fileName||'Document')} · ${h(formatFileSize(x.sizeBytes||0))}`:x.kind==='link'?'External document link':'Earlier file entry'}</div></div></div><div class="row">${x.kind==='stored'?`<button class="btn outline small" data-action="openStoredFile" data-id="${h(x.id)}">Download</button>`:x.kind==='link'?`<a href="${h(safeLink(x.url))}" target="_blank" rel="noopener noreferrer" class="btn outline small">Open</a>`:`<span class="subtle">Please share this file again as a link</span>`}${itemActions('uploads',x)}</div></article>`).join(''):empty('No documents yet','Upload a file or share a secure document link.')}</div></div>`;
}
function formatFileSize(bytes){return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;}
async function fileFunction(action,details){
  if(!uploadsReady) throw new Error('Direct upload storage has not been configured. You may still share a document link.');
  const token=await state.user.getIdToken();
  const response=await fetch(`${storageConfig.supabaseUrl.replace(/\/$/,'')}/functions/v1/${storageConfig.functionName||'startup-files'}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'apikey':storageConfig.publishableKey},
    body:JSON.stringify({action,...details})
  });
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data.error||`File service error (${response.status}).`);
  return data;
}
function renderFeedback(){return `<div class="grid2">${supervisorHere()?`<div class="card"><h3 class="sectiontitle">Leave supervisor feedback</h3><p class="hint">Explain what the team has done well and what should be improved before the next stage.</p><form data-form="feedback"><div class="field"><label>Feedback heading</label><input name="title" maxlength="140" required placeholder="For example: First draft review"></div><div class="field"><label>Feedback and next steps</label><textarea name="body" maxlength="3500" required placeholder="What is strong? What should be changed? What needs to happen next?"></textarea></div><button class="btn primary" type="submit">Share feedback</button></form></div>`:`<div class="card"><h3 class="sectiontitle">Supervisor feedback</h3><p class="muted">Your supervisors can leave feedback here. Use the Progress journal to ask questions or flag anything you need help with.</p><div class="note">Supervisors can see all research, project updates and document links shared by your team.</div></div>`}<div class="card"><div class="sectionhead"><h3 class="sectiontitle">Feedback history</h3><span class="pill">${state.feedback.length} comments</span></div>${state.feedback.length?state.feedback.map(x=>`<article class="item"><h4>${h(x.title)}</h4><div class="meta">${h(x.authorName)} · ${humanDate(x.createdAt)}</div><p>${h(x.body)}</p></article>`).join(''):empty('No feedback yet','Supervisor comments will be shown here.')}</div></div>`;}

function renderAdmin(){
 const main=isProgrammeAdmin();
 const stream=adminStream();
 const pending=state.requests.filter(r=>r.status==='pending'&&(!stream||r.stream===stream));
 const supervisors=state.users.filter(u=>['supervisor','admin','waze_admin','netafim_admin'].includes(u.role));
 const scopeOptions=main?`<select name="stream" required><option value="">Select Waze or Netafim</option>${STREAMS.map(s=>`<option value="${s.id}">${h(s.label)}</option>`).join('')}</select>`:`<input type="hidden" name="stream" value="${h(stream)}"><div class="pill good">${h(streamName(stream))}</div>`;
 const supervisorOptions=main?`<div class="field"><label>Supervisor (optional)</label><select name="supervisor"><option value="">Use the cohort administrator</option>${supervisors.map(u=>`<option value="${h(u.id)}">${h(u.name)} (${h(u.email)})</option>`).join('')}</select><p class="hint">If no supervisor is selected, the designated Waze or Netafim administrator can manage the team automatically.</p></div>`:`<p class="note">You will automatically manage this team's research, membership requests and feedback.</p>`;
 const teamRows=state.teams.map(t=>{
   const names=(t.supervisorUids||[]).map(uid=>state.users.find(u=>u.id===uid)?.name||(uid===state.user.uid?state.profile.name:'Assigned educator'));
   const cohortDisplay=t.stream?streamName(t.stream):'Not assigned';
   const streamAssignment=main&&!t.stream?`<select data-team-stream="${h(t.id)}" aria-label="Assign cohort to ${h(t.name)}"><option value="">Assign cohort</option>${STREAMS.map(s=>`<option value="${s.id}">${h(s.label)}</option>`).join('')}</select>`:`<span class="pill ${t.stream?'good':'dim'}">${h(cohortDisplay)}</span>`;
   const selectSupervisor=main&&t.stream?`<select data-team-supervisor="${h(t.id)}" aria-label="Assign supervisor to ${h(t.name)}"><option value="">Add supervisor</option>${supervisors.map(u=>`<option value="${h(u.id)}">${h(u.name)}</option>`).join('')}</select>`:'';
   return `<tr><td><strong>${h(t.name)}</strong><br><span class="subtle">${h(t.cohort||'2026/27')}</span></td><td>${streamAssignment}</td><td><span class="memberlist-small">${(t.memberNames||[]).length?h(t.memberNames.join(', ')):'None yet'}</span></td><td>${(t.memberUids||[]).length}</td><td>${h(names.join(', ')||(t.stream?streamName(t.stream)+' Admin':'Unassigned'))}</td>${main?`<td>${selectSupervisor}</td>`:''}</tr>`;
 }).join('');
 const people=main?`<div class="pagehead"><h2>Registered people</h2></div><div class="card tablewrap">${state.users.length?`<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Change role</th></tr></thead><tbody>${[...state.users].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(u=>`<tr><td>${h(u.name)}</td><td>${h(u.email)}</td><td><span class="pill dim">${h(roleName(u.role))}</span></td><td>${u.id===state.user.uid?'Your account':`<select data-user-role="${h(u.id)}" aria-label="Change role for ${h(u.name)}">${ROLES.map(role=>`<option value="${h(role)}" ${role===u.role?'selected':''}>${h(roleName(role))}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table>`:empty('No accounts','Accounts will appear here after registration.')}</div><div class="alert warning" style="margin-top:16px">Main administrators manage staff roles across both cohorts. Assign Eden as Waze Admin and Eliana as Netafim Admin. Cohort administrators cannot change account roles or access the other cohort’s private work.</div>`:'';
 return `${hero('PROGRAMME ADMINISTRATION',stream?`Manage ${streamName(stream)}`:'Manage StartUp teams',stream?'Manage your teams, student requests and feedback within your cohort.':'Oversee both cohorts, assign teams to Waze or Netafim and manage staff permissions.')}
 <div class="pagehead"><h2>${stream?streamName(stream)+' management':'Programme management'}</h2><button data-action="reload" class="btn outline small">Refresh data</button></div>
 <div class="admincols"><div class="card"><h3 class="sectiontitle">Create a team</h3><form data-form="newTeam"><div class="field"><label>Team name</label><input name="name" required maxlength="90" placeholder="For example: ${stream==='netafim'?'Netafim':'Waze'} Team 1"></div><div class="field"><label>StartUp group</label>${scopeOptions}</div><div class="field"><label>Programme year</label><input name="cohort" maxlength="35" value="2026/27" required></div><div class="field"><label for="newMemberNames">Team member names (optional)</label><textarea id="newMemberNames" name="memberNames" rows="5" maxlength="1500" placeholder="Enter one student name per line"></textarea><p class="hint">Add the names now or later. This list is private to the team and its authorised staff. Names alone do not create logins.</p></div><div class="field"><label>Subject (optional)</label><select name="category"><option value="">Not selected yet</option>${opts(CATEGORIES,'')}</select></div>${supervisorOptions}<button class="btn primary" type="submit">Create team</button></form></div>
 <div class="card"><div class="sectionhead"><h3 class="sectiontitle">Membership requests</h3><span class="pill">${pending.length} pending</span></div>${pending.length?pending.map(r=>`<div class="item"><h4>${h(r.studentName||r.email||'Student')}</h4><p>${h(r.email||'')}</p><div class="subtle">Requested: ${h(state.directory.find(t=>t.id===r.teamId)?.name||state.teams.find(t=>t.id===r.teamId)?.name||'Unknown team')}</div><div class="row" style="margin-top:11px"><button class="btn primary small" data-action="approve" data-id="${h(r.id)}">Approve</button><button class="btn danger small" data-action="reject" data-id="${h(r.id)}">Decline</button></div></div>`).join(''):empty('No pending requests','Requests to join your teams will appear here.')}</div></div>
 <div class="pagehead"><h2>Team assignments</h2></div><div class="card tablewrap">${state.teams.length?`<table class="table"><thead><tr><th>Team</th><th>StartUp Group</th><th>Team members</th><th>Accounts joined</th><th>Supervisor</th>${main?'<th>Add supervisor</th>':''}</tr></thead><tbody>${teamRows}</tbody></table>`:empty('No teams yet','Create your first team using the form above.')}</div>
 ${main&&state.teams.some(t=>!t.stream)?`<div class="alert warning" style="margin-top:15px">Existing teams without a StartUp group must be assigned to Waze or Netafim by the main administrator before cohort administrators can see them. This does not delete existing student work.</div>`:''}
 ${people}`;
}

async function createPost(section,data){await addDoc(collection(db,'teams',state.team.id,section),{...data,authorUid:state.user.uid,authorName:state.profile.name,createdAt:serverTimestamp()});await loadTeam();}
function safeLink(url){try{const v=new URL(String(url));return ['https:','http:'].includes(v.protocol)?v.href:'#';}catch{return '#';}}

// Single delegated event listener keeps behaviour working after each render.
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b)return;
 event.preventDefault();const action=b.dataset.action,id=b.dataset.id;
 if(action==='toggleSignup'){state.signUp=!state.signUp;render();return;}
 if(action==='home'){state.team=null;state.view='dashboard';await withBusy(loadDashboard);return;}
 if(action==='admin'){if(!isAdministrator())return;state.view='admin';render();return;}
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
   const request=state.requests.find(r=>r.id===id);if(!request||(!isProgrammeAdmin()&&request.stream!==adminStream()))return;
   await withBusy(async()=>{
     if(action==='approve'){
       await updateDoc(doc(db,'teams',request.teamId),{memberUids:arrayUnion(request.uid)});
       await updateDoc(doc(db,'requests',id),{status:'approved',reviewedAt:serverTimestamp()});
     }else await updateDoc(doc(db,'requests',id),{status:'declined',reviewedAt:serverTimestamp()});
     await loadDashboard();toast(action==='approve'?'Access approved.':'Request declined.');
   });return;
 }
 if(action==='openStoredFile'){
   const current=state.uploads.find(f=>f.id===id);
   if(!current||current.kind!=='stored')return;
   // Open a blank tab immediately so popup blockers do not prevent a download.
   const tab=window.open('about:blank','_blank');
   if(tab){tab.document.title='Preparing your file';tab.document.body.textContent='Preparing your secure download…';}
   await withBusy(async()=>{
     try{
       const {url}=await fileFunction('download',{teamId:state.team.id,documentId:id});
       const fileURL=new URL(url);
       const expectedHost=new URL(storageConfig.supabaseUrl).hostname;
       if(fileURL.protocol!=='https:' || ![expectedHost,expectedHost.replace('.supabase.co','.storage.supabase.co')].includes(fileURL.hostname))
         throw new Error('The storage service returned an unexpected download address.');
       if(tab){tab.location.href=url;}else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click();}
     }catch(err){if(tab)tab.close();throw err;}
   });return;
 }
 if(action==='deleteItem'){
   if(!['updates','resources','uploads'].includes(b.dataset.type))return;
   if(!confirm('Remove this item from the team workspace?'))return;
   await withBusy(async()=>{
     const selected=b.dataset.type==='uploads'?state.uploads.find(f=>f.id===id):null;
     if(selected?.kind==='stored'){
       if(!uploadsReady)throw new Error('File storage must be configured to remove uploaded files safely.');
       await fileFunction('delete',{teamId:state.team.id,documentId:id});
     }else await deleteDoc(doc(db,'teams',state.team.id,b.dataset.type,id));
     await loadTeam();toast('Item removed.');
   });return;
 }
});

document.addEventListener('change',async event=>{
 const node=event.target;
 if(node.matches('input[name="projectFile"]')){
   const file=node.files?.[0];
   const area=document.getElementById('uploadProgress');
   if(area){
     if(file && file.size>MAX_FILE_BYTES){
       area.innerHTML='';
       area.textContent='This file is over 20 MB. Please use WeTransfer and share its link below.';
       area.classList.add('upload-warning');
     }else{
       area.textContent=file ? `${file.name} (${formatFileSize(file.size)}) is ready to upload.` : '';
       area.classList.remove('upload-warning');
     }
   }
   return;
 }
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
 if(node.matches('select[data-team-stream]')){
   if(!isProgrammeAdmin()||!['waze','netafim'].includes(node.value))return;
   const teamId=node.dataset.teamStream;
   const team=state.teams.find(t=>t.id===teamId);
   if(!team||team.stream)return;
   const stream=node.value;
   if(!confirm(`Assign ${team.name} to ${streamName(stream)}? Cohort administrators will then see its work.`)){node.value='';return;}
   await withBusy(async()=>{
     await updateDoc(doc(db,'teams',teamId),{stream});
     await updateDoc(doc(db,'teamDirectory',teamId),{stream});
     // Tag older membership requests so the correct cohort administrator can review them.
     const legacy=await getDocs(query(collection(db,'requests'),where('teamId','==',teamId)));
     for(const r of legacy.docs)await updateDoc(doc(db,'requests',r.id),{stream});
     await loadDashboard();toast(`${team.name} assigned to ${streamName(stream)}.`);
   });return;
 }
 if(node.matches('select[data-team-supervisor]')){
   if(!isProgrammeAdmin())return;
   if(!node.value)return;
   const team=state.teams.find(t=>t.id===node.dataset.teamSupervisor);
   const educator=state.users.find(u=>u.id===node.value);
   if(!team||!team.stream||!educator)return;
   if(['waze_admin','netafim_admin'].includes(educator.role)&&educator.role!==`${team.stream}_admin`)return toast('This cohort administrator can only be assigned to their own StartUp group.',true);
   await withBusy(async()=>{await updateDoc(doc(db,'teams',node.dataset.teamSupervisor),{supervisorUids:arrayUnion(node.value)});await loadDashboard();toast('Supervisor assigned.');});return;
 }
 if(node.matches('select[data-user-role]')){
   if(!isProgrammeAdmin()||!ROLES.includes(node.value))return;
   const account=state.users.find(u=>u.id===node.dataset.userRole);
   if(!account)return;
   const assignedEmail=(account.email||'').toLowerCase();
   const expectedEmail=node.value==='waze_admin'?'edeni@standwithus.com':node.value==='netafim_admin'?'egarfunkel@standwithus.com':'';
   if(expectedEmail&&assignedEmail!==expectedEmail){
     node.value=account.role;
     toast('This cohort administrator role is reserved for the designated educator.',true);
     return;
   }
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
   const teamId=formValue(form,'teamid');const teamDir=state.directory.find(t=>t.id===teamId);if(!teamDir||!['waze','netafim'].includes(teamDir.stream))return toast('Choose an available team.',true);
   if(state.requests.some(r=>r.teamId===teamId&&r.status==='pending'))return toast('Your request is already pending.',true);
   await withBusy(async()=>{await setDoc(doc(db,'requests',`${state.user.uid}_${teamId}`),{uid:state.user.uid,teamId,stream:teamDir.stream,status:'pending',studentName:state.profile.name,email:state.user.email,createdAt:serverTimestamp()});await loadDashboard();toast('Request sent for approval.');});return;
 }
 if(type==='newTeam'){
   await withBusy(async()=>{
     const name=formValue(form,'name'),cohort=formValue(form,'cohort'),category=formValue(form,'category'),supervisor=formValue(form,'supervisor');
     const memberNames=memberNamesFromForm(form);
     if(memberNames.length>12||memberNames.some(n=>n.length>90))return toast('Add up to 12 names, one per line, with no name longer than 90 characters.',true);
     const stream=isProgrammeAdmin()?formValue(form,'stream'):adminStream();
     if(!['waze','netafim'].includes(stream))return toast('Select Waze or Netafim.',true);
     const cohortAdmin=state.users.find(u=>u.role===`${stream}_admin`);
     const selectedSupervisor=state.users.find(u=>u.id===supervisor);
     if(supervisor&&(!selectedSupervisor||(['waze_admin','netafim_admin'].includes(selectedSupervisor.role)&&selectedSupervisor.role!==`${stream}_admin`)))return toast('Choose an educator authorised for this cohort.',true);
     const supervisorUids=supervisor?[supervisor]:isProgrammeAdmin()?(cohortAdmin?[cohortAdmin.id]:[]):[state.user.uid];
     const team=await addDoc(collection(db,'teams'),{name,cohort,stream,category,dilemma:'',memberNames,memberUids:[],supervisorUids,createdBy:state.user.uid,createdAt:serverTimestamp()});
     await Promise.all([
       setDoc(doc(db,'teamDirectory',team.id),{name,cohort,stream,createdAt:serverTimestamp()}),
       setDoc(doc(db,'projects',team.id),{name:'',category,dilemma:'',summary:'',existing:'',gap:'',solution:'',audience:'',operation:'',partners:'',impact:'',nextSteps:'',stageStatuses:DEFAULT_STAGES,updatedBy:state.user.uid,updatedAt:serverTimestamp()})
     ]);
     await loadDashboard();toast('Team created with '+memberNames.length+' team member names. Students can now request access.');
   });return;
 }
 if(type==='editMembers'){
   if(!isAdministrator()||!state.team||(adminStream()&&state.team.stream!==adminStream()))return toast('Only your cohort administrator can edit this team register.',true);
   const memberNames=memberNamesFromForm(form);
   if(memberNames.length>12||memberNames.some(n=>n.length>90))return toast('Add up to 12 names, one per line, with no name longer than 90 characters.',true);
   await withBusy(async()=>{
     await updateDoc(doc(db,'teams',state.team.id),{memberNames});
     state.team.memberNames=memberNames;
     const teamInList=state.teams.find(t=>t.id===state.team.id);
     if(teamInList)teamInList.memberNames=memberNames;
     render();toast('Team member names saved.');
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
 if(type==='fileUpload'){
   const file=form.querySelector('input[name="projectFile"]')?.files?.[0];
   if(!file)return toast('Choose a file first.',true);
   const ext=file.name.toLowerCase().split('.').pop();
   if(!ALLOWED_FILE_EXTENSIONS.includes(ext))return toast('Choose a PDF, Office document, text file or image.',true);
   if(file.size>MAX_FILE_BYTES){document.getElementById('largeFileNotice')?.scrollIntoView({behavior:'smooth',block:'center'});return toast('For files larger than 20MB please use WeTransfer. Share its link below.',true);}
   if(file.size<1)return toast('The file is empty. Please select another file.',true);
   if(!uploadsReady)return toast('The administrator has not connected private file storage yet.',true);
   const description=formValue(form,'description');
   if(!description||description.length>140)return toast('Add a document title.',true);
   await withBusy(async()=>{
     const progress=document.getElementById('uploadProgress');
     if(progress)progress.textContent='Checking team access…';
     const {path,token}=await fileFunction('prepare-upload',{
       teamId:state.team.id,fileName:file.name,fileSize:file.size,mimeType:file.type||'application/octet-stream'
     });
     if(progress)progress.textContent='Uploading '+file.name+'…';
     const fileStorage=await getFileStorageClient();
     const {error}=await fileStorage.storage.from(storageConfig.bucket||'startup-team-files')
       .uploadToSignedUrl(path,token,file,{contentType:file.type||'application/octet-stream',upsert:false});
     if(error)throw error;
     if(progress)progress.textContent='Saving the file to your team library…';
     try{
       await createPost('uploads',{kind:'stored',description,fileName:file.name,sizeBytes:file.size,
         mimeType:file.type||'application/octet-stream',storagePath:path,url:''});
       toast('File uploaded to your team library.');
     }catch(error){
       try{await fileFunction('abort-upload',{teamId:state.team.id,path});}catch(err){console.warn('Could not remove incomplete upload',err);}
       throw error;
     }
   });return;
 }
 if(type==='fileLink'){
   const url=formValue(form,'url');if(safeLink(url)==='#'||!url.startsWith('https://'))return toast('Enter a secure HTTPS document link.',true);
   await withBusy(async()=>{await createPost('uploads',{kind:'link',description:formValue(form,'description'),url,fileName:''});toast('Presentation link added.');});return;
 }

});
