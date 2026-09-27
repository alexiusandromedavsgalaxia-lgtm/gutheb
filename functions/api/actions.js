const REPO = "alexiusandromedavsgalaxia-lgtm/gutheb";
const API = "https://api.github.com";
const headers = (env) => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {})
});
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
async function gh(path,env,options={}){
  const r=await fetch(API+path,{...options,headers:{...headers(env),...(options.headers||{})}});
  const text=await r.text();
  let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const e=new Error(data?.message||`GitHub API ${r.status}`);e.status=r.status;e.data=data;throw e}
  return data;
}
export async function onRequestGet({request,env}){
  const u=new URL(request.url),op=u.searchParams.get("op")||"runs";
  try{
    if(op==="runs"){
      const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||30),1),100);
      const d=await gh(`/repos/${REPO}/actions/runs?per_page=${limit}`,env);
      return json({runs:d.workflow_runs||[]});
    }
    if(op==="jobs"){
      const id=u.searchParams.get("run_id");if(!id)return json({error:"run_id is required"},400);
      const d=await gh(`/repos/${REPO}/actions/runs/${encodeURIComponent(id)}/jobs?per_page=100`,env);
      return json({jobs:d.jobs||[]});
    }
    if(op==="artifacts"){
      const id=u.searchParams.get("run_id");if(!id)return json({error:"run_id is required"},400);
      const d=await gh(`/repos/${REPO}/actions/runs/${encodeURIComponent(id)}/artifacts?per_page=100`,env);
      return json({artifacts:d.artifacts||[]});
    }
    if(op==="logs"){
      const id=u.searchParams.get("job_id");if(!id)return json({error:"job_id is required"},400);
      const r=await fetch(`${API}/repos/${REPO}/actions/jobs/${encodeURIComponent(id)}/logs`,{headers:headers(env),redirect:"follow"});
      const text=await r.text();if(!r.ok)return json({error:"GitHub could not return job logs"},r.status);
      return json({logs:text});
    }
    return json({error:"Unknown operation"},400);
  }catch(e){return json({error:e.message,configured:!!env.GITHUB_TOKEN},e.status||500)}
}
export async function onRequestPost({request,env}){
  if(!env.GITHUB_TOKEN)return json({error:"GutHeb Actions needs the GITHUB_TOKEN Cloudflare secret to dispatch workflows or rerun jobs."},503);
  try{
    const body=await request.json().catch(()=>({}));
    if(body.action==="rerun"){
      const id=body.run_id;if(!id)return json({error:"run_id is required"},400);
      await gh(`/repos/${REPO}/actions/runs/${encodeURIComponent(id)}/rerun`,env,{method:"POST"});
      return json({ok:true});
    }
    if(body.action==="cancel"){
      const id=body.run_id;if(!id)return json({error:"run_id is required"},400);
      await gh(`/repos/${REPO}/actions/runs/${encodeURIComponent(id)}/cancel`,env,{method:"POST"});
      return json({ok:true});
    }
    const workflow=body.workflow||"gutheb-ci.yml",ref=body.ref||"main";
    const allowed=new Set(["gutheb-ci.yml"]);
    if(!allowed.has(workflow))return json({error:"Workflow is not allowed"},400);
    await gh(`/repos/${REPO}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,env,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ref})});
    return json({ok:true,workflow,ref});
  }catch(e){return json({error:e.message},e.status||500)}
}
