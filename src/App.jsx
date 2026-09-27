import React, { useEffect, useMemo, useState } from "react";

const OWNER = "alexiusandromedavsgalaxia-lgtm";
const API = "https://api.github.com";

const seedRepos = [];

const seedIssues = [
  { id:1, title:"Welcome to GutHeb", state:"open", labels:["welcome"], author:"system" },
  { id:2, title:"Add repository discussions", state:"open", labels:["enhancement"], author:"system" }
];

const seedPRs = [
  { id:1, title:"Initial platform build", state:"open", author:"system", branch:"main" }
];

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
  const [profile,setProfile]=useState(()=>JSON.parse(localStorage.getItem("gutheb-profile")||"null")||{bio:"",location:"",website:"",avatar:""});
  const [settings,setSettings]=useState({theme:"dark",email:true,notifications:true});
  const [pinned,setPinned]=useState(()=>JSON.parse(localStorage.getItem("gutheb-pinned")||"[]"));
  const [aiOpen,setAiOpen]=useState(false); const [aiInput,setAiInput]=useState(""); const [aiMessages,setAiMessages]=useState([]);
  const [packages,setPackages]=useState(()=>JSON.parse(localStorage.getItem("gutheb-packages")||"[]"));

  useEffect(()=>{
    const onHash=()=>setPage(location.hash.replace("#/","")||"home");
    addEventListener("hashchange",onHash); return()=>removeEventListener("hashchange",onHash);
  },[]);

  function go(p){ location.hash="/"+p; setPage(p); setNotice(""); }
  function flash(msg){setNotice(msg);setTimeout(()=>setNotice(""),2500);}
  useEffect(()=>localStorage.setItem("gutheb-repos-v2",JSON.stringify(repos)),[repos]);
  useEffect(()=>localStorage.setItem("gutheb-pinned",JSON.stringify(pinned)),[pinned]);
  useEffect(()=>localStorage.setItem("gutheb-packages",JSON.stringify(packages)),[packages]);
  function togglePin(name){setPinned(x=>x.includes(name)?x.filter(v=>v!==name):[...x,name]);flash(pinned.includes(name)?"Repository unpinned":"Repository pinned");}
  function askAI(e){e.preventDefault();if(!aiInput.trim())return;const q=aiInput.trim();const answer=aiAnswer(q);setAiMessages(x=>[...x,{role:"user",text:q},{role:"ai",text:answer}]);setAiInput("");}
  function aiAnswer(q){const l=q.toLowerCase();if(l.includes("crear")&&l.includes("repo"))return "Puedo preparar un nuevo repositorio desde el panel de creación. Para seguridad, las escrituras reales necesitan un backend autenticado conectado a GutHeb.";if(l.includes("readme"))return "Puedo generar la estructura y el contenido de un README, además de sugerir licencia, topics y estructura de carpetas.";if(l.includes("licencia"))return "Puedo ayudarte a elegir y generar archivos de licencia conocidos, pero la aplicación debe guardar el archivo mediante su backend.";if(l.includes("paquete")||l.includes("package"))return "Puedo analizar package.json y mostrar dependencias y versiones cuando el repositorio las exponga.";return "Soy GutHeb AI. Puedo ayudarte a diseñar repositorios, README, issues, PRs, estructura de proyectos, código y automatizaciones. Para acciones reales sobre Git, necesito una API/backend con autenticación segura.";}
  function login(e){
    e.preventDefault();
    const name=authForm.name||authForm.email.split("@")[0]||"user";
    const u={name,email:authForm.email||name+"@gutheb.local"};
    setUser(u); localStorage.setItem("gutheb-user",JSON.stringify(u)); go("home");
  }
  function logout(){setUser(null);localStorage.removeItem("gutheb-user");go("home");}
  function register(e){e.preventDefault();login(e);}
  function createRepo(e){
    e.preventDefault();
    if(!newRepo.name.trim()) return flash("Repository name is required");
    const r={name:newRepo.name.trim(),visibility:newRepo.visibility,language:"",stars:0,forks:0,updated:"just now",description:newRepo.description,license:"MIT",readme:true,packages:[]};
    setRepos(x=>[r,...x]); setNewRepo({name:"",description:"",visibility:"Public"}); flash("Repository created"); go("repos");
  }
  async function openRepo(r){
    setSelectedRepo(r); setRepoTab("code"); setFile(null); setTree([]);
    go("repo/"+r.name);
    try{
      const res=await fetch(API+"/repos/"+OWNER+"/"+r.name+"/git/trees/main?recursive=1");
      if(res.ok){const data=await res.json();setTree((data.tree||[]).filter(x=>x.type==="blob"||x.type==="tree"));}
    }catch{}
  }
  async function openFile(path){
    if(!selectedRepo)return;
    try{
      const res=await fetch(API+"/repos/"+OWNER+"/"+selectedRepo.name+"/contents/"+path+"?ref=main");
      if(!res.ok) throw new Error();
      const data=await res.json();
      const raw=atob((data.content||"").replaceAll("\\n",""));
      const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
      setFile({path,content:new TextDecoder().decode(bytes)});
    }catch{flash("Unable to load this file");}
  }
  function createIssue(e){
    e.preventDefault();
    if(!issueTitle.trim())return;
    setIssues(x=>[{id:Date.now(),title:issueTitle,state:"open",labels:["created"],author:user?.name||"you"},...x]);
    setIssueTitle("");setIssueBody("");flash("Issue created");
  }
  function saveProfile(e){
    e.preventDefault();localStorage.setItem("gutheb-profile",JSON.stringify(profile));flash("Profile saved");
  }
  const filteredRepos=useMemo(()=>repos.filter(r=>(r.name+" "+r.description).toLowerCase().includes(query.toLowerCase())),[repos,query]);

  if(!user) return <Auth auth={auth} setAuth={setAuth} form={authForm} setForm={setAuthForm} onLogin={login} onRegister={register}/>;

  const routeRepo=page.startsWith("repo/")?page.slice(5):null;
  if(routeRepo && !selectedRepo){const r=repos.find(x=>x.name===routeRepo);if(r){setTimeout(()=>openRepo(r),0);}}

  return <div className="gh">
    <header className="top">
      <button className="logo" onClick={()=>go("home")} aria-label="GutHeb home"><img src="/gutheb-logo.svg" alt="" /></button>
      <div className="wordmark" onClick={()=>go("home")}>GutHeb</div>
      <div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search or jump to..." /><kbd>/</kbd></div>
      <nav className="topnav">
        <button onClick={()=>go("issues")}>Issues</button><button onClick={()=>go("pulls")}>Pull requests</button><button onClick={()=>go("marketplace")}>Marketplace</button><button onClick={()=>go("explore")}>Explore</button>
      </nav>
      <div className="topuser"><button onClick={()=>go("notifications")}>♡</button><button onClick={()=>go("profile")}>{user.name}⌄</button></div>
    </header>

    <div className="appbody">
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
        {repos.slice(0,8).map(r=><button className="repo-nav" key={r.name} onClick={()=>openRepo(r)}><span className="dot"/> {r.name}</button>)}
        <button className="repo-nav" onClick={()=>go("repos")}>View all repositories →</button>
        <div className="navbottom">
          <Nav icon="⚙" text="Settings" page="settings" go={go}/>
          <button className="repo-nav" onClick={logout}>↪ Sign out</button>
        </div>
      </aside>

      <main className="main">
        {notice&&<div className="notice">{notice}</div>}
        {page==="home"&&<Home user={user} repos={filteredRepos} openRepo={openRepo} go={go} pinned={pinned} togglePin={togglePin}/>}
        {page==="repos"&&<Repos repos={filteredRepos} openRepo={openRepo} go={go} pinned={pinned} togglePin={togglePin}/>}
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
        {page==="profile"&&<Profile user={user} profile={profile} setProfile={setProfile} save={saveProfile} repos={repos} pinned={pinned} togglePin={togglePin}/>}
        {page==="settings"&&<Settings settings={settings} setSettings={setSettings} user={user}/>}
        {routeRepo&&selectedRepo&&<Repo repo={selectedRepo} tab={repoTab} setTab={setRepoTab} tree={tree} file={file} openFile={openFile} go={go} packages={packages}/>}
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

function NewRepo({form,setForm,onSubmit}){return <Page title="Create a new repository" subtitle="A repository contains all of your project's files, history, and collaboration tools."><form className="panel form" onSubmit={onSubmit}><label>Owner<input value="alexiusandromedavsgalaxia-lgtm" disabled/></label><label>Repository name<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="my-project"/></label><label>Description <span className="muted">(optional)</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Visibility<select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value})}><option>Public</option><option>Private</option></select></label><button className="primary" type="submit">Create repository</button></form></Page>}

function Issues({issues,title,setTitle,body,setBody,onSubmit}){return <Page title="Issues" subtitle="Plan, discuss, and track work."><form className="panel issueform" onSubmit={onSubmit}><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Issue title"/><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Leave a description..."/><button className="primary">New issue</button></form><Panel title={issues.length+" issues"}>{issues.map(i=><div className="issue" key={i.id}><span className="open">●</span><div><strong>{i.title}</strong><small>#{i.id} opened by {i.author}</small><div>{i.labels.map(l=><span className="label" key={l}>{l}</span>)}</div></div></div>)}</Panel></Page>}

function Pulls({prs,setPRs,user}){return <Page title="Pull requests" subtitle="Review code changes before they land."><Panel title={prs.length+" open pull requests"} action={<button onClick={()=>setPRs(x=>[{id:Date.now(),title:"New pull request",state:"open",author:user.name,branch:"feature/new"},...x])}>New pull request</button>}>{prs.map(p=><div className="issue" key={p.id}><span className="open">↗</span><div><strong>{p.title}</strong><small>#{p.id} · {p.branch} · opened by {p.author}</small></div></div>)}</Panel></Page>}

function Actions(){return <Page title="Actions" subtitle="Automate your builds, tests, and deployments."><div className="grid2"><Panel title="Workflows"><div className="workflow"><b>Build</b><span className="green">✓</span><small>Ready to run</small></div><div className="workflow"><b>Test</b><span className="gray">○</span><small>Waiting for workflow file</small></div></Panel><Panel title="Workflow runs"><Activity text="No workflow runs yet"/><button className="primary">New workflow</button></Panel></div></Page>}

function Projects(){return <Page title="Projects" subtitle="Track work with tables, boards, and roadmaps."><div className="board"><div>Todo</div><div>In progress</div><div>Done</div><article>Plan next release</article><article>Build issue workflow</article><article>Ship first version</article></div></Page>}
function Discussions(){return <Page title="Discussions" subtitle="Community conversations and long-form collaboration."><Panel title="Recent discussions"><Activity text="Welcome to the community"/><Activity text="Share what you are building"/><Activity text="Feature ideas"/></Panel></Page>}
function Codespaces(){return <Page title="Codespaces" subtitle="Cloud development environments for your repositories."><Panel title="Your codespaces"><div className="empty">No codespaces yet.<br/><button className="primary">Create a codespace</button></div></Panel></Page>}
function Marketplace(){return <Page title="Marketplace" subtitle="Apps, actions, and developer tools."><div className="marketgrid">{["CI/CD","Code quality","Project management","Security","Deployment","AI tools"].map(x=><div className="market" key={x}><b>{x}</b><p>Explore integrations for {x.toLowerCase()}.</p><button>Explore</button></div>)}</div></Page>}
function Explore(){return <Page title="Explore" subtitle="Discover projects, topics, and developers."><div className="grid2"><Panel title="Trending"><RepoMini r={{name:"awesome-project",description:"A trending open-source project",language:"JavaScript"}}/></Panel><Panel title="Topics"><div className="topics">{["javascript","react","cloud","ai","games","web"].map(x=><span key={x}>#{x}</span>)}</div></Panel></div></Page>}
function Notifications(){return <Page title="Notifications"><Panel title="Inbox"><div className="empty">You're all caught up. 🎉</div></Panel></Page>}
function Profile({user,profile,setProfile,save,repos,pinned,togglePin}){return <Page title={user.name} subtitle={user.email}><div className="profileHero"><div className="avatar">{profile.avatar?<img src={profile.avatar} alt="Profile"/>:<span>{user.name.slice(0,1).toUpperCase()}</span>}</div><div><h2>{user.name}</h2><p>{profile.bio||"Add a short bio to your profile."}</p></div></div><form className="panel form" onSubmit={save}><label>Profile photo<input type="file" accept="image/*" onChange={avatarFile}/></label><label>Bio<textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label><label>Location<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})}/></label><label>Website<input value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})}/></label><button className="primary">Save profile</button></form><Panel title="Repositories">{repos.map(r=><RepoMini r={r} key={r.name} pinned={pinned.includes(r.name)} pin={()=>togglePin(r.name)}/>)}</Panel></Page>}
function Settings({settings,setSettings,user}){return <Page title="Settings" subtitle="Manage your GutHeb account and preferences."><Panel title="Account"><div className="setting"><span><b>Username</b><small>{user.name}</small></span><button>Change</button></div><div className="setting"><span><b>Email</b><small>{user.email}</small></span><button>Manage</button></div></Panel><Panel title="Preferences"><div className="setting"><span><b>Theme</b><small>Dark developer theme</small></span><select value={settings.theme} onChange={e=>setSettings({...settings,theme:e.target.value})}><option>dark</option><option>light</option></select></div><div className="setting"><span><b>Email notifications</b><small>Receive product updates</small></span><input type="checkbox" checked={settings.email} onChange={e=>setSettings({...settings,email:e.target.checked})}/></div></Panel><Panel title="Danger zone"><button className="danger">Delete account</button></Panel></Page>}

function Repo({repo,tab,setTab,tree,file,openFile,go,packages}){return <Page title={repo.name} subtitle={repo.description} action={<div><button>☆ Star</button> <button>Fork</button></div>}><div className="repoTabs">{["code","issues","pulls","actions","projects","security","packages","insights"].map(x=><button className={tab===x?"sel":""} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>{tab==="code"&&<div className="repoCode"><div className="filetree">{tree.length?tree.map(x=><button key={x.path} onClick={()=>x.type==="blob"&&openFile(x.path)}>{x.type==="tree"?"📁":"📄"} {x.path}</button>):<p className="muted">Repository tree loads from the public GitHub API when available.</p>}</div>{file?<pre className="fileview"><code>{file.content}</code></pre>:<div className="empty">Select a file to view its source.</div>}</div>}{tab==="packages"&&<Panel title="Packages"><div className="empty">{packages.length?packages.join(", "):"No packages published yet."}</div></Panel>}{tab!=="code"&&tab!=="packages"&&<Panel title={tab==="issues"?"Issues":tab==="pulls"?"Pull requests":tab}><div className="empty">This {tab} workspace is ready for repository-specific data.</div></Panel>}{tab==="code"&&<RepoMeta repo={repo} tree={tree}/>}</Page>}

function Page({title,subtitle,action,children}){return <section className="page"><div className="pagehead"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>}
function Panel({title,action,children}){return <section className="panel"><div className="panelhead"><h2>{title}</h2>{action}</div>{children}</section>}
function RepoMini({r,open,pinned,pin}){return <div className="repomini"><button className="repoOpen" onClick={()=>open&&open(r)}><span className="repo-name">◉ {r.name}</span><span className="muted">{r.description||"No description"}</span><span className="muted">{r.language||"Code"} · ☆ {r.stars||0}</span></button><button onClick={pin}>{pinned?"★":"☆"}</button></div>}
function RepoCard({r,open,pinned,pin}){return <div className="repocard"><div className="repoCardTop"><button onClick={()=>open(r)}><h3>{r.name}</h3></button><button onClick={pin}>{pinned?"★ Pinned":"☆ Pin"}</button></div><p>{r.description||"No description provided."}</p><span className="muted">{r.visibility} · {r.language||"Code"} · ☆ {r.stars||0} · Forks {r.forks||0}</span><div className="repoMeta"><span>📄 README</span><span>⚖ {r.license||"No license"}</span><span>▣ Packages</span></div></div>}
function Activity({text}){return <div className="activity"><span>●</span><span>{text}</span></div>}

export default App;

function RepoMeta({repo,tree}){const counts={};(tree||[]).forEach(x=>{const ext=x.path.split(".").pop().toLowerCase();const map={js:"JavaScript",jsx:"JavaScript",ts:"TypeScript",tsx:"TypeScript",html:"HTML",css:"CSS",rsx:"Xreoct",rs:"Xreoct",py:"Python",java:"Java",json:"JSON",md:"Markdown"};const n=map[ext]||"Other";counts[n]=(counts[n]||0)+1});const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;return <div className="repoMetaPanel"><b>Repository overview</b><div className="langbar">{Object.entries(counts).map(([k,v])=><span key={k} style={{width:(v/total*100)+"%"}} title={k+" "+v}/>)}</div><div className="langlist">{Object.entries(counts).map(([k,v])=><span key={k}>● {k} {Math.round(v/total*100)}%</span>)}</div><div className="repoFiles"><span>📄 README.md</span><span>⚖ LICENSE</span><span>▣ Packages</span><span>⑂ Branches</span></div></div>}
function AIChat({messages,input,setInput,onSubmit,close}){return <div className="aiOverlay"><section className="aiChat"><header><div><b>✦ GutHeb AI</b><small>Free workspace assistant</small></div><button onClick={close}>×</button></header><div className="aiMessages">{!messages.length&&<div className="aiWelcome"><strong>What are you building?</strong><p>Ask for repository structure, README drafts, issues, PR ideas, code help, licenses, packages, or project plans.</p></div>}{messages.map((m,i)=><div className={m.role==="user"?"aiUser":"aiBot"} key={i}>{m.text}</div>)}</div><form onSubmit={onSubmit}><input autoFocus value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask GutHeb AI…"/><button className="primary">Send</button></form></section></div>}
