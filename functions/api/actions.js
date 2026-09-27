import { parseYUML, DEFAULT_YUML } from "../lib/yuml.js";

const memory = globalThis.__GUTHEB_ACTIONS__ ||= new Map();

async function sessionUser(request, env){
  const users=env.USERS_DB;
  if(!users)return null;
  const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|; )gutheb_session=([^;]+)/);
  if(!m)return null;
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(m[1])))].map(x=>x.toString(16).padStart(2,"0")).join("");
  return users.prepare("SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(hash,new Date().toISOString()).first();
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "access-control-allow-origin":"*"
  }});
}
function id(prefix="run"){return prefix+"_"+crypto.randomUUID().replaceAll("-","").slice(0,16)}
function now(){return new Date().toISOString()}
function normalize(run){
  return {...run,created_at:run.created_at||now(),updated_at:now()};
}
async function ensureRunSchema(db){
  if(!db)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS action_runs (
    id TEXT PRIMARY KEY, run_number INTEGER NOT NULL, name TEXT NOT NULL, event TEXT NOT NULL,
    head_branch TEXT NOT NULL, status TEXT NOT NULL, conclusion TEXT, source TEXT NOT NULL,
    runner TEXT NOT NULL, yuml TEXT NOT NULL, yuml_plan TEXT NOT NULL, jobs TEXT NOT NULL,
    artifacts TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_action_runs_number ON action_runs(run_number DESC)").run();
}
async function persistRun(db,run){
  if(!db)return;
  await ensureRunSchema(db);
  await db.prepare(`INSERT OR REPLACE INTO action_runs
    (id,run_number,name,event,head_branch,status,conclusion,source,runner,yuml,yuml_plan,jobs,artifacts,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(run.id,run.run_number,run.name,run.event,run.head_branch,run.status,run.conclusion,run.source,run.runner,run.yuml,JSON.stringify(run.yuml_plan||{}),JSON.stringify(run.jobs||[]),JSON.stringify(run.artifacts||[]),run.created_at,run.updated_at).run();
}
function rowRun(r){return {...r,yuml_plan:JSON.parse(r.yuml_plan||"{}"),jobs:JSON.parse(r.jobs||"[]"),artifacts:JSON.parse(r.artifacts||"[]")};}
\nfunction makeRun(workflow,ref,yuml,plan){
  const runId=id("run");
  const jobId=id("job");
  return normalize({
    id:runId,run_number:[...memory.values()].filter(x=>x.kind==="run").length+1,
    name:workflow||plan.name,event:"workflow_dispatch",head_branch:ref||"main",
    status:"queued",conclusion:null,source:"gutheb",runner:plan.runner||"linux",
    yuml,yuml_plan:plan,created_at:now(),updated_at:now(),
    jobs:[{id:jobId,name:plan.name||"GutHeb job",status:"queued",conclusion:null,
      runner_name:"GutHeb Runner",runner_os:plan.runner||"linux",steps:plan.steps||[],logs:""}],
    artifacts:[]
  });
}
export async function onRequestGet({request,env}){
  const user=await sessionUser(request,env);if(!user)return json({error:"Not authenticated."},401);
  const u=new URL(request.url),op=u.searchParams.get("op")||"runs",db=env.actions;
  if(db){await ensureRunSchema(db);
    if(op==="runs"){const rows=await db.prepare("SELECT * FROM action_runs ORDER BY run_number DESC LIMIT 100").all();return json({runs:(rows.results||[]).map(rowRun)});}
    const id=u.searchParams.get("run_id");const r=id?await db.prepare("SELECT * FROM action_runs WHERE id=?").bind(id).first():null;
    if(!r)return json({error:"Run not found"},404);const run=rowRun(r);
    if(op==="jobs")return json({jobs:run.jobs||[]});
    if(op==="artifacts")return json({artifacts:run.artifacts||[]});
    if(op==="logs"){const j=(run.jobs||[]).find(x=>x.id===u.searchParams.get("job_id"));return j?json({logs:j.logs||""}):json({error:"Job not found"},404);}
    if(op==="default")return json({yuml:DEFAULT_YUML});
    return json({error:"Unknown operation"},400);
  }
  const runs=[...memory.values()].filter(x=>x.kind==="run").sort((a,b)=>b.run_number-a.run_number);
  if(op==="runs")return json({runs:runs.slice(0,100)});
  const r=memory.get(u.searchParams.get("run_id"));if(!r)return json({error:"Run not found"},404);
  if(op==="jobs")return json({jobs:r.jobs||[]});if(op==="artifacts")return json({artifacts:r.artifacts||[]});
  if(op==="logs"){const j=r.jobs?.find(x=>x.id===u.searchParams.get("job_id"));return j?json({logs:j.logs||""}):json({error:"Job not found"},404);}
  if(op==="default")return json({yuml:DEFAULT_YUML});return json({error:"Unknown operation"},400);
}
export async function onRequestPost({request}){
  const body=await request.json().catch(()=>({}));
  if(body.action==="validate"){
    try{return json({ok:true,plan:parseYUML(body.yuml||"")});}
    catch(e){return json({ok:false,error:e.message},400)}
  }
  if(body.action==="dispatch"){
    try{
      const yuml=String(body.yuml||"").trim();
      const plan=parseYUML(yuml);
      const run=makeRun(body.workflow||plan.name,body.ref||"main",yuml,plan);
      memory.set(run.id,{kind:"run",...run});
      return json({ok:true,run});
    }catch(e){return json({ok:false,error:e.message},400)}
  }
  if(body.action==="cancel"){
    const r=memory.get(body.run_id);
    if(!r)return json({error:"Run not found"},404);
    r.status="completed";r.conclusion="cancelled";r.updated_at=now();
    r.jobs=(r.jobs||[]).map(j=>({...j,status:"completed",conclusion:"cancelled"}));
    return json({ok:true,run:r});
  }
  if(body.action==="rerun"){
    const r=memory.get(body.run_id);
    if(!r)return json({error:"Run not found"},404);
    const next=makeRun(r.name,r.head_branch,r.yuml,r.yuml_plan);
    memory.set(next.id,{kind:"run",...next});
    return json({ok:true,run:next});
  }
  return json({error:"Unknown action"},400);
}
