import { parseYUML, DEFAULT_YUML } from "../lib/yuml.js";

const memory = globalThis.__GUTHEB_ACTIONS__ ||= new Map();

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
function makeRun(workflow,ref,yuml,plan){
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
export async function onRequestGet({request}){
  const u=new URL(request.url),op=u.searchParams.get("op")||"runs";
  const runs=[...memory.values()].filter(x=>x.kind==="run").sort((a,b)=>b.run_number-a.run_number);
  if(op==="runs") return json({runs:runs.slice(0,100)});
  if(op==="jobs"){
    const r=memory.get(u.searchParams.get("run_id"));
    return r?json({jobs:r.jobs||[]}):json({error:"Run not found"},404);
  }
  if(op==="artifacts"){
    const r=memory.get(u.searchParams.get("run_id"));
    return r?json({artifacts:r.artifacts||[]}):json({error:"Run not found"},404);
  }
  if(op==="logs"){
    const r=[...memory.values()].find(x=>x.kind==="run"&&x.jobs?.some(j=>j.id===u.searchParams.get("job_id")));
    const j=r?.jobs?.find(x=>x.id===u.searchParams.get("job_id"));
    return j?json({logs:j.logs||""}):json({error:"Job not found"},404);
  }
  if(op==="default") return json({yuml:DEFAULT_YUML});
  return json({error:"Unknown operation"},400);
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
