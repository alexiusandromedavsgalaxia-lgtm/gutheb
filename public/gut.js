// GutHeb GUT/1 browser client.
// Usage: await gut("gut clone -my-repo")
async function gut(command,options={}){
  const body={command,...options};
  const r=await fetch("/api/gut",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const text=await r.text();
  let data;try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!r.ok)throw new Error(data.error||"GUT request failed");
  return data;
}
if(typeof window!=="undefined")window.gut=gut;
export default gut;
