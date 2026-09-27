// GutHeb YUML: a deliberately small, strict workflow language.
// This is NOT YAML. It is parsed into a GutHeb-native action plan.
export function parseYUML(source=""){
  const text=String(source).replace(/\r/g,"");\n  const custom=/^\\s*\\{[\\s\\S]*?actionName\\s*=\\s*"([^"]+)"[\\s\\S]*?['"]build['"]\\s*=\\s*true[\\s\\S]*?['"]branch['"]\\s*=\\s*['"]([^'"]+)['"][\\s\\S]*?['"]file['"]\\s*=\\s*['"]([^'"]+)['"][\\s\\S]*\\}\\s*$/;
  const customMatch=String(source).replace(/\\r/g,"").match(custom);
  if(customMatch){
    return {kind:"action",name:customMatch[1],trigger:{type:"manual"},runner:"linux",env:{},matrix:null,
      steps:[{type:"build",command:"gutheb build --iso",output:customMatch[3],branch:customMatch[2],file:customMatch[3]}]};
  }
  const tokens=text.match(/"[^"\\]*(?:\\.[^"\\]*)*"|[A-Za-z_][A-Za-z0-9_.-]*|\{|\}|=|\[|\]/g)||[];
  let i=0;
  const out={kind:"action",name:"Untitled action",trigger:{type:"manual"},runner:"linux",env:{},steps:[],matrix:null};
  const value=()=>{const t=tokens[i++];if(!t)throw new Error("YUML: expected value");if(t[0]==='"')return JSON.parse(t);return t};
  const expect=(x)=>{if(tokens[i++]!==x)throw new Error("YUML: expected "+x)};
  const block=()=>{expect("{");};
  while(i<tokens.length){
    const t=tokens[i++];
    if(t==="action"){out.name=value();block();parseBlock();break;}
    throw new Error("YUML: expected action");
  }
  function parseBlock(){
    while(i<tokens.length&&tokens[i]!=="}"){
      const k=tokens[i++];
      if(k==="trigger"){out.trigger={type:value(),branch:null};if(tokens[i]==="branch"){i++;out.trigger.branch=value();}}
      else if(k==="runner"){out.runner=value();}
      else if(k==="env"){block();while(tokens[i]!=="}"){const key=value();expect("=");out.env[key]=value();}expect("}");}
      else if(k==="matrix"){block();const m={};while(tokens[i]!=="}"){const key=value();expect("=");expect("[");const vals=[];while(tokens[i]!=="]")vals.push(value());expect("]");m[key]=vals;}expect("}");out.matrix=m;}
      else if(k==="steps"){block();parseSteps();}
      else throw new Error("YUML: unknown action property '"+k+"'");
    }
    expect("}");
  }
  function parseSteps(){
    while(i<tokens.length&&tokens[i]!=="}"){
      const k=tokens[i++];
      if(k==="checkout")out.steps.push({type:"checkout"});
      else if(k==="install")out.steps.push({type:"install",packageManager:value()});
      else if(k==="run")out.steps.push({type:"run",command:value()});
      else if(k==="artifact"){const name=value();if(tokens[i]==="from")i++;out.steps.push({type:"artifact",name,path:value()});}
      else if(k==="build"){block();const s={type:"build"};while(tokens[i]!=="}"){const p=tokens[i++];if(p==="command")s.command=value();else if(p==="output")s.output=value();else throw new Error("YUML: unknown build property '"+p+"'");}expect("}");out.steps.push(s);}
      else if(k==="deploy"){const target=value();out.steps.push({type:"deploy",target});}
      else if(k==="if"){const condition=value();block();const nested=[];while(tokens[i]!=="}"){const n=tokens[i++];if(n==="deploy")nested.push({type:"deploy",target:value()});else if(n==="run")nested.push({type:"run",command:value()});else throw new Error("YUML: unsupported conditional step '"+n+"'");}expect("}");out.steps.push({type:"if",condition,steps:nested});}
      else throw new Error("YUML: unknown step '"+k+"'");
    }
    expect("}");
  }
  if(!out.steps.length)throw new Error("YUML: action needs at least one step");
  return out;
}
export const DEFAULT_YUML=`action "GutHeb Build" {
  trigger push branch "main"
  runner linux
  steps {
    checkout
    install "npm"
    run "npm install"
    run "npm run build"
    artifact "dist" from "./dist"
  }
}`;
