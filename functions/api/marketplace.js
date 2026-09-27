const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});

async function sha(s){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function currentUser(request,env){
  const users=env.USERS_DB;
  if(!users)return null;
  const raw=request.headers.get("Cookie")||"",m=raw.match(/(?:^|; )gutheb_session=([^;]+)/);
  if(!m)return null;
  const tokenHash=await sha(m[1]);
  return users.prepare("SELECT u.id,u.username,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,new Date().toISOString()).first();
}
async function ensureSchema(db){
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT NOT NULL,
      definition TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_actions_published_updated ON actions(published, updated_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_actions_owner ON actions(owner_id)`)
  ]);

  // Built-in first-party Action. It is seeded into the real guthebactions D1
  // so it appears in Marketplace without requiring a manual publish request.
  const seedDefinition = `{
    actionName = "DRF Run Build"
    action {
        'build' = true;
        'branch' = '/iso'
        'file' = '.iso'
        "make GutHeb Actions do a ISO file"
    }
  }`;
  await db.prepare(`INSERT OR IGNORE INTO actions
    (id,owner_id,author_name,slug,name,version,description,definition,published,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,1,?,?)`)
    .bind(
      "guthub-action-drf-run-build",
      "guthub",
      "GutHeb",
      "drf-run-build",
      "DRF Run Build",
      "1.0.0",
      "This Action builds your repo into an ISO in branch /iso.",
      seedDefinition,
      "2026-09-27T00:00:00.000Z",
      "2026-09-27T00:00:00.000Z"
    )
    .run();
}

function slugify(value){
  return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
}

export async function onRequestGet({request,env}){
  const db=env.actions;
  if(!db)return json({error:"env.actions is not bound to the guthebactions D1 database."},503);
  await ensureSchema(db);
  const u=new URL(request.url),op=u.searchParams.get("op")||"actions";
  if(op==="actions"){
    const rows=await db.prepare("SELECT id,owner_id,author_name,slug,name,version,description,definition,created_at,updated_at FROM actions WHERE published=1 ORDER BY updated_at DESC").all();
    return json({actions:rows.results||[]});
  }
  if(op==="action"){
    const id=u.searchParams.get("id");
    if(!id)return json({error:"Action id required."},400);
    const row=await db.prepare("SELECT id,owner_id,author_name,slug,name,version,description,definition,created_at,updated_at FROM actions WHERE id=? AND published=1").bind(id).first();
    return row?json({action:row}):json({error:"Action not found."},404);
  }
  return json({error:"Unknown operation."},400);
}

export async function onRequestPost({request,env}){
  const db=env.actions;
  if(!db)return json({error:"env.actions is not bound to the guthebactions D1 database."},503);
  await ensureSchema(db);
  const user=await currentUser(request,env);
  if(!user)return json({error:"Not authenticated."},401);
  let b={};try{b=await request.json()}catch{}
  if(String(b.action||"")!=="publish")return json({error:"Unknown action."},400);
  const name=String(b.name||"").trim(),version=String(b.version||"").trim(),description=String(b.description||"").trim(),definition=String(b.definition||"");
  if(!name||!version||!description||!definition.trim())return json({error:"Name, version, description and Action definition are required."},400);
  const slug=slugify(name);
  if(!slug)return json({error:"Action name must contain letters or numbers."},400);
  const conflict=await db.prepare("SELECT id FROM actions WHERE slug=?").bind(slug).first();
  if(conflict)return json({error:"An Action with this name already exists in the Marketplace."},409);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare("INSERT INTO actions(id,owner_id,author_name,slug,name,version,description,definition,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?, ?,1,?,?)")
    .bind(id,user.id,user.username,slug,name,version,description,definition,now,now).run();
  const row=await db.prepare("SELECT id,owner_id,author_name,slug,name,version,description,definition,created_at,updated_at FROM actions WHERE id=?").bind(id).first();
  return json({ok:true,action:row},201);
}

export async function onRequestOptions(){
  return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"}});
}


export async function onRequestPut({request,env}){
  const db=env.actions;
  if(!db)return json({error:"env.actions is not bound to the guthebactions D1 database."},503);
  await ensureSchema(db);
  const user=await currentUser(request,env);
  if(!user)return json({error:"Not authenticated."},401);
  let b={};try{b=await request.json()}catch{}
  const id=String(b.id||"");
  if(!id)return json({error:"Action id required."},400);
  const existing=await db.prepare("SELECT id,owner_id FROM actions WHERE id=?").bind(id).first();
  if(!existing)return json({error:"Action not found."},404);
  if(existing.owner_id!==user.id)return json({error:"Only the Action creator can edit it."},403);
  const name=String(b.name||"").trim(),version=String(b.version||"").trim(),description=String(b.description||"").trim(),definition=String(b.definition||"");
  if(!name||!version||!description||!definition.trim())return json({error:"Name, version, description and Action definition are required."},400);
  const slug=slugify(name);
  if(!slug)return json({error:"Action name must contain letters or numbers."},400);
  const conflict=await db.prepare("SELECT id FROM actions WHERE slug=? AND id<>?").bind(slug,id).first();
  if(conflict)return json({error:"Another Action with this name already exists."},409);
  const now=new Date().toISOString();
  await db.prepare("UPDATE actions SET slug=?,name=?,version=?,description=?,definition=?,updated_at=? WHERE id=? AND owner_id=?")
    .bind(slug,name,version,description,definition,now,id,user.id).run();
  const row=await db.prepare("SELECT id,owner_id,author_name,slug,name,version,description,definition,created_at,updated_at FROM actions WHERE id=?").bind(id).first();
  return json({ok:true,action:row});
}
