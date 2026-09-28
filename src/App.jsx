import React, { useEffect, useMemo, useState } from "react";

const seedRepos = [];

const seedIssues = [];

const seedPRs = [];

function App(){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem("gutheb-user")||"null"));
  const [page,setPage]=useState(()=>{const p=location.hash.replace("#/","");if(p)return p;const cs=location.pathname.match(/^\/codespace\/([^/]+)\/session\/([^/]+)\/?$/);if(cs)return "codespace/"+decodeURIComponent(cs[1])+"/session/"+decodeURIComponent(cs[2]);const m=location.pathname.match(/^\/([^/]+)\/([^/]+)\.gut\/?$/);return m?"repo/"+encodeURIComponent(m[2]):"home";});
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
  const [importOpen,setImportOpen]=useState(false);
  const [importing,setImporting]=useState(false);
  const [importForm,setImportForm]=useState({url:"",branch:"",name:""});
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
    const onRoute=()=>{const p=location.hash.replace("#/","");if(p){setPage(p);return;}const cs=location.pathname.match(/^\/codespace\/([^/]+)\/session\/([^/]+)\/?$/);setPage(cs?"codespace/"+decodeURIComponent(cs[1])+"/session/"+decodeURIComponent(cs[2]):"home")};
    addEventListener("hashchange",onRoute); addEventListener("popstate",onRoute); return()=>{removeEventListener("hashchange",onRoute);removeEventListener("popstate",onRoute)};
  },[]);
  useEffect(()=>{
    fetch("/api/account",{credentials:"include"}).then(async r=>{if(!r.ok)throw new Error();const d=await r.json();setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));return fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"me"})})}).then(r=>r.ok?r.json():null).then(d=>{if(d?.repos){setRepos(d.repos);localStorage.setItem("gutheb-repos-v2",JSON.stringify(d.repos));const m=location.pathname.match(/^\/([^/]+)\/([^/]+)\.gut\/?$/);if(m){const r=d.repos.find(x=>x.name===decodeURIComponent(m[2])&&(x.owner||d.user?.name)===decodeURIComponent(m[1]));if(r){setSelectedRepo({...r,currentBranch:r.currentBranch||"main"});setRepoTab("code");setTree(Object.keys(r.files||{}).map(path=>({path,type:"blob"})));}}}}).catch(()=>{});
  },[]);

  function go(p){ if(String(p).startsWith("codespace/")){history.pushState({}, "", "/"+p);setPage(p);setNotice("");return;} location.hash="/"+p; setPage(p); setNotice(""); }
  function flash(msg){setNotice(msg);setTimeout(()=>setNotice(""),2500);}
  useEffect(()=>localStorage.setItem("gutheb-repos-v2",JSON.stringify(repos)),[repos]);
  useEffect(()=>localStorage.setItem("gutheb-pinned",JSON.stringify(pinned)),[pinned]);
  useEffect(()=>localStorage.setItem("gutheb-packages",JSON.stringify(packages)),[packages]);
  useEffect(()=>localStorage.setItem("gutheb-branches-v1",JSON.stringify(repoBranches)),[repoBranches]);
  useEffect(()=>{
    const nf=e=>{if(!selectedRepo)return;const path=e.detail.trim();if(!path)return;const next={...selectedRepo,files:{...(selectedRepo.files||{})}};if(next.files[path]!==undefined)return flash("File already exists");next.files[path]="";saveLocalRepo(next);setFile({path,content:""});};
    const nd=e=>{if(!selectedRepo)return;const path=e.detail.trim();if(!path)return;const next={...selectedRepo,folders:[...(selectedRepo.folders||[])]};if(next.folders.includes(path))return flash("Folder already exists");next.folders.push(path);saveLocalRepo(next);};
    const sf=()=>{if(!selectedRepo||!file)return;const next={...selectedRepo,files:{...(selectedRepo.files||{}),[file.path]:file.content}};saveLocalRepo(next);flash("File saved");};
    const sfc=e=>{const d=e.detail||{};if(!selectedRepo||!d.path)return;const next={...selectedRepo,files:{...(selectedRepo.files||{}),[d.path]:String(d.content||"")}};saveLocalRepo(next);};
    const del=e=>{const d=e.detail||{};if(!selectedRepo||!d.path)return;const path=String(d.path);const files={...(selectedRepo.files||{})};let removed=0;if(d.directory){for(const k of Object.keys(files)){if(k===path||k.startsWith(path+"/")){delete files[k];removed++;}}}else if(Object.prototype.hasOwnProperty.call(files,path)){delete files[path];removed=1;}if(!removed)return flash("Nothing to delete");const next={...selectedRepo,files};saveLocalRepo(next);if(file?.path===path||d.directory&&file?.path?.startsWith(path+"/"))setFile(null);flash(d.directory?"Directory deleted":"File deleted");};
    addEventListener("gutheb:new-file",nf);addEventListener("gutheb:new-folder",nd);addEventListener("gutheb:save-file",sf);addEventListener("gutheb:set-file-content",sfc);addEventListener("gutheb:delete",del);
    return()=>{removeEventListener("gutheb:new-file",nf);removeEventListener("gutheb:new-folder",nd);removeEventListener("gutheb:save-file",sf);removeEventListener("gutheb:set-file-content",sfc);removeEventListener("gutheb:delete",del)}
  },[selectedRepo,file]);
  function togglePin(name){setPinned(x=>x.includes(name)?x.filter(v=>v!==name):[...x,name]);flash(pinned.includes(name)?"Repository unpinned":"Repository pinned");}
  async function askAI(e){e.preventDefault();const q=aiInput.trim();if(!q)return;setAiInput("");setAiMessages(x=>[...x,{role:"user",text:q},{role:"ai",text:"Pensando…"}]);try{const res=await fetch("/api/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:q,history:aiMessages.slice(-10),repo:selectedRepo||null})});const data=await res.json();if(!res.ok)throw new Error(data.error||"AI request failed");let nextRepo=selectedRepo;for(const op of Array.isArray(data.operations)?data.operations:[]){const path=String(op.path||"").split("/").filter(p=>p && p!=="..").join("/");if(!path||path.includes(".."))continue;if(op.type==="write_file"){if(!nextRepo)continue;nextRepo={...nextRepo,files:{...(nextRepo.files||{}),[path]:String(op.content||"")}}}else if(op.type==="delete_file"){if(!nextRepo)continue;const fs={...(nextRepo.files||{})};delete fs[path];nextRepo={...nextRepo,files:fs}}else if(op.type==="create_folder"){if(!nextRepo)continue;const folders=[...(nextRepo.folders||[])];if(!folders.includes(path))folders.push(path);nextRepo={...nextRepo,folders}}}if(nextRepo&&nextRepo!==selectedRepo){setSelectedRepo(nextRepo);setRepos(x=>x.map(r=>r.id===nextRepo.id||r.name===nextRepo.name?nextRepo:r));await saveLocalRepo(nextRepo);flash("GutHeb AI ha aplicado los cambios al repositorio");}setAiMessages(x=>{const copy=[...x];copy[copy.length-1]={role:"ai",text:data.message||"Hecho."};return copy});}catch(err){setAiMessages(x=>{const copy=[...x];copy[copy.length-1]={role:"ai",text:"No he podido ejecutar la acción: "+err.message};return copy})}}
  function aiAnswer(q){const l=q.toLowerCase();if(l.includes("crear")&&l.includes("repo"))return "Puedo preparar un nuevo repositorio desde el panel de creación. Para seguridad, las escrituras reales necesitan un backend autenticado conectado a GutHeb.";if(l.includes("readme"))return "Puedo generar la estructura y el contenido de un README, además de sugerir licencia, topics y estructura de carpetas.";if(l.includes("licencia"))return "Puedo ayudarte a elegir y generar archivos de licencia conocidos, pero la aplicación debe guardar el archivo mediante su backend.";if(l.includes("paquete")||l.includes("package"))return "Puedo analizar package.json y mostrar dependencias y versiones cuando el repositorio las exponga.";return "Soy GutHeb AI. Puedo ayudarte a diseñar repositorios, README, issues, PRs, estructura de proyectos, código y automatizaciones. Para acciones reales sobre Git, necesito una API/backend con autenticación segura.";}
  async function login(e){
    e.preventDefault();
    try{const res=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",email:authForm.email,password:authForm.password})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Sign in failed");setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));const me=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"me"})});if(me.ok){const m=await me.json();setRepos(m.repos||[]);localStorage.setItem("gutheb-repos-v2",JSON.stringify(m.repos||[]));}go("home");}catch(err){flash(err.message);}
  }
  async function logout(){try{await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})});}catch{}setUser(null);localStorage.removeItem("gutheb-user");localStorage.removeItem("gutheb-profile");setRepos([]);go("home");}
  async function register(e){e.preventDefault();try{const res=await fetch("/api/account",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",username:authForm.name,email:authForm.email,password:authForm.password})});const d=await res.json();if(!res.ok)throw new Error(d.error||"Registration failed");setUser(d.user);setProfile({...d.profile,username:d.user.name});localStorage.setItem("gutheb-user",JSON.stringify(d.user));localStorage.setItem("gutheb-profile",JSON.stringify(d.profile||{}));setRepos(d.repos||[]);go("home");}catch(err){flash(err.message);}}
  async function importGithubRepo(e){
    e.preventDefault();
    if(!importForm.url.trim())return flash("GitHub repository URL is required");
    setImporting(true);
    try{
      const res=await fetch("/api/github-import",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:importForm.url.trim(),branch:importForm.branch.trim(),targetName:importForm.name.trim(),username:user.name})});
      const d=await res.json();if(!res.ok)throw new Error(d.error||"GitHub import failed");
      const source=d.repository||{};const name=source.name||importForm.name.trim()||"imported-repository";
      const me=await fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"me"})});const md=await me.json();if(!me.ok)throw new Error(md.error||"Repository imported, but GutHeb could not refresh your repositories.");const imported=(md.repos||[]).find(x=>x.id===d.id);if(!imported)throw new Error("GitHub import finished, but the imported repository was not returned by GutHeb.");const r={...imported,currentBranch:source.defaultBranch||"main",source:"github",sourceUrl:source.sourceUrl||importForm.url.trim()};setRepoBranches(x=>({...x,[user.name+"/"+r.name]:[r.currentBranch||"main"]}));setRepos(md.repos||[]);setSelectedRepo(r);setImportOpen(false);setImportForm({url:"",branch:"",name:""});flash("GitHub repository imported into GutHeb");go("repos");
    }catch(err){flash(err.message)}finally{setImporting(false)}
  }
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
    if(!next?.id&&!next?.name)return flash("Repository data is incomplete");
    setRepos(xs=>xs.map(r=>{
      const sameId=next.id&&r.id===next.id;
      const sameOwnerName=(r.owner||user?.name)===(next.owner||user?.name)&&r.name===next.name;
      return sameId||sameOwnerName?{...next,owner:next.owner||r.owner||user?.name}:r;
    }));
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

  const routeParts=page.startsWith("repo/")?page.slice(5).split("/"):[];
  const routeRepo=routeParts.length?decodeURIComponent(routeParts[0]):null;
  const routeKind=routeParts[1]||"";
  const routeBranch=routeParts[2]?decodeURIComponent(routeParts[2]):"main";
  const routePath=routeParts.slice(3).map(x=>decodeURIComponent(x)).join("/");
  if(routeRepo && !selectedRepo){const r=repos.find(x=>x.name===routeRepo);if(r){setTimeout(()=>{setSelectedRepo({...r,currentBranch:routeBranch});setRepoTab("code");setTree(Object.keys(r.files||{}).map(path=>({path,type:"blob"})));if(routeKind==="blob"&&routePath&&r.files?.[routePath]!==undefined)setFile({path:routePath,content:r.files[routePath]});},0);}}

  return <div className="gh">
    <header className={"top "+(routeRepo?"repoGlobalTop":"")}>
      <button className="logo" onClick={()=>go("home")} aria-label="GutHeb home"><img src="/gutheb-logo.svg?v=20260927" alt="" /></button>
      <div className="wordmark" onClick={()=>go("home")}>GutHeb</div>
      <div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search or jump to..." /><kbd>/</kbd></div>
      <nav className="topnav">
        {routeRepo ? <>
          {["code","issues","pulls","actions","projects","wiki","security","insights"].map(x=><button key={x} onClick={()=>setRepoTab(x)} className={repoTab===x?"repoTopActive":""}>{x==="pulls"?"Pull requests":x[0].toUpperCase()+x.slice(1)}</button>)}
        </> : <>
          <button onClick={()=>go("issues")}>Issues</button><button onClick={()=>go("pulls")}>Pull requests</button><button onClick={()=>go("marketplace")}>Marketplace</button><button onClick={()=>go("explore")}>Explore</button>
        </>}
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
        {page==="repos"&&<Repos repos={filteredRepos.filter(r=>!r.owner||r.owner===user.name)} openRepo={openRepo} go={go} pinned={pinned} togglePin={togglePin} onImport={()=>setImportOpen(true)}/>}
        {page==="new"&&<NewRepo form={newRepo} setForm={setNewRepo} onSubmit={createRepo}/>}
        {page==="issues"&&<Issues issues={issues} user={user} title={issueTitle} setTitle={setIssueTitle} body={issueBody} setBody={setIssueBody} onSubmit={createIssue}/>}
        {page==="pulls"&&<Pulls prs={prs} setPRs={setPRs} user={user}/>}
        {page==="actions"&&<Actions repo={selectedRepo} flash={flash}/>}
        {page==="projects"&&<Projects/>}
        {page==="discussions"&&<Discussions/>}
        {page==="codespaces"&&<Codespaces repos={repos.filter(r=>!r.owner||r.owner===user.name)} user={user} saveLocalRepo={saveLocalRepo} flash={flash} go={go}/>}\n        {page.startsWith("codespace/")&&<Codespaces repos={repos.filter(r=>!r.owner||r.owner===user.name)} user={user} saveLocalRepo={saveLocalRepo} flash={flash} go={go} sessionId={decodeURIComponent(page.split("/session/")[1]||"")} sessionPerson={decodeURIComponent(page.split("/")[1]||user.name)}/>}
        {page==="marketplace"&&<Marketplace repos={repos} setRepos={setRepos} selectedRepo={selectedRepo} saveLocalRepo={saveLocalRepo} user={user} flash={flash}/>}
        {page==="explore"&&<Explore/>}
        {page==="notifications"&&<Notifications/>}
        {page==="profile"&&<Profile user={user} profile={profile} setProfile={setProfile} save={saveProfile} repos={repos.filter(r=>!r.owner||r.owner===user.name)} pinned={pinned} togglePin={togglePin}/>}
        {page==="settings"&&<Settings settings={settings} setSettings={setSettings} user={user}/>}
        {importOpen&&<ImportRepoModal open={importOpen} onClose={()=>!importing&&setImportOpen(false)} onSubmit={importGithubRepo} form={importForm} setForm={setImportForm} loading={importing}/>}
        {routeRepo&&selectedRepo&&<Repo repo={selectedRepo} tab={repoTab} setTab={setRepoTab} tree={tree} file={file} openFile={openFile} go={go} packages={packages} user={user} repoBranches={repoBranches} createBranch={createBranch} selectBranch={selectBranch} downloadRepoZip={downloadRepoZip} openInWorkers={openInWorkers} flash={flash} currentPath={routePath} routeKind={routeKind}/>}
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

function Repos({repos,openRepo,go,pinned,togglePin,onImport}){return <Page title="Repositories" subtitle="Create, manage, and explore your repositories." action={<div className="repoPageActions"><button onClick={onImport}>↓ Import repository</button><button className="primary" onClick={()=>go("new")}>New</button></div>}><div className="repo-list">{repos.map(r=><RepoCard key={r.name} r={r} open={openRepo} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</div></Page>}

function ImportRepoModal({open,onClose,onSubmit,form,setForm,loading}){if(!open)return null;return <div className="importModalBackdrop" onClick={onClose}><section className="importModal" onClick={e=>e.stopPropagation()}><div className="importModalHead"><div><span className="marketEyebrow">GUTHEB IMPORT</span><h2>Import a repository</h2><p>Copy a public repository from GitHub into your GutHeb account.</p></div><button onClick={onClose}>×</button></div><form onSubmit={onSubmit}><label>GitHub repository URL<input autoFocus value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://github.com/owner/repository" required/></label><div className="importGrid"><label>Branch <span className="muted">(optional)</span><input value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})} placeholder="default branch"/></label><label>GutHeb repository name <span className="muted">(optional)</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="same as GitHub"/></label></div><div className="importNote">Public repositories only. Files are copied into GutHeb, including folders and README content.</div><div className="importModalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={loading}>{loading?"Importing…":"Import repository"}</button></div></form></section></div>}

function NewRepo({form,setForm,onSubmit}){const user=JSON.parse(localStorage.getItem("gutheb-user")||"{}");return <Page title="Create a new repository" subtitle="A repository contains all of your project's files, history, and collaboration tools."><form className="panel form" onSubmit={onSubmit}><label>Owner<input value={user.name||"user"} disabled/></label><label>Repository name<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="my-project"/></label><label>Description <span className="muted">(optional)</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Visibility<select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value})}><option>Public</option><option>Private</option></select></label><button className="primary" type="submit">Create repository</button></form></Page>}

function Issues({issues,title,setTitle,body,setBody,onSubmit}){return <Page title="Issues" subtitle="Plan, discuss, and track work."><form className="panel issueform" onSubmit={onSubmit}><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Issue title"/><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Leave a description..."/><button className="primary">New issue</button></form><Panel title={issues.length+" issues"}>{issues.map(i=><div className="issue" key={i.id}><span className="open">●</span><div><strong>{i.title}</strong><small>#{i.id} opened by {i.author}</small><div>{i.labels.map(l=><span className="label" key={l}>{l}</span>)}</div></div></div>)}</Panel></Page>}

function Pulls({prs,setPRs,user}){return <Page title="Pull requests" subtitle="Review code changes before they land."><Panel title={prs.length+" open pull requests"} action={<button onClick={()=>setPRs(x=>[{id:Date.now(),title:"New pull request",state:"open",author:user.name,branch:"feature/new"},...x])}>New pull request</button>}>{prs.map(p=><div className="issue" key={p.id}><span className="open">↗</span><div><strong>{p.title}</strong><small>#{p.id} · {p.branch} · opened by {p.author}</small></div></div>)}</Panel></Page>}

function Actions({repo,flash}){
  const [tab,setTab]=useState("runs"),[runs,setRuns]=useState([]),[jobs,setJobs]=useState([]),[artifacts,setArtifacts]=useState([]),[selectedRun,setSelectedRun]=useState(null),[logs,setLogs]=useState(""),[loading,setLoading]=useState(true),[running,setRunning]=useState(false),[error,setError]=useState(""),[yuml,setYuml]=useState("");
  async function loadRuns(){
    setLoading(true);setError("");
    try{const r=await fetch("/api/actions?op=runs",{credentials:"include"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load GutHeb Actions");setRuns(d.runs||[])}
    catch(e){setError(e.message)}finally{setLoading(false)}
  }
  async function loadDefault(){
    try{
      const installed=Object.entries(repo?.files||{}).find(([path])=>path.startsWith(".gh/yuml/")&&path.endsWith(".yuml"));
      if(installed){setYuml(installed[1]||"");return;}
      const r=await fetch("/api/actions?op=default",{credentials:"include"}),d=await r.json();if(r.ok)setYuml(d.yuml||"")
    }catch{}
  }
  async function validate(){
    setError("");
    try{const r=await fetch("/api/actions",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({action:"validate",yuml})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Invalid YUML");flash("YUML válido ✓")}
    catch(e){setError(e.message)}
  }
  async function dispatch(){
    setRunning(true);setError("");
    try{
      const r=await fetch("/api/actions",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({action:"dispatch",yuml,workflow:"GutHeb YUML",ref:"main"})}),d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not start action");
      flash("GutHeb Action enqueued");setSelectedRun(d.run);setTab("jobs");await loadRuns();
    }catch(e){setError(e.message)}finally{setRunning(false)}
  }
  async function loadRun(run){
    setSelectedRun(run);setTab("jobs");setError("");
    try{const [j,a]=await Promise.all([fetch("/api/actions?op=jobs&run_id="+encodeURIComponent(run.id),{credentials:"include"}),fetch("/api/actions?op=artifacts&run_id="+encodeURIComponent(run.id),{credentials:"include"})]);const jd=await j.json(),ad=await a.json();if(!j.ok)throw new Error(jd.error||"Could not load jobs");setJobs(jd.jobs||[]);setArtifacts(ad.artifacts||[])}
    catch(e){setError(e.message)}
  }
  async function loadLogs(jobId){
    try{const r=await fetch("/api/actions?op=logs&job_id="+encodeURIComponent(jobId),{credentials:"include"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load logs");setLogs(d.logs||"");setTab("logs")}catch(e){setError(e.message)}
  }
  useEffect(()=>{loadDefault();loadRuns();const id=setInterval(loadRuns,5000);return()=>clearInterval(id)},[]);
  return <Page title="GutHeb Actions" subtitle="Automatizaciones nativas de GutHeb ejecutadas desde YUML." action={<div className="actionsToolbar"><button onClick={loadRuns}>↻ Refresh</button><button className="primary" onClick={dispatch} disabled={running}>{running?"Enqueuing…":"▶ Run YUML"}</button></div>}>
    <Panel title="YUML workflow" action={<div className="actionsToolbar"><button onClick={validate}>✓ Validate</button><button onClick={loadDefault}>Reset</button></div>}>
      <div className="yumlEditor">
        <div className="yumlBar"><span>gutheb.yuml</span><span>YUML · GutHeb native</span></div>
        <textarea value={yuml} onChange={e=>setYuml(e.target.value)} spellCheck={false} aria-label="YUML workflow editor"/>
      </div>
    </Panel>
    <div className="actionTabs">{["runs","jobs","logs","artifacts"].map(x=><button className={tab===x?"sel":""} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>
    {error&&<div className="actionError">{error}</div>}
    {tab==="runs"&&<Panel title="GutHeb runs">{loading?<div className="empty">Loading GutHeb runs…</div>:runs.length?runs.map(r=><button className="realRunRow" key={r.id} onClick={()=>loadRun(r)}><span className={"runDot "+(r.conclusion||r.status)}/><div><b>{r.name}</b><small>#{r.run_number} · {r.event} · {r.head_branch||"main"} · {r.runner||"linux"}</small></div><strong>{r.conclusion||r.status}</strong><span>GutHeb</span></button>):<div className="empty">No GutHeb runs yet.</div>}</Panel>}
    {tab==="jobs"&&<Panel title={selectedRun?"Jobs for #"+selectedRun.run_number:"Jobs"}>{selectedRun?jobs.length?jobs.map(j=><div className="resourceRow" key={j.id}><div><b>{j.name}</b><small>{j.runner_name||"GutHeb Runner"} · {j.runner_os||"linux"}</small></div><span className={"statusPill "+(j.conclusion||j.status)}>{j.conclusion||j.status}</span><button onClick={()=>loadLogs(j.id)}>Logs</button></div>):<div className="empty">No jobs yet.</div>:<div className="empty">Select a GutHeb run first.</div>}</Panel>}
    {tab==="logs"&&<Panel title="Job logs" action={<button onClick={()=>setTab("jobs")}>← Jobs</button>}>{logs?<pre className="actionLogs">{logs}</pre>:<div className="empty">Select a GutHeb job and open its logs.</div>}</Panel>}
    {tab==="artifacts"&&<Panel title="Artifacts">{selectedRun?artifacts.length?artifacts.map(a=><div className="resourceRow" key={a.id}><div><b>▣ {a.name}</b><small>{a.size_in_bytes||0} bytes</small></div></div>):<div className="empty">No artifacts for this run.</div>:<div className="empty">Select a run first.</div>}</Panel>}
    <div className="actionsRealNotice">GutHeb Actions · YUML · GutHeb Runner. No GitHub Actions API is used by this workspace.</div>
  </Page>
}
function Projects(){return <Page title="Projects" subtitle="Track work with tables, boards, and roadmaps."><div className="board"><div>Todo</div><div>In progress</div><div>Done</div><article>Plan next release</article><article>Build issue workflow</article><article>Ship first version</article></div></Page>}
function Discussions(){return <Page title="Discussions" subtitle="Community conversations and long-form collaboration."><Panel title="Recent discussions"><Activity text="Welcome to the community"/><Activity text="Share what you are building"/><Activity text="Feature ideas"/></Panel></Page>}
function Codespaces({repos,user,saveLocalRepo,flash,go,sessionId:routeSessionId,sessionPerson}){
  const [repoName,setRepoName]=useState(()=>localStorage.getItem("gutheb-codespace-repo")||repos[0]?.name||"");
  const [open,setOpen]=useState(!!routeSessionId||localStorage.getItem("gutheb-codespace-open")==="1");
  const [sessionId,setSessionId]=useState(()=>routeSessionId||localStorage.getItem("gutheb-codespace-session")||"");
  const [path,setPath]=useState(()=>localStorage.getItem("gutheb-codespace-file")||"");
  const [draft,setDraft]=useState(""); const [terminal,setTerminal]=useState(""); const [cmd,setCmd]=useState(""); const [agent,setAgent]=useState(false); const [workspaceFiles,setWorkspaceFiles]=useState({}); const [agentPrompt,setAgentPrompt]=useState(""); const [side,setSide]=useState("explorer");
  const repo=repos.find(r=>r.name===repoName)||null; const files=workspaceFiles;
  useEffect(()=>{if(routeSessionId){setSessionId(routeSessionId);setOpen(true);localStorage.setItem("gutheb-codespace-session",routeSessionId)}},[routeSessionId]);
  useEffect(()=>{if(repoName&&repo){setWorkspaceFiles({...repo.files});}},[repoName,repo?.id]);
  useEffect(()=>{if(path&&files[path]!==undefined)setDraft(String(files[path]||""));},[path,workspaceFiles]);
  const start=()=>{if(!repo)return flash("Select a repository first");const id=crypto.randomUUID();localStorage.setItem("gutheb-codespace-repo",repo.name);localStorage.setItem("gutheb-codespace-open","1");localStorage.setItem("gutheb-codespace-session",id);const first=Object.keys(repo.files||{})[0]||"";setPath(first);localStorage.setItem("gutheb-codespace-file",first);setSessionId(id);setOpen(true);go&&go("codespace/"+encodeURIComponent(user.name)+"/session/"+encodeURIComponent(id));};
  const back=()=>{setOpen(false);localStorage.setItem("gutheb-codespace-open","0");go&&go("codespaces")};
  const save=()=>{if(!repo||!path)return;const nextFiles={...workspaceFiles,[path]:draft};setWorkspaceFiles(nextFiles);saveLocalRepo({...repo,files:{...(repo.files||{}),[path]:draft}});flash("Saved");};
  const run=()=>{const c=cmd.trim();if(!c)return;let out="";if(c==="pwd")out="/workspace/"+(repo?.name||"repository");else if(c==="ls"||c==="ls -la")out=Object.keys(files).join("\\n")||"(empty)";else if(c==="clear"){setTerminal("");setCmd("");return}else if(c.toLowerCase()==="gut pash -g delete"){setWorkspaceFiles({});setPath("");setDraft("");localStorage.removeItem("gutheb-codespace-file");out="Codespace workspace cleared. Repository unchanged.";flash("Codespace vaciado. El repositorio no ha cambiado.");}else if(c==="git status")out="On branch main\\nWorking tree ready.";else if(c.startsWith("cat ")){const p=c.slice(4).trim();out=files[p]!==undefined?String(files[p]):"cat: "+p+": No such file"}else out="Command is not connected to a Linux runner yet.";setTerminal(x=>x+"$ "+c+"\\n"+out+"\\n");setCmd("")};
  const [agentBusy,setAgentBusy]=useState(false); const [agentMessages,setAgentMessages]=useState([]);
  const sendAgent=async()=>{
    const prompt=agentPrompt.trim();
    if(!prompt||agentBusy)return;
    setAgentPrompt("");
    setAgentBusy(true);
    setAgentMessages(x=>[...x,{role:"user",text:prompt},{role:"ai",text:"Pensando…"}]);
    try{
      const contextRepo=repo?{...repo,files:workspaceFiles,selectedFile:path?{path,content:String(workspaceFiles[path]??"")}:null}:null;
      const res=await fetch("/api/ai",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({message:prompt,history:agentMessages.slice(-10),repo:contextRepo})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"AI request failed");
      let nextRepo=repo;
      const operations=Array.isArray(data.operations)?data.operations:[];
      for(const op of operations){
        const rawPath=String(op.path||"");
        const pth=rawPath.split("/").filter(part=>part&&part!=="..").join("/");
        if(!pth)continue;
        if(op.type==="write_file"&&nextRepo){
          nextRepo={...nextRepo,files:{...(nextRepo.files||{}),[pth]:String(op.content||"")}};
        }else if(op.type==="delete_file"&&nextRepo){
          const fs={...(nextRepo.files||{})};
          delete fs[pth];
          nextRepo={...nextRepo,files:fs};
        }else if(op.type==="create_folder"&&nextRepo){
          const folders=[...(nextRepo.folders||[])];
          if(!folders.includes(pth))folders.push(pth);
          nextRepo={...nextRepo,folders};
        }
      }
      if(nextRepo&&repo&&nextRepo!==repo){
        saveLocalRepo(nextRepo);
        flash("Agent applied changes");
      }
      setAgentMessages(x=>{const a=[...x];a[a.length-1]={role:"ai",text:data.message||"Hecho."};return a});
    }catch(e){
      setAgentMessages(x=>{const a=[...x];a[a.length-1]={role:"ai",text:"Error: "+e.message};return a});
    }finally{setAgentBusy(false)}
  };
  if(!open)return <Page title="Codespaces" subtitle="Cloud development environments for your repositories."><Panel title="Create a codespace"><div className="codespaceCreate"><div><h2>GutHeb Codespaces</h2><p>Open a full-screen development workspace inspired by modern code editors.</p></div><label>Repository<select value={repoName} onChange={e=>setRepoName(e.target.value)}>{repos.map(r=><option key={r.name} value={r.name}>{r.owner||user.name}/{r.name}</option>)}</select></label><button className="primary" onClick={start} disabled={!repo}>Create codespace</button></div></Panel></Page>;
  return <div className="gutheb-code-fullscreen"><header className="codeTop"><div className="codeBrand">◈ GutHeb</div><div className="codeRepo">{repo?.name||repoName} <span>•</span> {sessionId.slice(0,8)}</div><div className="codeTopActions"><button onClick={save}>Save</button><button className={agent?"active":""} onClick={()=>setAgent(!agent)}>✦ Agent</button><button onClick={back}>Exit</button></div></header>
    <div className="codeBody"><aside className="codeActivity"><button className={side==="explorer"?"active":""} onClick={()=>setSide("explorer")}>▱<small>EXPLORER</small></button><button className={side==="search"?"active":""} onClick={()=>setSide("search")}>⌕<small>SEARCH</small></button><button className={side==="source"?"active":""} onClick={()=>setSide("source")}>⑂<small>SOURCE</small></button></aside>
      <aside className="codeExplorer">{side==="explorer"?<><div className="codePaneTitle">EXPLORER <span>{repo?.name}</span></div>{Object.keys(files).map(p=><button className={path===p?"active":""} key={p} onClick={()=>{setPath(p);localStorage.setItem("gutheb-codespace-file",p)}}>▱ {p}</button>)}{!Object.keys(files).length&&<div className="codeEmpty">No files</div>}</>:<div className="codeEmpty">{side==="search"?"Search across files":"Source control"}</div>}</aside>
      <main className="codeMain"><div className="codeTabs">{path&&<button className="codeTab active">{path} <span>●</span></button>}<button className="codeTabAdd">+</button></div><div className="codeEditorArea">{path?<textarea className="codeEditorFull" value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false}/>:<div className="codeWelcome"><div className="codeLogo">◈</div><h1>GutHeb Codespaces</h1><p>Open a file from Explorer to start coding.</p></div>}</div><div className="codeTerminal"><div className="codeTerminalHead"><span>TERMINAL</span><button onClick={()=>setTerminal("")}>Clear</button></div><pre>{terminal||"GutHeb terminal ready."}</pre><form onSubmit={e=>{e.preventDefault();run()}}><span>›</span><input value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="Type a command..."/></form></div></main>
      {agent&&<aside className="codeAgent"><div className="codeAgentHead">✦ Agent <button onClick={()=>setAgent(false)}>×</button></div><div className="codeAgentBody"><div className="agentIntro"><b>GutHeb Agent</b><span>Powered by GutHeb AI · Pollinations</span></div><div className="agentChat">{agentMessages.map((m,i)=><div key={i} className={"agentMsg "+m.role}><b>{m.role==="user"?"You":"Agent"}</b><span>{m.text}</span></div>)}{!agentMessages.length&&<div className="agentHint">Ask Agent to explain, edit, debug or plan changes in this Codespace.</div>}</div><form onSubmit={e=>{e.preventDefault();sendAgent()}}><textarea value={agentPrompt} onChange={e=>setAgentPrompt(e.target.value)} placeholder="Ask Agent..." disabled={agentBusy}/><button className="primary" disabled={agentBusy}>{agentBusy?"Thinking…":"Send"}</button></form></div></aside>}
    </div><footer className="codeStatus"><span>main</span><span>GutHeb</span><span>{path||"No file"}</span><span className="codeStatusRight">Ln 1, Col 1 • UTF-8 • Spaces: 2</span></footer>
  </div>
}

function Marketplace({repos,setRepos,selectedRepo,saveLocalRepo,user,flash}){
  const [tab,setTab]=useState("actions");
  const [q,setQ]=useState("");
  const [installed,setInstalled]=useState(()=>JSON.parse(localStorage.getItem("gutheb-market-installed")||"[]"));
  const [published,setPublished]=useState([]);
  const [publishing,setPublishing]=useState(false);
  const [form,setForm]=useState({name:"",version:"1.0.0",description:"",definition:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [installTarget,setInstallTarget]=useState(selectedRepo?.name||repos.find(r=>!r.owner||r.owner===user.name)?.name||"");
  const [selectedAction,setSelectedAction]=useState(null);
  const [editing,setEditing]=useState(false);
  const [editForm,setEditForm]=useState(null);
  const [editSaving,setEditSaving]=useState(false);

  async function loadPublished(){
    try{const r=await fetch("/api/marketplace?op=actions",{credentials:"include"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load Actions");setPublished(d.actions||[]);}
    catch(e){setError(e.message)}
  }
  useEffect(()=>{loadPublished()},[]);

  async function publish(e){
    e.preventDefault();setError("");
    const payload={action:"publish",name:form.name.trim(),version:form.version.trim(),description:form.description.trim(),definition:form.definition.trim()};
    if(!payload.name||!payload.version||!payload.description||!payload.definition)return setError("Name, version, description and Action definition are required.");
    setSaving(true);
    try{const r=await fetch("/api/marketplace",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not publish Action");setPublished(x=>[d.action,...x]);setForm({name:"",version:"1.0.0",description:"",definition:""});setPublishing(false);setTab("actions");flash("Action published to GutHeb Marketplace");}
    catch(e){setError(e.message)}finally{setSaving(false)}
  }
  function install(item){
    const target=repos.find(r=>r.name===installTarget&&(!r.owner||r.owner===user.name));
    if(!target)return setError("Select a repository first. Marketplace installs Actions into that repository's .gh/yuml/ folder.");
    const path=".gh/yuml/"+item.slug+".yuml";
    const next={...target,files:{...(target.files||{})},folders:[...(target.folders||[])]};
    if(next.files[path]!==undefined)return flash(item.name+" is already installed in this repository");
    next.files[path]=item.definition;
    if(!next.folders.includes(".gh"))next.folders.push(".gh");
    if(!next.folders.includes(".gh/yuml"))next.folders.push(".gh/yuml");
    setRepos(xs=>xs.map(r=>r.id===target.id||((r.owner||user.name)=== (target.owner||user.name) && r.name===target.name)?next:r));
    if(selectedRepo?.id===target.id || (selectedRepo?.name===target.name && selectedRepo?.owner===target.owner)) setSelectedRepo(next);
    fetch("/api/account",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"repo",repo:next})}).catch(()=>{});
    const nextInstalled=[...installed,item.id];
    setInstalled(nextInstalled);
    localStorage.setItem("gutheb-market-installed",JSON.stringify(nextInstalled));
    flash(item.name+" installed in .gh/yuml");
  }
  async function saveActionEdit(){
    if(!selectedAction||!editForm)return;
    setEditSaving(true);setError("");
    try{
      const r=await fetch("/api/marketplace",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:selectedAction.id,...editForm})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not update Action");
      setPublished(xs=>xs.map(x=>x.id===d.action.id?d.action:x));setSelectedAction(d.action);setEditing(false);setEditForm(null);flash("Action updated");
    }catch(e){setError(e.message)}finally{setEditSaving(false)}
  }
  const filtered=published.filter(x=>(x.name+" "+x.description+" "+x.author_name).toLowerCase().includes(q.toLowerCase()));

  if(publishing)return <Page title="Publish an Action" subtitle="Create a native GutHeb Action with your own definition and structure.">
    <div className="marketplaceV2"><form className="panel marketPublisher" onSubmit={publish}>
      <div className="publisherIntro"><span className="marketEyebrow">GUTHEB MARKETPLACE</span><h2>New Action</h2><p>GutHeb validates only the Marketplace metadata. The Action definition is yours and is stored exactly as supplied.</p></div>
      {error&&<div className="actionError">{error}</div>}
      <div className="publisherGrid"><label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="My Action" required/></label><label>Version<input value={form.version} onChange={e=>setForm({...form,version:e.target.value})} placeholder="1.0.0" required/></label></div>
      <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What does this Action do?" required/></label>
      <label>Action definition<textarea className="marketDefinition" value={form.definition} onChange={e=>setForm({...form,definition:e.target.value})} placeholder="Write your own Action structure here. GutHeb will not replace it with a predefined template." spellCheck={false} required/></label>
      <div className="publisherActions"><button type="button" onClick={()=>{setPublishing(false);setError("")}}>Cancel</button><button className="primary" disabled={saving}>{saving?"Publishing…":"Publish Action"}</button></div>
    </form></div>
  </Page>;

  return <Page title="Marketplace" subtitle="Discover and publish native GutHeb Actions.">
    <div className="marketplaceV2"><div className="marketHero"><div><span className="marketEyebrow">GUTHEB MARKETPLACE</span><h2>Your Action catalog</h2><p>Installed Actions are copied into the selected repository under .gh/yuml/.</p></div><button className="primary" onClick={()=>{setPublishing(true);setError("")}}>＋ Publish an Action</button></div>
    <div className="marketInstallTarget"><label>Install into <select value={installTarget} onChange={e=>setInstallTarget(e.target.value)}><option value="">Select repository…</option>{repos.filter(r=>!r.owner||r.owner===user.name).map(r=><option key={r.name} value={r.name}>{r.name}</option>)}</select></label><small>Marketplace Actions are installed as <code>.gh/yuml/&lt;action&gt;.yuml</code> in the selected repository.</small></div><div className="marketTabs"><button className={tab==="actions"?"sel":""} onClick={()=>setTab("actions")}>Actions</button><button className={tab==="installed"?"sel":""} onClick={()=>setTab("installed")}>Installed</button></div>
    {tab==="actions"&&<div><div className="marketSearch"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search published Actions…"/></div>{error&&<div className="actionError">{error}</div>}
      {filtered.length?<div className="marketGrid">{filtered.map(item=><article className="marketActionCard marketActionCardClickable" key={item.id} onClick={()=>{setSelectedAction(item);setEditing(false);setEditForm(null)}}><div className="marketActionIcon">⚙</div><div className="marketActionBody"><div className="marketActionHead"><div><h3>{item.name}</h3><small>{item.author_name} · v{item.version}</small></div><button onClick={e=>{e.stopPropagation();install(item)}}>{installed.includes(item.id)?"Installed":"Install"}</button></div><p>{item.description}</p><div className="marketActionFooter"><code>{item.slug}</code><span>View details ›</span></div></div></article>)}</div>:
      <div className="marketEmpty"><div className="marketEmptyIcon">＋</div><h3>No published Actions yet</h3><p>Publish an Action and it will appear here from the GutHeb Marketplace database.</p><button className="primary" onClick={()=>{setPublishing(true);setError("")}}>Publish your first Action</button></div>}
    </div>}
    {tab==="installed"&&<Panel title="Installed Actions">{installed.length?<div>{installed.map(id=><div className="resourceRow" key={id}><div><b>{id.split("/").pop()}</b><small>{id}</small></div><span className="statusPill success">Installed</span></div>)}</div>:<div className="empty">No Actions installed yet.</div>}</Panel>}
    {selectedAction&&<div className="marketModalBackdrop" onClick={()=>setSelectedAction(null)}><section className="marketActionModal" onClick={e=>e.stopPropagation()}>
      <div className="marketModalTop"><div><span className="marketEyebrow">GUTHEB ACTION</span><h2>{selectedAction.name}</h2><p>{selectedAction.description}</p></div><button className="marketModalClose" onClick={()=>setSelectedAction(null)}>×</button></div>
      <div className="marketMetaGrid"><div><small>Version</small><b>v{selectedAction.version}</b></div><div><small>Author</small><b>{selectedAction.author_name}</b></div><div><small>Slug</small><b>{selectedAction.slug}</b></div><div><small>Published</small><b>{new Date(selectedAction.created_at).toLocaleDateString()}</b></div></div>
      <div className="marketCodeHeader"><strong>Action definition</strong><span>{selectedAction.owner_id===user?.id?"Creator · editable":"Read-only"}</span></div>
      {editing&&editForm?<textarea className="marketDefinition marketDetailCode" value={editForm.definition} onChange={e=>setEditForm({...editForm,definition:e.target.value})} spellCheck={false}/>:
      <pre className="marketDetailCode"><code>{selectedAction.definition}</code></pre>}
      {selectedAction.owner_id===user?.id&&editing&&editForm&&<div className="marketEditFields"><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/><input value={editForm.version} onChange={e=>setEditForm({...editForm,version:e.target.value})}/><textarea value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></div>}
      <div className="marketModalActions">{selectedAction.owner_id===user?.id&&!editing&&<button onClick={()=>{setEditForm({name:selectedAction.name,version:selectedAction.version,description:selectedAction.description,definition:selectedAction.definition});setEditing(true)}}>Edit Action</button>}{editing&&<><button onClick={()=>{setEditing(false);setEditForm(null)}}>Cancel</button><button className="primary" disabled={editSaving} onClick={saveActionEdit}>{editSaving?"Saving…":"Save changes"}</button></>}{!editing&&<button className="primary" onClick={()=>install(selectedAction)}>{installed.includes(selectedAction.id)?"Installed":"Install Action"}</button>}</div>
    </section></div>}
    </div>
  </Page>
}
function Explore(){return <Page title="Explore" subtitle="Discover projects, topics, and developers."><div className="grid2"><Panel title="Trending"><RepoMini r={{name:"awesome-project",description:"A trending open-source project",language:"JavaScript"}}/></Panel><Panel title="Topics"><div className="topics">{["javascript","react","cloud","ai","games","web"].map(x=><span key={x}>#{x}</span>)}</div></Panel></div></Page>}
function Notifications(){return <Page title="Notifications"><Panel title="Inbox"><div className="empty">You're all caught up. 🎉</div></Panel></Page>}
function Profile({user,profile,setProfile,save,repos,pinned,togglePin}){const avatarFile=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>4*1024*1024)return;const reader=new FileReader();reader.onload=()=>setProfile(p=>({...p,avatar:String(reader.result||"")}));reader.readAsDataURL(f)};return <Page title={user.name} subtitle={user.email}><div className="profileHero"><div className="avatar">{profile.avatar?<img src={profile.avatar} alt="Profile"/>:<span>{user.name.slice(0,1).toUpperCase()}</span>}</div><div><h2>{user.name}</h2><p>{profile.bio||"Add a short bio to your profile."}</p></div></div><form className="panel form" onSubmit={save}><label>Username<input required value={profile.username??user.name} onChange={e=>setProfile({...profile,username:e.target.value})}/></label><label>Profile photo<input type="file" accept="image/*" onChange={avatarFile}/></label><label>Bio<textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label><label>Location<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})}/></label><label>Website<input value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})}/></label><button className="primary">Save profile</button></form><Panel title="Repositories">{repos.map(r=><RepoMini r={r} key={r.name} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</Panel></Page>}
function Settings({settings,setSettings,user}){return <Page title="Settings" subtitle="Manage your GutHeb account and preferences."><Panel title="Account"><div className="setting"><span><b>Username</b><small>{user.name}</small></span><button>Change</button></div><div className="setting"><span><b>Email</b><small>{user.email}</small></span><button>Manage</button></div></Panel><Panel title="Preferences"><div className="setting"><span><b>Theme</b><small>Dark developer theme</small></span><select value={settings.theme} onChange={e=>setSettings({...settings,theme:e.target.value})}><option>dark</option><option>light</option></select></div><div className="setting"><span><b>Email notifications</b><small>Receive product updates</small></span><input type="checkbox" checked={settings.email} onChange={e=>setSettings({...settings,email:e.target.checked})}/></div></Panel><Panel title="Danger zone"><button className="danger">Delete account</button></Panel></Page>}

function Repo({repo,tab,setTab,tree,file,openFile,go,packages,user,repoBranches,createBranch,selectBranch,downloadRepoZip,openInWorkers,flash}){
  const [draft,setDraft]=useState(file?.content||"");
  const [menu,setMenu]=useState("");
  const [release,setRelease]=useState(null);
  const [packageInfo,setPackageInfo]=useState(null);
  const [rawOpen,setRawOpen]=useState(false);
  useEffect(()=>setDraft(file?.content||""),[file?.path]);
  const files=tree||[];
  const key=(repo.owner||user.name)+"/"+repo.name, branches=repoBranches[key]||["main"];
  const owner=repo.owner===user.name;
  const branch=repo.currentBranch||"main";
  const visibility=(repo.visibility||"Public").toLowerCase();
  const readme=repo.files?.["README.md"]||"";
  const allPaths=Object.keys(repo.files||{});
  const routeParts=location.hash.replace(/^#\/?/,"").split("/");
  const pathStart=routeParts.indexOf("tree")>=0?routeParts.indexOf("tree")+2:routeParts.indexOf("blob")>=0?routeParts.indexOf("blob")+2:-1;
  const currentPath=pathStart>=0?decodeURIComponent(routeParts.slice(pathStart).join("/")):"";
  const prefix=currentPath?currentPath+"/":"";
  const directFolders=[...new Set(allPaths.map(p=>p.startsWith(prefix)?p.slice(prefix.length).split("/")[0]:"").filter(Boolean).filter(x=>x.includes(".")===false||allPaths.some(p=>p.startsWith(prefix+x+"/"))))];
  const directFiles=allPaths.filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes("/"));
  const goTree=(path="")=>go("repo/"+encodeURIComponent(repo.name)+"/tree/"+encodeURIComponent(branch)+(path?"/"+path.split("/").map(encodeURIComponent).join("/"):""));
  const goBlob=path=>{openFile(path);setRawOpen(false);go("repo/"+encodeURIComponent(repo.name)+"/blob/"+encodeURIComponent(branch)+"/"+path.split("/").map(encodeURIComponent).join("/"));};
  const rawFile=()=>{
    if(!file)return;
    const blob=new Blob([String(file.content||"")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=file.path.split("/").pop()||"raw.txt";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const createRelease=()=>{
    if(!owner)return flash("Only the repository owner can create releases");
    const tag=prompt("Release tag","v1.0.0"); if(!tag?.trim())return;
    const title=prompt("Release title",tag.trim()); if(title===null)return;
    setRelease({tag:tag.trim(),title:title.trim()||tag.trim(),author:user.name,date:new Date().toISOString()});
    flash("Release published");
  };
  const publishPackage=()=>{
    if(!owner)return flash("Only the repository owner can publish packages");
    const name=prompt("Package name",repo.name); if(!name?.trim())return;
    const version=prompt("Package version","1.0.0"); if(!version?.trim())return;
    setPackageInfo({name:name.trim(),version:version.trim(),owner:user.name});
    flash("Package published");
  };
  const addNewFile=()=>{
    if(!owner)return flash("Only the repository owner can edit this repository");
    const base=currentPath?currentPath+"/":"";
    const p=prompt("Create new file",base+"new-file.txt");
    if(p?.trim())window.dispatchEvent(new CustomEvent("gutheb:new-file",{detail:p.trim()}));
    setMenu("");
  };
  const upload=()=>{
    if(!owner)return flash("Only the repository owner can edit this repository");
    const input=document.createElement("input");input.type="file";input.multiple=true;
    input.onchange=async()=>{
      for(const picked of Array.from(input.files||[])){
        const path=(currentPath?currentPath+"/":"")+picked.name;
        const content=await picked.text().catch(()=> "");
        window.dispatchEvent(new CustomEvent("gutheb:new-file",{detail:path}));
        setTimeout(()=>window.dispatchEvent(new CustomEvent("gutheb:set-file-content",{detail:{path,content}})),50);
      }
      setMenu("");flash("Files uploaded");
    };
    input.click();
  };
  const deletePath=(path,directory=false)=>{if(!owner)return flash("Only the repository owner can edit this repository");const label=directory?"directory":"file";if(!window.confirm("Delete "+label+" \""+path+"\"? This cannot be undone."))return;window.dispatchEvent(new CustomEvent("gutheb:delete",{detail:{path,directory}}));setMenu("");};
  const copyClone=()=>{
    const url=location.origin+"/"+(repo.owner||user.name)+"/"+repo.name+".gut";
    Promise.resolve(navigator.clipboard?.writeText(url)).then(()=>flash("Clone URL copied")).catch(()=>flash(url));
    setMenu("");
  };
  return <section className="repoPage">
    <div className="repoTitleBar">
      <div className="repoTitle"><div className="repoCrumb"><button onClick={()=>go("profile")}>{repo.owner||"user"}</button><span>/</span><strong>{repo.name}</strong><span className={"visibility "+visibility}>{visibility}</span></div>{repo.description&&<p>{repo.description}</p>}</div>
      <div className="repoHeaderActions"><button>◉ <span>Watch</span> <b>0</b></button><button>⑂ <span>Fork</span> <b>{repo.forks||0}</b></button><button>☆ <span>Star</span> <b>{repo.stars||0}</b></button></div>
    </div>
    <nav className="repoTabs">{["code","issues","pulls","actions","projects","wiki","security","insights"].map(x=><button className={tab===x?"sel":""} onClick={()=>{setMenu("");setTab(x)}} key={x}>{x==="pulls"?"Pull requests":x[0].toUpperCase()+x.slice(1)}</button>)}{owner&&<button className="repoSettingsTab" onClick={()=>setTab("settings")}>⚙ Settings</button>}</nav>
    {tab==="code"&&<div className="repoGrid"><main className="repoCode">
      <div className="repoToolbar"><div className="repoToolbarLeft">
        <label className="branchSelect">⑂ <select value={branch} onChange={e=>{selectBranch(e.target.value);goTree("")}}>{branches.map(b=><option key={b}>{b}</option>)}</select></label>
        <button className="countButton">{branches.length} {branches.length===1?"branch":"branches"}</button><button className="countButton">0 tags</button>
      </div><div className="repoToolbarRight">
        <button className="goFile" onClick={()=>{const p=prompt("Go to file",currentPath||"");if(!p?.trim())return;const path=p.trim().replace(/^\/+|\/+$/g,"");if(repo.files?.[path]!==undefined)goBlob(path);else flash("File not found")}}>⌕ Go to file</button>
        <div className="repoDropdown"><button onClick={()=>setMenu(menu==="add"?"":"add")}>Add file ▾</button>{menu==="add"&&<div className="repoMenu">
          <button onClick={addNewFile}>＋ Create new file</button>
          <button onClick={upload}>↑ Upload files</button>
        </div>}</div>
        <div className="repoDropdown"><button className="codeGreen" onClick={()=>setMenu(menu==="code"?"":"code")}>Code ▾</button>{menu==="code"&&<div className="repoMenu repoCodeMenu">
          <div className="repoMenuTitle">Clone</div><div className="cloneRow"><span>HTTPS</span><button onClick={copyClone}>Copy</button></div>
          <code>{location.origin}/{repo.owner||user.name}/{repo.name}.gut</code>
          <button onClick={()=>{downloadRepoZip(repo);setMenu("")}}>↓ Download ZIP</button>
          <button onClick={()=>{openInWorkers(repo);setMenu("")}}>▣ Open in GutHeb Codespaces</button>
        </div>}</div>
      </div></div>
      <div className="repoBreadcrumbs"><button onClick={()=>goTree("")}>{repo.name}</button>{currentPath.split("/").filter(Boolean).map((part,i)=><React.Fragment key={part+i}><span>/</span><button onClick={()=>goTree(currentPath.split("/").slice(0,i+1).join("/"))}>{part}</button></React.Fragment>)}</div>
      <div className="repoFileCard"><div className="repoCommitHead"><div className="commitAuthor"><span className="miniAvatar">{(repo.owner||"U")[0].toUpperCase()}</span><b>{repo.owner||"user"}</b><span>Initial commit</span></div><div className="commitMeta">○ just now <b>1 commit</b></div></div>
        <div className="repoFilesList">
          {currentPath&&<div className="repoFileRow repoParentRow"><button onClick={()=>goTree(currentPath.split("/").slice(0,-1).join("/"))}><span className="fileIcon">↩</span><b>..</b></button><span>Parent directory</span><time></time></div>}
          {directFolders.map(folder=><div className="repoFileRow" key={"folder:"+folder}><button onClick={()=>goTree(currentPath?(currentPath+"/"+folder):folder)}><span className="fileIcon folderIcon">▰</span><span>{folder}</span></button><span>Initial commit</span><button className="repoRowDelete" title="Delete directory" onClick={()=>deletePath(currentPath?(currentPath+"/"+folder):folder,true)}>Delete</button><time>just now</time></div>)}
          {directFiles.map(path=><div className="repoFileRow" key={path}><button onClick={()=>goBlob(path)}><span className="fileIcon">{path.endsWith(".md")?"▤":"◇"}</span><span>{path.slice(prefix.length)}</span></button><span>Initial commit</span><button className="repoRowDelete" title="Delete file" onClick={()=>deletePath(path,false)}>Delete</button><time>just now</time></div>)}
          {!directFiles.length&&!directFolders.length&&<div className="repoEmptyFiles">This directory is empty.</div>}
        </div>
      </div>
      {file?<div className="editorCard repoEditorCard"><div className="editorHead"><span>◇ {file.path}</span><div className="editorActions"><button onClick={rawFile}>Raw</button><button onClick={()=>navigator.clipboard?.writeText(String(file.content||"")).then(()=>flash("File copied")).catch(()=>flash("Could not copy file"))}>Copy</button>{owner&&<button className="danger" onClick={()=>deletePath(file.path,false)}>Delete</button>}<span className="muted">{owner?"Editable by owner":"Read only"}</span></div></div><textarea readOnly={!owner} className="fileeditor" value={draft} onChange={e=>{setDraft(e.target.value);file.content=e.target.value}} spellCheck={false}/>{owner&&<div className="editorFooter"><button className="primary" onClick={()=>window.dispatchEvent(new CustomEvent("gutheb:save-file"))}>Save changes</button></div>}</div>:!currentPath&&<div className="readmeCard githubReadme"><div className="readmeHead"><span>▤ README.md</span><span className="muted">Edit</span></div><div className="readmeBody"><h1>{repo.name}</h1>{readme.replace(/^# .*?\n?/,"").trim()?<p>{readme.replace(/^# .*?\\n?/,"").trim()}</p>:<p>{repo.description||"No README description yet."}</p>}</div></div>}
    </main><aside className="repoAside githubAside"><section><h3>About</h3><p>{repo.description||"No description, website, or topics provided."}</p>{repo.website&&<a href={repo.website} target="_blank" rel="noreferrer">↗ Website</a>}<div className="asideLink">◇ Readme</div><div className="asideLink">◉ Activity</div></section><section><h3>Releases</h3>{release?<div className="repoRelease"><b>{release.title}</b><small>{release.tag} · {release.author}</small></div>:<p className="muted">No releases published</p>}{owner&&<button className="asideAction" onClick={createRelease}>Create a new release</button>}</section><section><h3>Packages</h3>{packageInfo?<div className="repoRelease"><b>{packageInfo.name}</b><small>v{packageInfo.version} · {packageInfo.owner}</small></div>:<p className="muted">No packages published</p>}{owner&&<button className="asideAction" onClick={publishPackage}>Publish your first package</button>}</section><section><h3>Contributors</h3><div className="contributor"><span className="miniAvatar">{(repo.owner||"U")[0].toUpperCase()}</span><b>{repo.owner||"user"}</b><small>1 commit</small></div></section><section><h3>Languages</h3><div className="languageBar"><span style={{width:"100%"}}/></div><p><b>● {repo.language||"Code"}</b> <span className="muted">100%</span></p></section></aside></div>}
    {tab!=="code"&&<div className="repoSubpage"><div className="repoSubpageHead"><h2>{tab==="pulls"?"Pull requests":tab[0].toUpperCase()+tab.slice(1)}</h2><button className="codeGreen" onClick={()=>setTab("code")}>← Code</button></div><Panel title={tab==="actions"?"GutHeb Actions":tab==="issues"?"Issues":tab==="pulls"?"Pull requests":tab==="projects"?"Projects":tab==="wiki"?"Wiki":tab==="security"?"Security":"Insights"}><div className="empty">This repository section is ready for repository-specific data.</div></Panel></div>}
  </section>
}

function foldersFromRepo(repo){
  const explicit=Array.isArray(repo.folders)?repo.folders:[];
  const inferred=Object.keys(repo.files||{}).map(p=>p.split("/").slice(0,-1).join("/")).filter(Boolean);
  return [...new Set([...explicit,...inferred])].sort();
}
function Page({title,subtitle,action,children}){return <section className="page"><div className="pagehead"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>}
function Panel({title,action,children}){return <section className="panel"><div className="panelhead"><h2>{title}</h2>{action}</div>{children}</section>}
function RepoMini({r,open,pinned,pin}){return <div className="repomini"><button className="repoOpen" onClick={()=>open&&open(r)}><span className="repo-name">◉ {r.name}</span><span className="muted">{r.description||"No description"}</span><span className="muted">{r.language||"Code"} · ☆ {r.stars||0}</span></button><button onClick={pin}>{pinned?"★":"☆"}</button></div>}
function RepoCard({r,open,pinned,pin}){return <div className="repocard"><div className="repoCardTop"><button onClick={()=>open(r)}><h3>{(r.owner||"user")+"/"+r.name}</h3></button><button onClick={pin}>{pinned?"★ Pinned":"☆ Pin"}</button></div><p>{r.description||"No description provided."}</p><span className="muted">{r.visibility} · {r.language||"Code"} · ☆ {r.stars||0} · Forks {r.forks||0}</span><div className="repoMeta"><span>📄 README</span><span>⚖ {r.license||"No license"}</span><span>▣ Packages</span></div></div>}
function Activity({text}){return <div className="activity"><span>●</span><span>{text}</span></div>}

export default App;

function RepoMeta({repo,tree}){const counts={};(tree||[]).forEach(x=>{const ext=x.path.split(".").pop().toLowerCase();const map={js:"JavaScript",jsx:"JavaScript",ts:"TypeScript",tsx:"TypeScript",html:"HTML",css:"CSS",rsx:"Xreoct",rs:"Xreoct",py:"Python",java:"Java",json:"JSON",md:"Markdown"};const n=map[ext]||"Other";counts[n]=(counts[n]||0)+1});const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;return <div className="repoMetaPanel"><b>Repository overview</b><div className="langbar">{Object.entries(counts).map(([k,v])=><span key={k} style={{width:(v/total*100)+"%"}} title={k+" "+v}/>)}</div><div className="langlist">{Object.entries(counts).map(([k,v])=><span key={k}>● {k} {Math.round(v/total*100)}%</span>)}</div><div className="repoFiles"><span>📄 README.md</span><span>⚖ LICENSE</span><span>▣ Packages</span><span>⑂ Branches</span></div></div>}
function AIChat({messages,input,setInput,onSubmit,close}){return <div className="aiOverlay"><section className="aiChat"><header><div><b>✦ GutHeb AI</b><small>Free workspace assistant</small></div><button onClick={close}>×</button></header><div className="aiMessages">{!messages.length&&<div className="aiWelcome"><strong>What are you building?</strong><p>Ask for repository structure, README drafts, issues, PR ideas, code help, licenses, packages, or project plans.</p></div>}{messages.map((m,i)=><div className={m.role==="user"?"aiUser":"aiBot"} key={i}>{m.text}</div>)}</div><form onSubmit={onSubmit}><input autoFocus value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask GutHeb AI…"/><button className="primary">Send</button></form></section></div>}
