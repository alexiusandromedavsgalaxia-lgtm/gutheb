const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
function dbs(env){return {users:env.USERS_DB||env.users||env.USERS||env.GUTHEB_DB,repos:env.REPOS_DB||env.repositories||env.REPOSITORIES||env.GUTHEB_DB,pages:env.pages};}
async function ensurePagesSchema(db){
  if(!db)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS pages_sites (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      project_name TEXT NOT NULL UNIQUE,
      framework TEXT NOT NULL,
      build_command TEXT DEFAULT '',
      output_dir TEXT DEFAULT '',
      root_dir TEXT DEFAULT '',
      branch TEXT DEFAULT 'main',
      cloudflare_url TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pages_sites_owner ON pages_sites(owner_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pages_sites_repo ON pages_sites(repo_id)")
  ]);
}
async function sha256(value){const b=new TextEncoder().encode(value);const h=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function userFrom(request,env){const {users}=dbs(env);if(!users)return null;const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|; )gutheb_session=([^;]+)/);if(!m)return null;const tokenHash=await sha256(m[1]);const s=await users.prepare("SELECT user_id,expires_at FROM sessions WHERE token_hash=?").bind(tokenHash).first();if(!s||new Date(s.expires_at)<=new Date())return null;const u=await users.prepare("SELECT id,username,email FROM users WHERE id=?").bind(s.user_id).first();return u||null;}
const mime=p=>({"html":"text/html","htm":"text/html","css":"text/css","js":"text/javascript","mjs":"text/javascript","json":"application/json","svg":"image/svg+xml","png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","gif":"image/gif","webp":"image/webp","ico":"image/x-icon","txt":"text/plain","xml":"application/xml","wasm":"application/wasm","webmanifest":"application/manifest+json"}[String(p).split(".").pop().toLowerCase()]||"application/octet-stream");
const safeName=s=>String(s||"").toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"gutheb-site";
async function cf(env,path,init={}){if(!env.CLOUDFLARE_API_TOKEN||!env.CLOUDFLARE_ACCOUNT_ID)throw new Error("Cloudflare Pages is not connected. Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the Pages project secrets.");const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)+path,{...init,headers:{"Authorization":"Bearer "+env.CLOUDFLARE_API_TOKEN,"Content-Type":"application/json",...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d?.errors?.[0]?.message||"Cloudflare Pages API request failed");return d;}
async function getRepo(repos,id,userId){return await repos.prepare("SELECT id,name,owner_id FROM repos WHERE id=? AND owner_id=?").bind(id,userId).first();}
export async function onRequestPost({request,env}){
  const {repos,pages}=dbs(env);if(!repos)return json({error:"REPOS_DB is not bound to this Pages project."},503);
  const user=await userFrom(request,env);if(!user)return json({error:"Not authenticated."},401);
  const b=await request.json().catch(()=>({})),action=String(b.action||"");
  if(pages)await ensurePagesSchema(pages);
  if(action==="detect"){
    const repo=await getRepo(repos,b.repoId,user.id);if(!repo)return json({error:"Repository not found."},404);
    const rows=await repos.prepare("SELECT path,content FROM repo_files WHERE repo_id=?").bind(repo.id).all();const files=rows.results||[];
    const names=new Set(files.map(x=>x.path));let framework="Static HTML",buildCommand="",outputDir="";
    if(names.has("next.config.js")||names.has("next.config.mjs")){framework="Next.js static";buildCommand="npx next build";outputDir="out";}
    else if(names.has("astro.config.mjs")){framework="Astro";buildCommand="npm run build";outputDir="dist";}
    else if(names.has("package.json")&&(names.has("vite.config.js")||names.has("vite.config.ts")||names.has("src/main.jsx")||names.has("src/main.tsx")||names.has("src/main.js")||names.has("src/main.ts"))) {framework="React / Vite";buildCommand="npm run build";outputDir="dist";}
    else if(names.has("package.json")){framework="Node / custom";buildCommand="npm run build";outputDir="dist";}
    else if(names.has("index.html")){framework="Static HTML";buildCommand="";outputDir="";}
    return json({framework,buildCommand,outputDir,files:files.map(x=>x.path)});
  }
  if(action==="preview"){
    const repo=await getRepo(repos,b.repoId,user.id);if(!repo)return json({error:"Repository not found."},404);
    const rows=await repos.prepare("SELECT path,content FROM repo_files WHERE repo_id=?").bind(repo.id).all();const files=Object.fromEntries((rows.results||[]).map(x=>[x.path,String(x.content||"")]));
    const index=String(b.indexPath||"index.html").replace(/^\.\//,"").replace(/^\/+|\/+$/g,"");if(!files[index])return json({error:"No "+index+" found. Build the project first or select another HTML file."},404);
    return json({html:files[index],path:index});
  }
  if(action==="deploy"){
    const repo=await getRepo(repos,b.repoId,user.id);if(!repo)return json({error:"Repository not found."},404);
    const config=b.config||{},projectName=safeName(config.projectName||repo.name),branch=String(config.branch||"main"),output=String(config.outputDir||"").replace(/^\/+|\/+$/g,""),root=String(config.rootDir||"").replace(/^\/+|\/+$/g,"");
    const rows=await repos.prepare("SELECT path,content FROM repo_files WHERE repo_id=?").bind(repo.id).all();const all=Object.fromEntries((rows.results||[]).map(x=>[x.path,String(x.content||"")]));
    let files=Object.entries(all).filter(([p])=>!root||p===root||p.startsWith(root+"/")).map(([p,v])=>[root&&p.startsWith(root+"/")?p.slice(root.length+1):p,v]);
    if(output)files=files.filter(([p])=>p===output||p.startsWith(output+"/")).map(([p,c])=>[p.slice(output.length).replace(/^\//,"")||"index.html",c]);
    else files=files.filter(([p])=>!p.startsWith(".git/")&&!p.startsWith(".gut/")&&!p.startsWith(".gh/")&&!p.startsWith("node_modules/"));
    if(!files.length)return json({error:"There are no deployable files. For React/Vite, build the project first so the configured output directory exists."},400);
    if(files.length>20000)return json({error:"Pages deployment is limited to 20,000 files."},400);
    for(const [path,content] of files){if(new TextEncoder().encode(content).byteLength>25*1024*1024)return json({error:"File exceeds the 25 MiB Pages asset limit: "+path},400);}
    let project;
    try{project=await cf(env,"/pages/projects/"+encodeURIComponent(projectName));}
    catch{project=await cf(env,"/pages/projects",{method:"POST",body:JSON.stringify({name:projectName,production_branch:branch,build_config:{build_command:String(config.buildCommand||""),destination_dir:output||"."}})});}
    const tokenData=await cf(env,"/pages/projects/"+encodeURIComponent(projectName)+"/upload-token");
    const jwt=tokenData.result?.jwt;if(!jwt)throw new Error("Cloudflare did not return a Pages upload token.");
    const manifest={};const assets=[];
    for(const [path,content] of files){const hash=await sha256(content);manifest[path]=hash;assets.push({path,content,hash});}
    const headers={"Authorization":"Bearer "+jwt,"Content-Type":"application/json"};
    const missingRes=await fetch("https://api.cloudflare.com/client/v4/pages/assets/check-missing",{method:"POST",headers,body:JSON.stringify({hashes:assets.map(x=>x.hash)})});const missingData=await missingRes.json();if(!missingRes.ok)throw new Error(missingData?.errors?.[0]?.message||"Could not check Pages assets.");const missing=new Set(missingData.result||[]);
    for(let i=0;i<assets.length;i+=50){const batch=assets.filter(x=>missing.has(x.hash)).slice(i,i+50);if(!batch.length)continue;const payload=batch.map(x=>({key:x.hash,value:x.content,base64:false,metadata:{contentType:mime(x.path)}}));const up=await fetch("https://api.cloudflare.com/client/v4/pages/assets/upload",{method:"POST",headers,body:JSON.stringify(payload)});const ud=await up.json();if(!up.ok||ud.success===false)throw new Error(ud?.errors?.[0]?.message||"Could not upload Pages assets.");}
    const depBody=new FormData();depBody.set("manifest",JSON.stringify(manifest));depBody.set("branch",branch);depBody.set("commit_dirty","false");depBody.set("commit_message","Deploy "+repo.name+" from GutHeb Pages");depBody.set("pages_build_output_dir",output||".");
    const dep=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)+"/pages/projects/"+encodeURIComponent(projectName)+"/deployments",{method:"POST",headers:{"Authorization":"Bearer "+env.CLOUDFLARE_API_TOKEN},body:depBody});const dd=await dep.json();if(!dep.ok||dd.success===false)throw new Error(dd?.errors?.[0]?.message||"Pages deployment failed.");
    const url=dd.result?.url||dd.result?.aliases?.[0]||"";
    if(pages){
      const now=new Date().toISOString();
      await pages.prepare(`INSERT INTO pages_sites(id,owner_id,repo_id,project_name,framework,build_command,output_dir,root_dir,branch,cloudflare_url,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(project_name) DO UPDATE SET repo_id=excluded.repo_id,framework=excluded.framework,build_command=excluded.build_command,output_dir=excluded.output_dir,root_dir=excluded.root_dir,branch=excluded.branch,cloudflare_url=excluded.cloudflare_url,updated_at=excluded.updated_at`)
        .bind(crypto.randomUUID(),user.id,repo.id,projectName,String(config.framework||"Custom"),String(config.buildCommand||""),output,root,branch,url,now,now).run();
    }
    return json({ok:true,project:projectName,deployment:dd.result,url});
  }
  if(action==="deployments"){
    const projectName=safeName(b.projectName);const d=await cf(env,"/pages/projects/"+encodeURIComponent(projectName)+"/deployments");return json({deployments:d.result||[]});
  }
  return json({error:"Unknown Pages action."},400);
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"}})}
