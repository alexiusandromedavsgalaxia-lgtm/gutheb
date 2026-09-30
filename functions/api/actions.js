import { parseYUML, DEFAULT_YUML } from "../lib/yuml.js";

const memory = globalThis.__GUTHEB_ACTIONS__ ||= new Map();

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "access-control-allow-origin":"*",
    "access-control-allow-headers":"content-type"
  }});
}
function id(prefix="run"){return prefix+"_"+crypto.randomUUID().replaceAll("-","").slice(0,16)}
function now(){return new Date().toISOString()}
function hashToken(token){
  return crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""));
}
function sessionTokenFrom(request){
  const raw=request.headers.get("Cookie")||"";
  for(const part of raw.split(";")){
    const i=part.indexOf("=");
    if(i<0)continue;
    if(part.slice(0,i).trim()!=="gutheb_session")continue;
    const value=part.slice(i+1).trim();
    try{return decodeURIComponent(value)}catch{return value}
  }
  return "";
}
async function sessionUser(request,env){
  const users=env.USERS_DB||env.users||env.USERS||env.GUTHEB_DB;
  if(!users)return null;
  const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|;)\\s*gutheb_session=([^;]+)/);
  if(!m)return null;
  let sessionToken="";try{sessionToken=decodeURIComponent(sessionToken);}catch{sessionToken=sessionToken;}const hash=await hashToken(sessionToken);
  return users.prepare("SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(hash,new Date().toISOString()).first();
}
async function ensureRunSchema(db){
  if(!db)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS action_runs (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      event TEXT NOT NULL,
      head_branch TEXT NOT NULL,
      status TEXT NOT NULL,
      conclusion TEXT,
      source TEXT NOT NULL,
      runner TEXT NOT NULL,
      yuml TEXT NOT NULL,
      yuml_plan TEXT NOT NULL,
      jobs TEXT NOT NULL,
      artifacts TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_action_runs_number ON action_runs(run_number DESC)")
  ]);
  const cols=await db.prepare("PRAGMA table_info(action_runs)").all();
  if(!cols.results?.some(x=>x.name==="owner_id")){
    await db.prepare("ALTER TABLE action_runs ADD COLUMN owner_id TEXT").run();
  }
}
function rowRun(r){
  return {
    ...r,
    run_number:Number(r.run_number),
    yuml_plan:JSON.parse(r.yuml_plan||"{}"),
    jobs:JSON.parse(r.jobs||"[]"),
    artifacts:JSON.parse(r.artifacts||"[]")
  };
}
async function nextRunNumber(db,ownerId){
  if(db){
    await ensureRunSchema(db);
    const row=await db.prepare("SELECT COALESCE(MAX(run_number),0)+1 AS n FROM action_runs WHERE owner_id=?").bind(ownerId).first();
    return Number(row?.n||1);
  }
  return [...memory.values()].filter(x=>x.kind==="run"&&x.owner_id===ownerId).reduce((max,x)=>Math.max(max,Number(x.run_number)||0),0)+1;
}
async function makeRun(workflow,ref,yuml,plan,db,ownerId){
  const runId=id("run"),jobId=id("job");
  return {
    id:runId,
    owner_id:ownerId, run_number:await nextRunNumber(db,ownerId),
    name:workflow||plan.name,
    event:"workflow_dispatch",
    head_branch:ref||"main",
    status:"queued",
    conclusion:null,
    source:"gutheb",
    runner:plan.runner||"linux",
    yuml,
    yuml_plan:plan,
    created_at:now(),
    updated_at:now(),
    jobs:[{
      id:jobId,
      name:plan.name||"GutHeb job",
      status:"queued",
      conclusion:null,
      runner_name:"GutHeb Runner",
      runner_os:plan.runner||"linux",
      steps:plan.steps||[],
      logs:""
    }],
    artifacts:[]
  };
}
async function persistRun(db,run){
  if(!db)return;
  await ensureRunSchema(db);
  await db.prepare(`INSERT OR REPLACE INTO action_runs
    (id,owner_id,run_number,name,event,head_branch,status,conclusion,source,runner,yuml,yuml_plan,jobs,artifacts,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(run.id,run.owner_id,run.run_number,run.name,run.event,run.head_branch,run.status,run.conclusion,run.source,run.runner,run.yuml,JSON.stringify(run.yuml_plan||{}),JSON.stringify(run.jobs||[]),JSON.stringify(run.artifacts||[]),run.created_at,run.updated_at)
    .run();
}
async function getRun(db,idValue,ownerId){
  if(db){
    await ensureRunSchema(db);
    const row=await db.prepare("SELECT * FROM action_runs WHERE id=? AND owner_id=?").bind(idValue,ownerId).first();
    return row?rowRun(row):null;
  }
  const run=memory.get(idValue)||null; return run&&run.owner_id===ownerId?run:null;
}

export async function onRequestGet({request,env}){
  const user=await sessionUser(request,env);
  if(!user)return json({error:"Not authenticated."},401);
  const u=new URL(request.url),op=u.searchParams.get("op")||"runs",db=env.actions;
  if(op==="default")return json({yuml:DEFAULT_YUML});
  if(db){
    await ensureRunSchema(db);
    if(op==="runs"){
      const rows=await db.prepare("SELECT * FROM action_runs WHERE owner_id=? ORDER BY run_number DESC LIMIT 100").bind(user.id).all();
      return json({runs:(rows.results||[]).map(rowRun)});
    }
    const run=await getRun(db,u.searchParams.get("run_id"),user.id);
    if(!run)return json({error:"Run not found"},404);
    if(op==="jobs")return json({jobs:run.jobs||[]});
    if(op==="artifacts")return json({artifacts:run.artifacts||[]});
    if(op==="logs"){
      const job=(run.jobs||[]).find(x=>x.id===u.searchParams.get("job_id"));
      return job?json({logs:job.logs||""}):json({error:"Job not found"},404);
    }
    return json({error:"Unknown operation"},400);
  }
  const runs=[...memory.values()].filter(x=>x.kind==="run"&&x.owner_id===user.id).sort((a,b)=>b.run_number-a.run_number);
  if(op==="runs")return json({runs:runs.slice(0,100)});
  const run=memory.get(u.searchParams.get("run_id"));if(run?.owner_id!==user.id)return json({error:"Run not found"},404);
  if(!run)return json({error:"Run not found"},404);
  if(op==="jobs")return json({jobs:run.jobs||[]});
  if(op==="artifacts")return json({artifacts:run.artifacts||[]});
  if(op==="logs"){
    const job=run.jobs?.find(x=>x.id===u.searchParams.get("job_id"));
    return job?json({logs:job.logs||""}):json({error:"Job not found"},404);
  }
  return json({error:"Unknown operation"},400);
}

export async function onRequestPost({request,env}){
  const user=await sessionUser(request,env);
  if(!user)return json({error:"Not authenticated."},401);
  const body=await request.json().catch(()=>({}));
  if(body.action==="validate"){
    try{return json({ok:true,plan:parseYUML(body.yuml||"")});}
    catch(e){return json({ok:false,error:e?.message||"Invalid YUML"},400)}
  }
  if(body.action==="dispatch"){
    try{
      const yuml=String(body.yuml||"").trim();
      const plan=parseYUML(yuml);
      const run=await makeRun(body.workflow||plan.name,body.ref||"main",yuml,plan,env.actions,user.id);
      memory.set(run.id,{kind:"run",...run});
      await persistRun(env.actions,run);
      return json({ok:true,run});
    }catch(e){return json({ok:false,error:e?.message||"Could not dispatch Action"},400)}
  }
  if(body.action==="cancel"){
    const r=await getRun(env.actions,body.run_id,user.id);
    if(!r)return json({error:"Run not found"},404);
    r.status="completed";r.conclusion="cancelled";r.updated_at=now();
    r.jobs=(r.jobs||[]).map(j=>({...j,status:"completed",conclusion:"cancelled"}));
    memory.set(r.id,{kind:"run",...r});
    await persistRun(env.actions,r);
    return json({ok:true,run:r});
  }
  if(body.action==="rerun"){
    const r=await getRun(env.actions,body.run_id,user.id);
    if(!r)return json({error:"Run not found"},404);
    const next=await makeRun(r.name,r.head_branch,r.yuml,r.yuml_plan,env.actions,user.id);
    memory.set(next.id,{kind:"run",...next});
    await persistRun(env.actions,next);
    return json({ok:true,run:next});
  }
  return json({error:"Unknown action"},400);
}
export async function onRequestOptions(){
  return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"content-type",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
  }});
}