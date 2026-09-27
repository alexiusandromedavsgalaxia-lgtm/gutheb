const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});

async function sha(s){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function currentUser(request,env){
  const users=env.USERS_DB;if(!users)return null;
  const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|; )gutheb_session=([^;]+)/);if(!m)return null;
  return users.prepare("SELECT u.id,u.username,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await sha(m[1]),new Date().toISOString()).first();
}
function db(env){return env.repositories||env.REPOS_DB||env.REPOSITORIES||env.GUTHEB_DB}
async function ensureRepoSchema(d){
  const required=[["repos","id"],["repos","owner_id"],["repos","name"],["repo_files","repo_id"],["repo_files","path"],["repo_files","content"],["repo_folders","repo_id"],["repo_folders","path"]];
  for(const [table,column] of required){const q=await d.prepare("PRAGMA table_info("+table+")").all();if(!q.results?.some(x=>x.name===column))throw new Error("GUT storage schema is missing "+table+"."+column);}
}
async function schema(d){
  await d.batch([
    d.prepare(`CREATE TABLE IF NOT EXISTS gut_archives (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS gut_codespaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, repo_id TEXT, name TEXT, created_at TEXT NOT NULL)`)
  ]);
}
async function repoFor(d,user,repo){
  const name=String(repo||"").replace(/^\\/+|\\/+$/g,"");if(!name)return null;
  return d.prepare("SELECT * FROM repos WHERE owner_id=? AND name=?").bind(user.id,name).first();
}
async function repoSnapshot(d,r,user){
  if(!r)return null;
  const fs=await d.prepare("SELECT path,content FROM repo_files WHERE repo_id=? ORDER BY path").bind(r.id).all();
  const folders=await d.prepare("SELECT path FROM repo_folders WHERE repo_id=? ORDER BY path").bind(r.id).all();
  return {...r,owner:user.username,files:Object.fromEntries((fs.results||[]).map(x=>[x.path,x.content])),folders:(folders.results||[]).map(x=>x.path)};
}
function archivePayload(snapshot,name,root=""){
  const prefix=root.replace(/^\.\//,"").replace(/^\\/+|\\/+$/g,"");const files={};
  for(const [p,c] of Object.entries(snapshot.files||{}))if(!prefix||p===prefix||p.startsWith(prefix+"/"))files[prefix&&p.startsWith(prefix+"/")?p.slice(prefix.length+1):p]=String(c??"");
  return JSON.stringify({format:"GUT-ARCHIVE",version:1,name,repository:snapshot.owner+"/"+snapshot.name,root:prefix,files,folders:(snapshot.folders||[]).filter(x=>!prefix||x===prefix||x.startsWith(prefix+"/")).map(x=>prefix&&x.startsWith(prefix+"/")?x.slice(prefix.length+1):x),created_at:new Date().toISOString()});
}
function parseCommand(command){
  const s=String(command||"").trim();
  const m=s.match(/^gut\\s+pash\\s+-g\\s+clone\\s+archive\\s+(.+)$/i);if(m)return {op:"clone_archive",archive:m[1].trim()};
  const c=s.match(/^gut\\s+pash\\s+-g\\s+create\\s+archive\\s+([^\\s]+)\\s+-&\\s+pash\\s+directory\\s+(.+)$/i);if(c)return {op:"create_archive",archive:c[1],directory:c[2]};
  const delCodespace=s.match(/^gut\\s+pash\\s+-g\\s+delete(?:\\s+(.+))?$/i);if(delCodespace)return {op:"pash_delete",target:(delCodespace[1]||"").trim()};
  const cl=s.match(/^gut\\s+clone\\s+-([^\\s]+)$/i);if(cl)return {op:"clone",repo:cl[1]};
  const del=s.match(/^gut\\s+delete\\s+-(repo|archivo|raw|codespace|action|carpeta)\\s+(.+)$/i);if(del)return {op:"delete",kind:del[1].toLowerCase(),target:del[2].trim()};
  return null;
}
async function execute({request,env,body}){
  const user=await currentUser(request,env);if(!user)return json({error:"Not authenticated."},401);
  const d=db(env);if(!d)return json({error:"REPOS_DB/repositories is not bound."},503);
  await schema(d);await ensureRepoSchema(d);
  const p=parseCommand(body.command);
  if(!p)return json({error:"Invalid GUT command.",commands:["gut pash -g clone archive <archive>","gut pash -g create archive <archive> -& pash directory ./<carpet>","gut pash -g delete","gut clone -<repo>","gut delete -<repo|archivo|raw|codespace|action|carpeta> <target>"]},400);

  if(p.op==="pash_delete"){
    const code=String(body.codespace_id||body.session_id||"").trim();
    if(!code)return json({error:"Codespace session required. Pass codespace_id or session_id."},400);
    const repoName=String(body.repo||"").trim();
    return json({ok:true,protocol:"GUT/1",operation:"pash_delete",kind:"codespace",codespace_id:code,repo:repoName||null,cleared:true,workspaceOnly:true});
  }

  if(p.op==="clone"){
    const r=await repoFor(d,user,p.repo);if(!r)return json({error:"Repository not found."},404);
    return json({ok:true,protocol:"GUT/1",operation:"clone",repository:await repoSnapshot(d,r,user)});
  }

  if(p.op==="create_archive"){
    const r=await repoFor(d,user,body.repo||p.archive);if(!r)return json({error:"Repository not found. Pass repo in the request body or use the archive name as the repository name."},404);
    const snapshot=await repoSnapshot(d,r,user),payload=archivePayload(snapshot,p.archive,p.directory);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await d.prepare("INSERT INTO gut_archives(id,owner_id,name,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,user.id,p.archive,payload,now,now).run();
    return json({ok:true,protocol:"GUT/1",operation:"create_archive",archive:{id,name:p.archive,bytes:payload.length,download:"/api/gut?archive="+encodeURIComponent(id)}},201);
  }

  if(p.op==="clone_archive"){
    const a=await d.prepare("SELECT id,name,payload,created_at,updated_at FROM gut_archives WHERE owner_id=? AND (id=? OR name=?) ORDER BY updated_at DESC LIMIT 1").bind(user.id,p.archive,p.archive).first();
    if(!a)return json({error:"Archive not found."},404);let payload={};try{payload=JSON.parse(a.payload)}catch{}
    return json({ok:true,protocol:"GUT/1",operation:"clone_archive",archive:{id:a.id,name:a.name,created_at:a.created_at,updated_at:a.updated_at},payload});
  }

  if(p.op==="delete"&&p.kind==="repo"){
    const target=await repoFor(d,user,p.target);if(!target)return json({error:"Repository not found."},404);
    await d.batch([d.prepare("DELETE FROM repo_files WHERE repo_id=?").bind(target.id),d.prepare("DELETE FROM repo_folders WHERE repo_id=?").bind(target.id),d.prepare("DELETE FROM repos WHERE id=? AND owner_id=?").bind(target.id,user.id)]);
    return json({ok:true,protocol:"GUT/1",operation:"delete",kind:"repo",target:p.target});
  }

  if(p.op==="delete"&&(p.kind==="archivo"||p.kind==="raw"||p.kind==="carpeta")){
    const targetRepo=await repoFor(d,user,body.repo||"");if(!targetRepo)return json({error:"Repository required for file/folder deletion."},400);
    const target=p.target.replace(/^\.\//,"").replace(/^\\/+|\\/+$/g,"");
    if(p.kind==="carpeta")await d.batch([d.prepare("DELETE FROM repo_files WHERE repo_id=? AND (path=? OR path LIKE ?||'/%')").bind(targetRepo.id,target,target),d.prepare("DELETE FROM repo_folders WHERE repo_id=? AND (path=? OR path LIKE ?||'/%')").bind(targetRepo.id,target,target)]);
    else await d.prepare("DELETE FROM repo_files WHERE repo_id=? AND path=?").bind(targetRepo.id,target).run();
    return json({ok:true,protocol:"GUT/1",operation:"delete",kind:p.kind,target,repo:targetRepo.name});
  }

  if(p.op==="delete"&&p.kind==="codespace"){
    const result=await d.prepare("DELETE FROM gut_codespaces WHERE owner_id=? AND (id=? OR name=?)").bind(user.id,p.target,p.target).run();
    return json({ok:true,protocol:"GUT/1",operation:"delete",kind:"codespace",target:p.target,deleted:Number(result.meta?.changes||0)});
  }

  if(p.op==="delete"&&p.kind==="action"){
    const actions=env.actions;if(!actions)return json({error:"GutHeb Actions database is not bound."},503);
    const row=await actions.prepare("SELECT id,owner_id FROM actions WHERE id=? OR slug=?").bind(p.target,p.target).first();if(!row)return json({error:"Action not found."},404);
    if(row.owner_id!==user.id)return json({error:"Only the Action creator can delete it."},403);
    await actions.prepare("DELETE FROM actions WHERE id=?").bind(row.id).run();
    return json({ok:true,protocol:"GUT/1",operation:"delete",kind:"action",target:p.target});
  }
  return json({error:"Unsupported GUT operation."},400);
}
export async function onRequestPost({request,env}){let body={};try{body=await request.json()}catch{}return execute({request,env,body})}
export async function onRequestGet({request,env}){
  const u=new URL(request.url),archive=u.searchParams.get("archive");if(!archive)return json({protocol:"GUT/1",status:"ok",endpoint:"/api/gut"});
  const user=await currentUser(request,env);if(!user)return json({error:"Not authenticated."},401);const d=db(env);if(!d)return json({error:"REPOS_DB/repositories is not bound."},503);await schema(d);
  const a=await d.prepare("SELECT name,payload FROM gut_archives WHERE owner_id=? AND id=?").bind(user.id,archive).first();if(!a)return json({error:"Archive not found."},404);
  const filename=a.name.replace(/[^a-z0-9._-]+/gi,"_")+".gutarchive.json";
  return new Response(a.payload,{status:200,headers:{"Content-Type":"application/gut+json","Content-Disposition":"attachment; filename=\""+filename+"\"","Cache-Control":"no-store"}});
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}})}
