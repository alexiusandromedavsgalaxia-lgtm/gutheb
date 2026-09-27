import React, { useEffect, useMemo, useState } from "react";

const seedRepos = [];

const seedIssues = [];

const seedPRs = [];

function App(){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem("gutheb-user")||"null"));
  const [page,setPage]=useState(()=>location.hash.replace("#/","")||"home");
  const [auth,setAuth]=useState("login");
  const [authForm,setAuthForm]=useState({name:"",email:"",password:""});
  const [notice,setNotice]=useState("");
  const [query,setQuery]=useState("");
  const [repos,setRepos]=useState(()=>JSON.parse(localStorage.getItem("gutheb-repos-v2")||"null")||seedRepos);
  const [selectedRepo,setSelectedRepo]=useState(null);
  const [repoTab,setRepoTab]=useState("code");
  const [tree,setTree]=useState([]);
  const [file,setFile]=useState(null);
  const [issues,setIssues]=useState(seedIssues);
  const [prs,setPRs]=useState(seedPRs);
  const [newRepo,setNewRepo]=useState({name:"",description:"",visibility:"Public"});
  const [issueTitle,setIssueTitle]=useState("");
  const [issueBody,setIssueBody]=useState("");
  const [profile,setProfile]=useState(()=>JSON.parse(localStorage.getItem("gutheb-profile")||"null")||{username:"",bio:"",location:"",website:"",avatar:""});
  const [settings,setSettings]=useState({theme:"dark",email:true,notifications:true});
  const [pinned,setPinned]=useState(()=>JSON.parse(localStorage.getItem("gutheb-pinned")||"[]"));
  const [aiOpen,setAiOpen]=useState(false); const [aiInput,setAiInput]=useState(""); const [aiMessages,setAiMessages]=useState([]);
  const [packages,setPackages]=useState(()=>JSON.parse(localStorage.getItem("gutheb-packages")||"[]"));
  const [newItem,setNewItem]=useState({type:"file",path:"",content:""});
  const [repoBranches,setRepoBranches]=useState(()=>JSON.parse(localStorage.getItem("gutheb-branches-v1")||"{}"));

  useEffect(()=>{
    const onHash=()=>setPage(location.hash.replace("#/","")||"home");
    addEventListener("hashchange",onHash); return()=>removeEventListener("hashchange",onHash);
  },[]);
  useEffect(()=>{
    fetch("/api/account",{credentials:"include"}).then(async r=>{if(!r.ok)throw new Error();const d=await r.json();setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));return fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"me"})})}).then(r=>r.ok?r.json():null).then(d=>{if(d?.repos){setRepos(d.repos);localStorage.setItem("gutheb-repos-v2",JSON.stringify(d.repos));}}).catch(()=>{});
  },[]);

  function go(p){ location.hash="/"+p; setPage(p); setNotice(""); }
  function flash(msg){setNotice(msg);setTimeout(()=>setNotice(""),2500);}
  useEffect(()=>localStorage.setItem("gutheb-repos-v2",JSON.stringify(repos)),[repos]);
  useEffect(()=>localStorage.setItem("gutheb-pinned",JSON.stringify(pinned)),[pinned]);
  useEffect(()=>localStorage.setItem("gutheb-packages",JSON.stringify(packages)),[packages]);
  useEffect(()=>localStorage.setItem("gutheb-branches-v1",JSON.stringify(repoBranches)),[repoBranches]);
  useEffect(()=>{
    const nf=e=>{if(!selectedRepo)return;const path=e.detail.trim();if(!path)return;const next={...selectedRepo,files:{...(selectedRepo.files||{})}};if(next.files[path]!==undefined)return flash("File already exists");next.files[path]="";saveLocalRepo(next);setFile({path,content:""});};
    const nd=e=>{if(!selectedRepo)return;const path=e.detail.trim();if(!path)return;const next={...selectedRepo,folders:[...(selectedRepo.folders||[])]};if(next.folders.includes(path))return flash("Folder already exists");next.folders.push(path);saveLocalRepo(next);};
    const sf=()=>{if(!selectedRepo||!file)return;const next={...selectedRepo,files:{...(selectedRepo.files||{}),[file.path]:file.content}};saveLocalRepo(next);flash("File saved");};
    addEventListener("gutheb:new-file",nf);addEventListener("gutheb:new-folder",nd);addEventListener("gutheb:save-file",sf);
    return()=>{removeEventListener("gutheb:new-file",nf);removeEventListener("gutheb:new-folder",nd);removeEventListener("gutheb:save-file",sf)}
  },[selectedRepo,file]);
  function togglePin(name){setPinned(x=>x.includes(name)?x.filter(v=>v!==name):[...x,name]);flash(pinned.includes(name)?"Repository unpinned":"Repository pinned");}
  async function askAI(e){e.preventDefault();const q=aiInput.trim();if(!q)return;setAiMessages(x=>[...x,{role:"user",text:q},{role:"ai",text:"Pensando…"}]);setAiInput("");try{const res=await fetch("/api/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:q,history:aiMessages.slice(-12)})});const data=await res.json();if(!res.ok)throw new Error(data.error||"AI request failed");setAiMessages(x=>{const copy=[...x];copy[copy.length-1]={role:"ai",text:data.output||"No response."};return copy});}catch(err){setAiMessages(x=>{const copy=[...x];copy[copy.length-1]={role:"ai",text:"No he podido conectar con el backend de GutHeb AI todavía. Configura POLLINATIONS_API_KEY en Cloudflare y vuelve a intentarlo."};return copy})}}
  function aiAnswer(q){const l=q.toLowerCase();if(l.includes("crear")&&l.includes("repo"))return "Puedo preparar un nuevo repositorio desde el panel de creación. Para seguridad, las escrituras reales necesitan un backend autenticado conectado a GutHeb.";if(l.includes("readme"))return "Puedo generar la estructura y el contenido de un README, además de sugerir licencia, topics y estructura de carpetas.";if(l.includes("licencia"))return "Puedo ayudarte a elegir y generar archivos de licencia conocidos, pero la aplicación debe guardar el archivo mediante su backend.";if(l.includes("paquete")||l.includes("package"))return "Puedo analizar package.json y mostrar dependencias y versiones cuando el repositorio las exponga.";return "Soy GutHeb AI. Puedo ayudarte a diseñar repositorios, README, issues, PRs, estructura de proyectos, código y automatizaciones. Para acciones reales sobre Git, necesito una API/backend con autenticación segura.";}
  async function login(e){
    e.preventDefault();
    try{const res=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",email:authForm.email,password:authForm.password})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Sign in failed");setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));const me=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"me"})});if(me.ok){const m=await me.json();setRepos(m.repos||[]);localStorage.setItem("gutheb-repos-v2",JSON.stringify(m.repos||[]));}go("home");}catch(err){flash(err.message);}
  }
  async function logout(){try{await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})});}catch{}setUser(null);localStorage.removeItem("gutheb-user");localStorage.removeItem("gutheb-profile");setRepos([]);go("home");}
  async function register(e){e.preventDefault();try{const res=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",username:authForm.name,email:authForm.email,password:authForm.password})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Registration failed");setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));setRepos(d.repos||[]);go("home");}catch(err){flash(err.message);}}
  async function createRepo(e){
    e.preventDefault();
    if(!newRepo.name.trim()) return flash("Repository name is required");
    const r={owner:user.name,name:newRepo.name.trim(),visibility:newRepo.visibility,language:"",stars:0,forks:0,updated:"just now",description:newRepo.description,license:"MIT",files:{
      "README.md":"# "+newRepo.name.trim()+"\n\n"+(newRepo.description||"")+"\n",
      "LICENSE":"MIT License\n\nCopyright (c) "+new Date().getFullYear()+" "+user.name+"\n"
    },folders:[]};
    try{const res=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"repo",repo:r})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Repository creation failed");const saved={...r,id:d.id};setRepos(x=>[saved,...x]);setSelectedRepo(saved);setNewRepo({name:"",description:"",visibility:"Public"});flash("Repository created");go("repos");}catch(err){flash(err.message);}
  }
  function openRepo(r){
    const key=(r.owner||user.name)+"/"+r.name;
    const branches=repoBranches[key]||["main"];
    if(!repoBranches[key]) setRepoBranches(x=>({...x,[key]:branches}));
    setSelectedRepo({...r,currentBranch:r.currentBranch||branches[0]}); setRepoTab("code"); setFile(null); setTree(Object.keys(r.files||{}).map(path=>({path,type:"blob"})));
    go("repo/"+r.name);
  }
  function openFile(path){
    if(!selectedRepo)return;
    const content=(selectedRepo.files||{})[path];
    if(content===undefined)return flash("File not found");
    setFile({path,content});
  }
  function downloadRepoZip(repo){
    const files=Object.entries(repo.files||{});
    const crc32=(data)=>{let c=0xffffffff;for(let i=0;i<data.length;i++){c^=data[i];for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
    const enc=new TextEncoder(), chunks=[], central=[]; let offset=0;
    const u16=n=>new Uint8Array([n&255,(n>>>8)&255]),u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
    const join=a=>{const out=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let p=0;for(const x of a){out.set(x,p);p+=x.length}return out};
    for(const [path,text] of files){const name=enc.encode(path),data=enc.encode(String(text??"")),crc=crc32(data);const local=join([new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);chunks.push(local);central.push(join([new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length}
    const cd=join(central),body=join(chunks),end=join([new Uint8Array([80,75,5,6,0,0,0,0]),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);const blob=new Blob([body,cd,end],{type:"application/zip"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=repo.name+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);flash("ZIP downloaded");
  }
  function openInWorkers(repo){localStorage.setItem("gutheb-workers-open",JSON.stringify({repo:repo.owner+"/"+repo.name,files:repo.files||{},folders:repo.folders||[]}));window.location.href="/workers/#/workspace/"+encodeURIComponent(repo.name); }
  function createBranch(){
    if(!selectedRepo)return;
    if(selectedRepo.owner!==user.name)return flash("Only the repository owner can create branches");
    const name=prompt("New branch name","feature/new");if(!name?.trim())return;
    const key=(selectedRepo.owner||user.name)+"/"+selectedRepo.name;const clean=name.trim();
    setRepoBranches(x=>({...x,[key]:[...(x[key]||["main"]),clean]}));flash("Branch created");
  }
  function selectBranch(name){
    if(!selectedRepo)return;
    setSelectedRepo(x=>({...x,currentBranch:name}));setFile(null);
  }
  function saveLocalRepo(next){
    setRepos(xs=>xs.map(r=>r.owner===selectedRepo.owner&&r.name===selectedRepo.name?next:r));
    setSelectedRepo(next);
    setTree(Object.keys(next.files||{}).map(path=>({path,type:"blob"})));
    fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"repo",repo:next})}).then(async r=>{if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Repository sync failed")}}).catch(err=>flash("Guardado local, pero no se pudo sincronizar: "+err.message));
  }
  function repoOwnerCanEdit(repo){return !!repo && repo.owner===user.name}
  function createRepoItem(type){
    const path=newItem.path.trim().replace(/^\/+|\/+$/g,"");
    if(!path)return flash(type==="file"?"Enter a file path":"Enter a folder path");
    const next={...selectedRepo,files:{...(selectedRepo.files||{})},folders:[...(selectedRepo.folders||[])]};
    if(type==="file"){
      if(next.files[path]!==undefined)return flash("File already exists");
      next.files[path]=newItem.content;
      const parts=path.split("/"); if(parts.length>1) parts.slice(0,-1).reduce((acc,p,i,a)=>{const f=a.slice(0,i+1).join("/");if(!next.folders.includes(f))next.folders.push(f);return acc},[]);
      flash("File created");
    }else{
      if(next.folders.includes(path))return flash("Folder already exists");
      next.folders.push(path); flash("Folder created");
    }
    saveLocalRepo(next); setNewItem({type:"file",path:"",content:""}); setFile(type==="file"?{path,content:next.files[path]}:null);
  }
  function saveFileEdit(){
    if(!selectedRepo||!file)return;
    if(!repoOwnerCanEdit(selectedRepo)) return flash("Only the repository owner can edit this repository");
    const next={...selectedRepo,files:{...(selectedRepo.files||{}),[file.path]:file.content}};
    saveLocalRepo(next); flash("File saved");
  }
  function createIssue(e){
    e.preventDefault();
    if(!issueTitle.trim())return;
    setIssues(x=>[{id:Date.now(),title:issueTitle,state:"open",labels:["created"],author:user?.name||"you"},...x]);
    setIssueTitle("");setIssueBody("");flash("Issue created");
  }
  async function saveProfile(e){
    e.preventDefault();
    const nextName=(profile.username||user.name).trim();
    if(!nextName)return flash("Username is required");
    const nextProfile={...profile,username:nextName,avatar:profile.avatar||""};
    try{const res=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"profile",profile:nextProfile})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Profile save failed");const nextUser={...user,name:nextName};setUser(nextUser);setProfile(nextProfile);localStorage.setItem("gutheb-user",JSON.stringify(nextUser));localStorage.setItem("gutheb-profile",JSON.stringify(nextProfile));flash("Profile saved and synchronized");}catch(err){flash(err.message);}
  }
  const filteredRepos=useMemo(()=>repos.filter(r=>(r.name+" "+r.description).toLowerCase().includes(query.toLowerCase())),[repos,query]);

  if(!user) return <Auth auth={auth} setAuth={setAuth} form={authForm} setForm={setAuthForm} onLogin={login} onRegister={register}/>;

  const routeRepo=page.startsWith("repo/")?page.slice(5):null;
  if(routeRepo && !selectedRepo){const r=repos.find(x=>x.name===routeRepo);if(r){setTimeout(()=>openRepo(r),0);}}

  return <div className="gh">
    <header className="top">
      <button className="logo" onClick={()=>go("home")} aria-label="GutHeb home"><img src="/gutheb-logo.svg?v=20260927" alt="" /></button>
      <div className="wordmark" onClick={()=>go("home")}>GutHeb</div>
      <div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search or jump to..." /><kbd>/</kbd></div>
      <nav className="topnav">
        <button onClick={()=>go("issues")}>Issues</button><button onClick={()=>go("pulls")}>Pull requests</button><button onClick={()=>go("marketplace")}>Marketplace</button><button onClick={()=>go("explore")}>Explore</button>
      </nav>
      <div className="topuser"><button onClick={()=>go("notifications")}>♡</button><button onClick={()=>go("profile")}>{user.name}⌄</button></div>
    </header>

    <div className={"appbody "+(routeRepo?"repoAppbody":"")}>
      <aside className="leftnav">
        <button className="newrepo" onClick={()=>go("new")}>＋ New</button>
        <Nav icon="/gutheb-icons/home.svg" text="Home" page="home" go={go}/>
        <Nav icon="/gutheb-icons/issues.svg" text="Issues" page="issues" go={go}/>
        <Nav icon="/gutheb-icons/pulls.svg" text="Pull requests" page="pulls" go={go}/>
        <Nav icon="/gutheb-icons/actions.svg" text="Actions" page="actions" go={go}/>
        <Nav icon="/gutheb-icons/projects.svg" text="Projects" page="projects" go={go}/>
        <Nav icon="/gutheb-icons/discussions.svg" text="Discussions" page="discussions" go={go}/>
        <Nav icon="/gutheb-icons/codespaces.svg" text="Codespaces" page="codespaces" go={go}/>
        <Nav icon="/gutheb-icons/marketplace.svg" text="Marketplace" page="marketplace" go={go}/><button className="navitem aiNav" onClick={()=>setAiOpen(true)}><span className="navicon"><img src="/gutheb-icons/ai.svg" alt="" /></span> GutHeb AI</button>
        <div className="navsep"/>
        <small>Repositories</small>
        {repos.filter(r=>!r.owner||r.owner===user.name).slice(0,8).map(r=><button className="repo-nav" key={(r.owner||user.name)+"/"+r.name} onClick={()=>openRepo(r)}><span className="dot"/> {r.name}</button>)}
        <button className="repo-nav" onClick={()=>go("repos")}>View all repositories →</button>
        <div className="navbottom">
          <Nav icon="⚙" text="Settings" page="settings" go={go}/>
          <button className="repo-nav" onClick={logout}>↪ Sign out</button>
        </div>
      </aside>

      <main className="main">
        {notice&&<div className="notice">{notice}</div>}
        {page==="home"&&<Home user={user} repos={filteredRepos.filter(r=>!r.owner||r.owner===user.name)} openRepo={openRepo} go={go} pinned={pinned} togglePin={togglePin}/>}
        {page==="repos"&&<Repos repos={filteredRepos.filter(r=>!r.owner||r.owner===user.name)} openRepo={openRepo} go={go} pinned={pinned} togglePin={togglePin}/>}
        {page==="new"&&<NewRepo form={newRepo} setForm={setNewRepo} onSubmit={createRepo}/>}
        {page==="issues"&&<Issues issues={issues} user={user} title={issueTitle} setTitle={setIssueTitle} body={issueBody} setBody={setIssueBody} onSubmit={createIssue}/>}
        {page==="pulls"&&<Pulls prs={prs} setPRs={setPRs} user={user}/>}
        {page==="actions"&&<Actions/>}
        {page==="projects"&&<Projects/>}
        {page==="discussions"&&<Discussions/>}
        {page==="codespaces"&&<Codespaces/>}
        {page==="marketplace"&&<Marketplace/>}
        {page==="explore"&&<Explore/>}
        {page==="notifications"&&<Notifications/>}
        {page==="profile"&&<Profile user={user} profile={profile} setProfile={setProfile} save={saveProfile} repos={repos.filter(r=>!r.owner||r.owner===user.name)} pinned={pinned} togglePin={togglePin}/>}
        {page==="settings"&&<Settings settings={settings} setSettings={setSettings} user={user}/>}
        {routeRepo&&selectedRepo&&<Repo repo={selectedRepo} tab={repoTab} setTab={setRepoTab} tree={tree} file={file} openFile={openFile} go={go} packages={packages} user={user} repoBranches={repoBranches} createBranch={createBranch} selectBranch={selectBranch} downloadRepoZip={downloadRepoZip} openInWorkers={openInWorkers} flash={flash}/>}
      </main>
      {aiOpen&&<AIChat messages={aiMessages} input={aiInput} setInput={setAiInput} onSubmit={askAI} close={()=>setAiOpen(false)}/>} 
    </div>
  </div>
}

function Nav({icon,text,page,go}){return <button className="navitem" onClick={()=>go(page)}><span className="navicon"><img src={icon} alt="" /></span>{text}</button>}

function Auth({auth,setAuth,form,setForm,onLogin,onRegister}){
  const register=auth==="register";
  return <div className="auth">
    <div className="auth-logo"><img src="/gutheb-logo.svg" alt="GutHeb" /></div><h1>GutHeb</h1><p>The open developer platform.</p>
    <form onSubmit={register?onRegister:onLogin} className="authcard">
      <div className="authswitch"><button type="button" className={!register?"sel":""} onClick={()=>setAuth("login")}>Sign in</button><button type="button" className={register?"sel":""} onClick={()=>setAuth("register")}>Create account</button></div>
      {register&&<label>Username<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>}
      <label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Password<input required type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
      <button className="primary" type="submit">{register?"Create account":"Sign in"}</button>
      <div className="divider">or</div>
      <button type="button" onClick={()=>setForm({...form,email:"demo@gutheb.local",password:"demo"})}>Use demo account</button>
    </form>
    <small>By continuing, you agree to the GutHeb Terms and Privacy Policy.</small>
  </div>
}

function Home({user,repos,openRepo,go,pinned,togglePin}){return <Page title={"Good to see you, "+user.name+" 👋"} subtitle="Your developer activity, repositories, and work in one place.">
  <div className="grid2"><Panel title="Your repositories" action={<button onClick={()=>go("new")}>New</button>}>{repos.slice(0,6).map(r=><RepoMini key={r.name} r={r} open={openRepo} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</Panel><Panel title="Latest activity"><Activity text="You signed in to GutHeb"/><Activity text="Repository activity will appear here"/><Activity text="Pull request events will appear here"/></Panel></div>
  <Panel title="Quick start"><div className="quick"><button onClick={()=>go("new")}>Create a repository</button><button onClick={()=>go("issues")}>Create an issue</button><button onClick={()=>go("profile")}>Edit your profile</button><button onClick={()=>go("settings")}>Account settings</button></div></Panel>
</Page>}

function Repos({repos,openRepo,go,pinned,togglePin}){return <Page title="Repositories" subtitle="Create, manage, and explore your repositories." action={<button className="primary" onClick={()=>go("new")}>New</button>}><div className="repo-list">{repos.map(r=><RepoCard key={r.name} r={r} open={openRepo} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</div></Page>}

function NewRepo({form,setForm,onSubmit}){const user=JSON.parse(localStorage.getItem("gutheb-user")||"{}");return <Page title="Create a new repository" subtitle="A repository contains all of your project's files, history, and collaboration tools."><form className="panel form" onSubmit={onSubmit}><label>Owner<input value={user.name||"user"} disabled/></label><label>Repository name<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="my-project"/></label><label>Description <span className="muted">(optional)</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Visibility<select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value})}><option>Public</option><option>Private</option></select></label><button className="primary" type="submit">Create repository</button></form></Page>}

function Issues({issues,title,setTitle,body,setBody,onSubmit}){return <Page title="Issues" subtitle="Plan, discuss, and track work."><form className="panel issueform" onSubmit={onSubmit}><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Issue title"/><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Leave a description..."/><button className="primary">New issue</button></form><Panel title={issues.length+" issues"}>{issues.map(i=><div className="issue" key={i.id}><span className="open">●</span><div><strong>{i.title}</strong><small>#{i.id} opened by {i.author}</small><div>{i.labels.map(l=><span className="label" key={l}>{l}</span>)}</div></div></div>)}</Panel></Page>}

function Pulls({prs,setPRs,user}){return <Page title="Pull requests" subtitle="Review code changes before they land."><Panel title={prs.length+" open pull requests"} action={<button onClick={()=>setPRs(x=>[{id:Date.now(),title:"New pull request",state:"open",author:user.name,branch:"feature/new"},...x])}>New pull request</button>}>{prs.map(p=><div className="issue" key={p.id}><span className="open">↗</span><div><strong>{p.title}</strong><small>#{p.id} · {p.branch} · opened by {p.author}</small></div></div>)}</Panel></Page>}

function Actions(){return <Page title="Actions" subtitle="Automate your builds, tests, and deployments."><div className="grid2"><Panel title="Workflows"><div className="workflow"><b>Build</b><span className="green">✓</span><small>Ready to run</small></div><div className="workflow"><b>Test</b><span className="gray">○</span><small>Waiting for workflow file</small></div></Panel><Panel title="Workflow runs"><Activity text="No workflow runs yet"/><button className="primary">New workflow</button></Panel></div></Page>}

function Projects(){return <Page title="Projects" subtitle="Track work with tables, boards, and roadmaps."><div className="board"><div>Todo</div><div>In progress</div><div>Done</div><article>Plan next release</article><article>Build issue workflow</article><article>Ship first version</article></div></Page>}
function Discussions(){return <Page title="Discussions" subtitle="Community conversations and long-form collaboration."><Panel title="Recent discussions"><Activity text="Welcome to the community"/><Activity text="Share what you are building"/><Activity text="Feature ideas"/></Panel></Page>}
function Codespaces(){return <Page title="Codespaces" subtitle="Cloud development environments for your repositories."><Panel title="Your codespaces"><div className="empty">No codespaces yet.<br/><button className="primary">Create a codespace</button></div></Panel></Page>}
function Marketplace(){return <Page title="Marketplace" subtitle="Apps, actions, and developer tools."><div className="marketgrid">{["CI/CD","Code quality","Project management","Security","Deployment","AI tools"].map(x=><div className="market" key={x}><b>{x}</b><p>Explore integrations for {x.toLowerCase()}.</p><button>Explore</button></div>)}</div></Page>}
function Explore(){return <Page title="Explore" subtitle="Discover projects, topics, and developers."><div className="grid2"><Panel title="Trending"><RepoMini r={{name:"awesome-project",description:"A trending open-source project",language:"JavaScript"}}/></Panel><Panel title="Topics"><div className="topics">{["javascript","react","cloud","ai","games","web"].map(x=><span key={x}>#{x}</span>)}</div></Panel></div></Page>}
function Notifications(){return <Page title="Notifications"><Panel title="Inbox"><div className="empty">You're all caught up. 🎉</div></Panel></Page>}
function Profile({user,profile,setProfile,save,repos,pinned,togglePin}){const avatarFile=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>4*1024*1024)return;const reader=new FileReader();reader.onload=()=>setProfile(p=>({...p,avatar:String(reader.result||"")}));reader.readAsDataURL(f)};return <Page title={user.name} subtitle={user.email}><div className="profileHero"><div className="avatar">{profile.avatar?<img src={profile.avatar} alt="Profile"/>:<span>{user.name.slice(0,1).toUpperCase()}</span>}</div><div><h2>{user.name}</h2><p>{profile.bio||"Add a short bio to your profile."}</p></div></div><form className="panel form" onSubmit={save}><label>Username<input required value={profile.username??user.name} onChange={e=>setProfile({...profile,username:e.target.value})}/></label><label>Profile photo<input type="file" accept="image/*" onChange={avatarFile}/></label><label>Bio<textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label><label>Location<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})}/></label><label>Website<input value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})}/></label><button className="primary">Save profile</button></form><Panel title="Repositories">{repos.map(r=><RepoMini r={r} key={r.name} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</Panel></Page>}
function Settings({settings,setSettings,user}){return <Page title="Settings" subtitle="Manage your GutHeb account and preferences."><Panel title="Account"><div className="setting"><span><b>Username</b><small>{user.name}</small></span><button>Change</button></div><div className="setting"><span><b>Email</b><small>{user.email}</small></span><button>Manage</button></div></Panel><Panel title="Preferences"><div className="setting"><span><b>Theme</b><small>Dark developer theme</small></span><select value={settings.theme} onChange={e=>setSettings({...settings,theme:e.target.value})}><option>dark</option><option>light</option></select></div><div className="setting"><span><b>Email notifications</b><small>Receive product updates</small></span><input type="checkbox" checked={settings.email} onChange={e=>setSettings({...settings,email:e.target.checked})}/></div></Panel><Panel title="Danger zone"><button className="danger">Delete account</button></Panel></Page>}

function Repo({repo,tab,setTab,tree,file,openFile,go,packages,user,repoBranches,createBranch,selectBranch,downloadRepoZip,openInWorkers}){
  const [draft,setDraft]=useState(file?.content||"");
  useEffect(()=>setDraft(file?.content||""),[file?.path]);
  const folders=repo.folders||[], files=tree||[];
  const key=(repo.owner||user.name)+"/"+repo.name, branches=repoBranches[key]||["main"];
  const owner=repo.owner===user.name;
  const visibility=(repo.visibility||"Public").toLowerCase();
  return <section className="repoPage">
    <div className="repoTop">
      <div className="repoIdentity">
        <div className="repoCrumb"><button onClick={()=>go("profile")}>{repo.owner||"user"}</button><span>/</span><strong>{repo.name}</strong><span className={"visibility "+visibility}>{visibility}</span></div>
        <p>{repo.description||"No description provided yet."}</p>
      </div>
      <div className="repoActions"><button>☆ <span>Star</span></button><button>⑂ <span>Fork</span></button><button onClick={()=>downloadRepoZip(repo)}>⇩ <span>Download ZIP</span></button><button onClick={()=>openInWorkers(repo)}>◈ <span>Open in Workers</span></button></div>
    </div>
    <div className="repoShell">
      <main className="repoMain">
        <nav className="repoTabs">{["code","issues","pulls","actions","projects","security","packages","insights"].map(x=><button className={tab===x?"sel":""} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</nav>
        {tab==="code"&&<div className="repoWorkspace">
          <div className="repoToolbar">
            <div className="branchSelect">⑂ <select value={repo.currentBranch||"main"} onChange={e=>selectBranch(e.target.value)}>{branches.map(b=><option key={b}>{b}</option>)}</select></div>
            <button className="branchButton" onClick={createBranch}>＋ Branch</button><div className="repoToolbarSpacer"/>
            <button onClick={()=>{const p=prompt("File path","src/index.js");if(p&&owner)window.dispatchEvent(new CustomEvent("gutheb:new-file",{detail:p}));else if(p)flash("Only the repository owner can edit this repository")}}>＋ New file</button>
            <button onClick={()=>{const p=prompt("Folder path","src");if(p&&owner)window.dispatchEvent(new CustomEvent("gutheb:new-folder",{detail:p}));else if(p)flash("Only the repository owner can edit this repository")}}>＋ Folder</button>
            {file&&owner&&<button className="primary" onClick={()=>window.dispatchEvent(new CustomEvent("gutheb:save-file"))}>Save changes</button>}
          </div>
          <div className="repoLayout">
            <aside className="repoTree">
              <div className="treeHead"><b>Files</b><span>{files.length}</span></div>
              {folders.map(x=><div className="treeFolder" key={"f"+x}>⌄ <span>▱</span>{x}</div>)}
              {files.map(x=><button className={"treeFile "+(file?.path===x.path?"active":"")} key={x.path} onClick={()=>openFile(x.path)}><span>◇</span>{x.path}</button>)}
              {!files.length&&!folders.length&&<div className="treeEmpty">No files yet.</div>}
            </aside>
            <section className="repoContent">
              {file?<div className="editorCard"><div className="editorHead"><span>◇ {file.path}</span><span className="muted">{owner?"Editable by owner":"Read only"}</span></div><textarea readOnly={!owner} className="fileeditor" value={draft} onChange={e=>{setDraft(e.target.value);file.content=e.target.value}} spellCheck={false}/></div>:
                <div className="repoOverview"><div className="readmeCard"><div className="readmeHead"><span>README.md</span><span className="muted">{repo.currentBranch||"main"}</span></div><div className="readmeBody"><h2>{repo.name}</h2><p>{repo.description||"This repository is ready for your first commit."}</p><div className="readmeStats"><span>☆ {repo.stars||0} stars</span><span>⑂ {repo.forks||0} forks</span><span>● {repo.language||"Code"}</span></div></div></div><div className="commitStrip"><span>Latest commit</span><b>Initial GutHeb repository</b><span className="muted">just now</span></div></div>}
            </section>
          </div>
        </div>}
        {tab==="packages"&&<Panel title="Packages"><div className="empty">{packages.length?packages.join(", "):"No packages published yet."}</div></Panel>}
        {tab!=="code"&&tab!=="packages"&&<Panel title={tab==="issues"?"Issues":tab==="pulls"?"Pull requests":tab}><div className="empty">This {tab} workspace is ready for repository-specific data.</div></Panel>}
      </main>
      <aside className="repoAside">
        <section><h3>About</h3><p>{repo.description||"No description."}</p>{repo.website&&<a href={repo.website} target="_blank" rel="noreferrer">↗ Website</a>}</section>
        <section><h3>Repository</h3><a>♡ {repo.stars||0} stars</a><a>⑂ {repo.forks||0} forks</a><a>◉ {files.length} files</a><a>⚖ {repo.license||"MIT License"}</a></section>
        <section><h3>Contributors</h3><div className="contributor"><span className="miniAvatar">{(repo.owner||"U")[0].toUpperCase()}</span><b>{repo.owner||"user"}</b><small>Owner</small></div></section>
        <section><h3>Packages</h3>{packages.length?packages.map(p=><a key={p}>▣ {p}</a>):<span className="muted">No packages</span>}</section>
        <section><h3>Languages</h3><div className="languageRows"><span><i/> {repo.language||"Code"} <small>100%</small></span></div></section>
        <section><h3>Local permissions</h3><span className="muted">{owner?"You are the owner and can edit." : "Read-only. Only the creator can edit."}</span></section>
      </aside>
    </div>
  </section>
}
function Page({title,subtitle,action,children}){return <section className="page"><div className="pagehead"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>}
function Panel({title,action,children}){return <section className="panel"><div className="panelhead"><h2>{title}</h2>{action}</div>{children}</section>}
function RepoMini({r,open,pinned,pin}){return <div className="repomini"><button className="repoOpen" onClick={()=>open&&open(r)}><span className="repo-name">◉ {r.name}</span><span className="muted">{r.description||"No description"}</span><span className="muted">{r.language||"Code"} · ☆ {r.stars||0}</span></button><button onClick={pin}>{pinned?"★":"☆"}</button></div>}
function RepoCard({r,open,pinned,pin}){return <div className="repocard"><div className="repoCardTop"><button onClick={()=>open(r)}><h3>{(r.owner||"user")+"/"+r.name}</h3></button><button onClick={pin}>{pinned?"★ Pinned":"☆ Pin"}</button></div><p>{r.description||"No description provided."}</p><span className="muted">{r.visibility} · {r.language||"Code"} · ☆ {r.stars||0} · Forks {r.forks||0}</span><div className="repoMeta"><span>📄 README</span><span>⚖ {r.license||"No license"}</span><span>▣ Packages</span></div></div>}
function Activity({text}){return <div className="activity"><span>●</span><span>{text}</span></div>}

export default App;

function RepoMeta({repo,tree}){const counts={};(tree||[]).forEach(x=>{const ext=x.path.split(".").pop().toLowerCase();const map={js:"JavaScript",jsx:"JavaScript",ts:"TypeScript",tsx:"TypeScript",html:"HTML",css:"CSS",rsx:"Xreoct",rs:"Xreoct",py:"Python",java:"Java",json:"JSON",md:"Markdown"};const n=map[ext]||"Other";counts[n]=(counts[n]||0)+1});const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;return <div className="repoMetaPanel"><b>Repository overview</b><div className="langbar">{Object.entries(counts).map(([k,v])=><span key={k} style={{width:(v/total*100)+"%"}} title={k+" "+v}/>)}</div><div className="langlist">{Object.entries(counts).map(([k,v])=><span key={k}>● {k} {Math.round(v/total*100)}%</span>)}</div><div className="repoFiles"><span>📄 README.md</span><span>⚖ LICENSE</span><span>▣ Packages</span><span>⑂ Branches</span></div></div>}
function AIChat({messages,input,setInput,onSubmit,close}){return <div className="aiOverlay"><section className="aiChat"><header><div><b>✦ GutHeb AI</b><small>Free workspace assistant</small></div><button onClick={close}>×</button></header><div className="aiMessages">{!messages.length&&<div className="aiWelcome"><strong>What are you building?</strong><p>Ask for repository structure, README drafts, issues, PR ideas, code help, licenses, packages, or project plans.</p></div>}{messages.map((m,i)=><div className={m.role==="user"?"aiUser":"aiBot"} key={i}>{m.text}</div>)}</div><form onSubmit={onSubmit}><input autoFocus value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask GutHeb AI…"/><button className="primary">Send</button></form></section></div>}
