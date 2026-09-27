const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});

async function sha(s){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function userFrom(request,env){
  const db=env.USERS_DB||env.users||env.USERS||env.GUTHEB_DB;
  if(!db)return null;
  const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|; )gutheb_session=([^;]+)/);if(!m)return null;
  return await db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await sha(m[1]),new Date().toISOString()).first();
}
function parseUrl(value){
  let raw=String(value||"").trim();
  if(!raw)return null;
  if(!/^https?:\/\//i.test(raw))raw="https://github.com/"+raw.replace(/^\/+|\/+$/g,"");
  try{
    const u=new URL(raw);if(u.hostname.toLowerCase()!=="github.com")return null;
    const parts=u.pathname.split("/").filter(Boolean);if(parts.length<2)return null;
    const owner=parts[0],repo=parts[1].replace(/\.git$/i,"");
    if(!/^[A-Za-z0-9_.-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo))return null;
    return {owner,repo};
  }catch{return null}
}
async function gh(path){
  const r=await fetch("https://api.github.com"+path,{headers:{"Accept":"application/vnd.github+json","User-Agent":"GutHeb-Repository-Importer"}});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||"GitHub request failed");return data;
}
export async function onRequestPost({request,env}){
  if(!(await userFrom(request,env)))return json({error:"Not authenticated."},401);
  let body={};try{body=await request.json()}catch{}
  const parsed=parseUrl(body.url);if(!parsed)return json({error:"Enter a valid public GitHub repository URL, for example https://github.com/owner/repository."},400);
  try{
    const meta=await gh("/repos/"+encodeURIComponent(parsed.owner)+"/"+encodeURIComponent(parsed.repo));
    if(meta.private)return json({error:"Private GitHub repositories cannot be imported without GitHub account authorization."},403);
    const branch=String(body.branch||meta.default_branch||"main");
    const tree=await gh("/repos/"+encodeURIComponent(parsed.owner)+"/"+encodeURIComponent(parsed.repo)+"/git/trees/"+encodeURIComponent(branch)+"?recursive=1");
    if(tree.truncated)return json({error:"This GitHub repository is too large to import in one operation."},413);
    const all=(tree.tree||[]).filter(x=>x.type==="blob"&&x.path);
    if(all.length>500)return json({error:"This repository has more than 500 files. The importer currently accepts up to 500 files."},413);
    const files={};const folders=new Set();let total=0;
    for(const entry of all){
      if(entry.size&&entry.size>1024*1024)continue;
      const blob=await gh("/repos/"+encodeURIComponent(parsed.owner)+"/"+encodeURIComponent(parsed.repo)+"/git/blobs/"+encodeURIComponent(entry.sha));
      let content="";
      if(blob.encoding==="base64"){
        const raw=atob(String(blob.content||"").replace(/\s/g,"")),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        if(bytes.some(b=>b===0))continue;content=new TextDecoder().decode(bytes);
      }else content=String(blob.content||"");
      total+=content.length;if(total>10*1024*1024)break;
      files[entry.path]=content;
      const parts=entry.path.split("/");for(let i=1;i<parts.length;i++)folders.add(parts.slice(0,i).join("/"));
    }
    return json({ok:true,repository:{owner:meta.owner?.login||parsed.owner,name:meta.name||parsed.repo,description:meta.description||"",visibility:"Public",language:meta.language||"",license:meta.license?.spdx_id||"",stars:meta.stargazers_count||0,forks:meta.forks_count||0,updated:"just now",files,folders:[...folders],defaultBranch:branch,source:"github",sourceUrl:meta.html_url}});
  }catch(e){return json({error:e.message||"Could not import repository from GitHub."},502)}
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"}})}
