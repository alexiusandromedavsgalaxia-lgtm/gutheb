const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Content-Type":"application/json","Cache-Control":"no-store"}});
const safePath=p=>{
  const parts=String(p||"").trim().replaceAll("\\\\","/").split("/").filter(Boolean);
  const clean=[];
  for(const part of parts){if(part==="."||part==="")continue;if(part===".."||part.includes("\\0"))return "";clean.push(part)}
  return clean.join("/");
};
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
async function currentUser(request,env){
  const users=env.USERS_DB;
  if(!users)return null;
  const sessionToken=sessionTokenFrom(request);
  if(!sessionToken)return null;
  const tokenHash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(sessionToken)))].map(x=>x.toString(16).padStart(2,"0")).join("");
  return users.prepare("SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,new Date().toISOString()).first();
}

function parseModel(raw){
  const text=String(raw||"").trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"");
  try{return JSON.parse(text)}catch{
    const a=text.indexOf("{"),b=text.lastIndexOf("}");
    if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1))}catch{}}
  }
  return {message:text,operations:[]};
}
export async function onRequestPost({request,env}){
  try{
    const user=await currentUser(request,env);
    if(!user)return json({error:"Not authenticated."},401);
    const body=await request.json();
    const message=typeof body?.message==="string"?body.message.trim():"";
    if(!message)return json({error:"Message is required."},400);
    if(!env.POLLINATIONS_API_KEY)return json({error:"POLLINATIONS_API_KEY is not configured.",provider:"pollinations"},503);
    const repo=body?.repo&&typeof body.repo==="object"?body.repo:null;
    const files=repo?.files&&typeof repo.files==="object"?repo.files:{};
    const selectedFile=repo?.selectedFile&&typeof repo.selectedFile==="object"?repo.selectedFile:null;
    const safeFiles=Object.fromEntries(Object.entries(files).slice(0,120).map(([p,c])=>[String(p),String(c??"").slice(0,12000)]));
    const context=repo?JSON.stringify({owner:repo.owner,name:repo.name,description:repo.description,visibility:repo.visibility,language:repo.language,files:safeFiles,folders:Array.isArray(repo.folders)?repo.folders.slice(0,120):[],selectedFile:selectedFile?{path:String(selectedFile.path||""),content:String(selectedFile.content||"").slice(0,20000)}:null}).slice(0,40000):"No repository is currently selected.";
    const system=`You are GutHeb AI, an autonomous developer assistant inside GutHeb.
You can propose REAL repository changes. When a repository is selected, convert the user's request into concrete operations whenever possible.
Never claim an operation happened. Return JSON only with this exact shape:
{"message":"short user-facing summary","operations":[{"type":"write_file","path":"README.md","content":"..."},{"type":"delete_file","path":"old.txt"},{"type":"create_folder","path":"src"}],"tests":[]}
Allowed operation types: write_file, delete_file, create_folder.
Paths must be relative and must not contain .. .
If the user asks to create or edit code, actually provide the complete file content in write_file.
If the user asks to create a folder, use create_folder.
If the request is informational only, operations can be empty.
Do not output markdown fences around the JSON.
Selected repository context:
${context}`;
    const history=Array.isArray(body?.history)?body.history.slice(-10):[];
    const messages=[{role:"system",content:system},...history.map(x=>({role:x.role==="user"?"user":"assistant",content:String(x.text||"")})),{role:"user",content:message}];
    const upstream=await fetch("https://gen.pollinations.ai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+env.POLLINATIONS_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.POLLINATIONS_MODEL||"openai/gpt-5.4-nano",messages,temperature:0.1})});
    if(!upstream.ok)return json({error:"Pollinations provider error.",detail:(await upstream.text()).slice(0,500)},502);
    const data=await upstream.json();
    const raw=data?.choices?.[0]?.message?.content||"";
    const out=parseModel(raw);
    out.operations=Array.isArray(out.operations)?out.operations.slice(0,20).map(op=>{const x={...op};if(x.path)x.path=safePath(x.path);return x}).filter(op=>["write_file","delete_file","create_folder"].includes(op.type)&&op.path&&!op.path.includes("..")):[];
    out.tests=Array.isArray(out.tests)?out.tests.slice(0,10):[];
    out.message=String(out.message||"Listo.").slice(0,2000);
    return json({...out,provider:"pollinations"});
  }catch(e){return json({error:e?.message||"Invalid AI request."},400)}
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"}})}
