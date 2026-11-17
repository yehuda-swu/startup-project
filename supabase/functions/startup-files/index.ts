// StartUp Portal private files gateway
// Supabase Edge Function. Deploy as startup-files with verify_jwt = false.
// Authentication is NOT disabled: we validate the Firebase ID token by making
// a Firestore REST read that is governed by the existing Firestore security rules.
// Never put Supabase service-role or secret keys in the public website.
import { createClient } from 'npm:@supabase/supabase-js@2';

const FIREBASE_PROJECT = 'startup-project-portal';
const BUCKET = 'startup-team-files';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf','doc','docx','ppt','pptx','xls','xlsx','txt','csv','png','jpg','jpeg','webp'
]);
const ALLOWED_ORIGINS = new Set([
  'https://yehuda-swu.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (!supabaseUrl || !serviceKey) console.error('Missing Supabase server environment variables');
const storageAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const str = (x: unknown) => typeof x === 'string' ? x : '';
const field = (f: Record<string, any> | undefined, name: string) => f?.[name]?.stringValue ?? '';
const list = (f: Record<string, any> | undefined, name: string): string[] =>
  (f?.[name]?.arrayValue?.values ?? []).map((x: any) => str(x.stringValue)).filter(Boolean);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function reply(body: Record<string,unknown>, status: number, origin: string) {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','Vary':'Origin'});
  if (ALLOWED_ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin',origin);
  headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info');
  headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
  return new Response(JSON.stringify(body),{status,headers});
}

function decodeFirebaseClaims(token: string) {
  // Extracts claims only to use after a successful Firestore request with this
  // exact token, which verifies its signature, issuer and permissions.
  try {
    const base = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(base)) as Record<string,any>;
  } catch { throw new HttpError(401,'Sign in again to continue.'); }
}
const validTeamId = (id:string) => /^[A-Za-z0-9_-]{10,128}$/.test(id);
const validDocId = (id:string) => /^[A-Za-z0-9_-]{8,128}$/.test(id);
const validUid = (id:string) => /^[A-Za-z0-9_-]{6,150}$/.test(id);
const validPath = (id:string, path:string) => new RegExp(`^${id}/[A-Za-z0-9_-]{6,150}/[a-f0-9-]{36}\\.[a-z0-9]{1,10}$`).test(path);

async function firestoreRequest(path: string, token: string, method = 'GET') {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const response=await fetch(url,{
    method,
    headers:{'Authorization':`Bearer ${token}`,'Accept':'application/json'}
  });
  if (response.status===401) throw new HttpError(401,'Sign in again to access project files.');
  if (response.status===403 || response.status===404) throw new HttpError(403,'You do not have access to this team or file.');
  if (!response.ok) throw new HttpError(502,'Could not verify access with Firebase.');
  return method==='DELETE' ? {} : await response.json();
}

Deno.serve(async (request:Request) => {
  const origin=request.headers.get('origin')||'';
  if (request.method==='OPTIONS') return reply({},204,origin);
  if (request.method!=='POST')return reply({error:'POST only.'},405,origin);
  if (origin && !ALLOWED_ORIGINS.has(origin))return reply({error:'This website is not authorised to use file storage.'},403,origin);
  try {
    if (!serviceKey || !supabaseUrl) throw new HttpError(503,'File storage service is not configured.');
    const header=request.headers.get('authorization')||'';
    const token=header.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || token.length>5000)throw new HttpError(401,'Please sign in first.');
    const body=await request.json();
    const action=str(body.action);
    const teamId=str(body.teamId);
    if (!validTeamId(teamId))throw new HttpError(400,'Invalid team reference.');

    // Firestore verifies the Firebase ID token and enforces private team read
    // access. This avoids requiring paid Firebase Cloud Functions or custom JWT claims.
    const team=await firestoreRequest(`teams/${teamId}`,token);
    const claims=decodeFirebaseClaims(token);
    const uid=str(claims.user_id||claims.sub);
    if (!validUid(uid) || claims.iss!==`https://securetoken.google.com/${FIREBASE_PROJECT}` || claims.aud!==FIREBASE_PROJECT)
      throw new HttpError(401,'Authentication details do not match this portal.');

    if (action==='prepare-upload') {
      const fileName=str(body.fileName);
      const size=Number(body.fileSize);
      const mime=str(body.mimeType)||'application/octet-stream';
      const ext=fileName.toLowerCase().split('.').pop()||'';
      if (!fileName || fileName.length>200 || !ALLOWED_EXTENSIONS.has(ext))
        throw new HttpError(400,'Only PDF, Office documents, text files and images are accepted.');
      if (!Number.isSafeInteger(size)||size<1||size>MAX_FILE_SIZE)
        throw new HttpError(400,'The file must be smaller than 20 MB.');
      if (mime.length>120 || /[\r\n]/.test(mime))throw new HttpError(400,'Invalid file type.');
      const path=`${teamId}/${uid}/${crypto.randomUUID()}.${ext}`;
      const {data,error}=await storageAdmin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
      if (error || !data?.token)throw new HttpError(502,'Unable to prepare a private upload. Check the bucket setup.');
      return reply({path,token:data.token},200,origin);
    }
    if (action==='abort-upload') {
      const path=str(body.path);
      if (!validPath(teamId,path) || !path.startsWith(`${teamId}/${uid}/`)) throw new HttpError(403,'You cannot cancel this upload.');
      const {error}=await storageAdmin.storage.from(BUCKET).remove([path]);
      if(error)throw new HttpError(502,'Could not remove the incomplete upload.');
      return reply({ok:true},200,origin);
    }
    if (action==='download'||action==='delete') {
      const docId=str(body.documentId);
      if (!validDocId(docId))throw new HttpError(400,'Invalid file reference.');
      // Firestore verifies the user can read this exact file record, not just the team.
      const record=await firestoreRequest(`teams/${teamId}/uploads/${docId}`,token);
      const f=record.fields as Record<string,any> | undefined;
      const path=field(f,'storagePath');
      const fileName=field(f,'fileName');
      if (field(f,'kind')!=='stored' || !validPath(teamId,path))
        throw new HttpError(400,'This is not a securely stored file.');
      if (action==='download') {
        // Force attachment to reduce risks from files containing active content.
        const safeName=(fileName||'project-file').replace(/[\r\n"\\/]/g,'_').slice(0,150);
        const {data,error}=await storageAdmin.storage.from(BUCKET).createSignedUrl(path,90,{download:safeName});
        if (error || !data?.signedUrl)throw new HttpError(404,'File not found in private storage.');
        return reply({url:data.signedUrl},200,origin);
      }
      const profile=await firestoreRequest(`users/${uid}`,token);
      const role=field(profile.fields,'role');
      const teamStream=field(team.fields,'stream');
      const staff = role==='admin'||
        (role==='waze_admin' && teamStream==='waze')||
        (role==='netafim_admin' && teamStream==='netafim')||
        (role==='supervisor' && list(team.fields,'supervisorUids').includes(uid));
      if (field(f,'authorUid')!==uid && !staff)throw new HttpError(403,'Only the uploader or a supervisor can remove this file.');
      const {error}=await storageAdmin.storage.from(BUCKET).remove([path]);
      if (error)throw new HttpError(502,'Could not remove the stored file.');
      await firestoreRequest(`teams/${teamId}/uploads/${docId}`,token,'DELETE');
      return reply({ok:true},200,origin);
    }
    throw new HttpError(400,'Unknown file action.');
  } catch(error) {
    console.error('Private file service failure:',error instanceof HttpError?error.message:error);
    const status=error instanceof HttpError?error.status:500;
    return reply({error:error instanceof HttpError?error.message:'An unexpected file service error occurred.'},status,origin);
  }
});
