#!/usr/bin/env node
const [, , ...argv]=process.argv;
const command=argv.join(" ").trim();
if(!command){
  console.error("GUT/1");
  console.error("usage: gut clone -<repo>");
  console.error("       gut pash -g clone archive <archive>");
  console.error("       gut pash -g create archive <archive> -& pash directory ./<carpet>");
  console.error("       gut delete -<repo|archivo|raw|codespace|action|carpeta> <target>");
  process.exit(1);
}
const base=process.env.GUTHEB_URL||"";
if(!base){console.error("Set GUTHEB_URL to your GutHeb URL.");process.exit(2);}
const token=process.env.GUTHEB_TOKEN||"";
const r=await fetch(base.replace(/\/$/,"")+"/api/gut",{method:"POST",headers:{"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{})},body:JSON.stringify({command})});
const text=await r.text();
if(!r.ok){console.error(text);process.exit(1);}
console.log(text);
