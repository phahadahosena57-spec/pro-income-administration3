const db = window.supabase.createClient(PIA_SUPABASE_URL, PIA_SUPABASE_KEY);

const $ = id => document.getElementById(id);
let currentUser = null;
let currentSection = "dashboard";
const cache = {};

const sections = {
  admins:{table:"admins",label:"Admins",singular:"Admin"},
  users:{table:"users",label:"Users",singular:"User"},
  channels:{table:"channels",label:"Channels",singular:"Channel"},
  videos:{table:"videos",label:"Videos",singular:"Video"},
  notices:{table:"notices",label:"Notices",singular:"Notice"}
};

const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty = k => String(k).replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());

function toast(message, ok=true){
  let t=$("toast");
  if(!t){t=document.createElement("div");t.id="toast";document.body.appendChild(t);}
  t.textContent=message;t.className="toast "+(ok?"ok":"bad");
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.className="toast hidden",3200);
}
function setBusy(btn,busy,text){
  if(!btn)return;
  btn.disabled=busy;
  if(busy){btn.dataset.old=text||btn.textContent;btn.textContent="Please wait…";}
  else btn.textContent=btn.dataset.old||text||"Save";
}

async function boot(){
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError||!session){location.href="./login.html";return;}
  currentUser=session.user;
  const {data:admin,error}=await db.from("admins").select("*").eq("user_id",currentUser.id).maybeSingle();
  if(error||!admin){
    toast("Admin access could not be verified.",false);
    await db.auth.signOut();setTimeout(()=>location.href="./login.html",700);return;
  }
  currentUser.adminRow=admin;
  $("who").textContent=(admin.name||currentUser.email||"Admin")+(admin.role?" • "+admin.role:"");

  document.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.s)));
  $("logout").addEventListener("click",logout);
  $("refresh").addEventListener("click",()=>load(currentSection));
  $("close").addEventListener("click",closeModal);
  $("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal();});
  show("dashboard");
}
async function logout(){await db.auth.signOut();location.href="./login.html";}

function show(s){
  currentSection=s;
  document.querySelectorAll(".main > div").forEach(x=>x.classList.add("hidden"));
  const target=$(s);if(target)target.classList.remove("hidden");
  document.querySelectorAll("[data-s]").forEach(b=>b.classList.toggle("active",b.dataset.s===s));
  $("title").textContent=s==="settings"?"Website Settings":s==="media"?"Media Upload":s==="dashboard"?"Dashboard":sections[s]?.label||"Dashboard";
  load(s);
}
async function load(s){
  if(s==="dashboard")return dashboard();
  if(s==="settings")return settings();
  if(s==="media")return media();
  if(!sections[s])return;
  const el=$(s);el.innerHTML='<div class="panel loading">Loading…</div>';
  const {data,error}=await db.from(sections[s].table).select("*");
  if(error){el.innerHTML=`<div class="panel error"><h3>Could not load ${esc(sections[s].label)}</h3><p>${esc(error.message)}</p><button class="secondary" onclick="load('${s}')">Try again</button></div>`;return;}
  cache[s]=data||[];renderTable(s,cache[s]);
}
function preferred(s,row){
  const p={
    admins:["user_id","name","email","role","status","created_at"],
    users:["id","name","email","phone","username","status","created_at"],
    channels:["id","name","description","logo_url","status","created_at"],
    videos:["id","title","description","thumbnail_url","video_url","category","status","created_at"],
    notices:["id","title","content","status","created_at"]
  }[s]||[];
  const keys=Object.keys(row||{});
  const found=p.filter(k=>keys.includes(k));
  return (found.length?found:keys.filter(k=>!["updated_at"].includes(k))).slice(0,6);
}
function cell(v){
  if(v==null)return "—";
  if(typeof v==="object")v=JSON.stringify(v);
  return String(v).length>90?String(v).slice(0,87)+"…":String(v);
}
function renderTable(s,data){
  const c=sections[s],el=$(s),cols=preferred(s,data[0]||{});
  let h=`<div class="panel"><div class="toolbar"><div><h2>${c.label}</h2><p class="muted">${data.length} record${data.length===1?"":"s"}</p></div><div class="tools"><input id="${s}Search" placeholder="Search…"><button onclick="openForm('${s}')">+ Add ${c.singular}</button></div></div><div class="tablewrap"><table class="table"><thead><tr>`;
  cols.forEach(k=>h+=`<th>${esc(pretty(k))}</th>`);h+="<th>Actions</th></tr></thead><tbody id='"+s+"Body'>";
  data.forEach((r,i)=>{h+="<tr>";cols.forEach(k=>h+=`<td>${esc(cell(r[k]))}</td>`);h+=`<td><div class="actions"><button class="small secondary" onclick="openForm('${s}',${i})">Edit</button><button class="small danger" onclick="removeRow('${s}',${i})">Delete</button></div></td></tr>`;});
  if(!data.length)h+=`<tr><td colspan="${cols.length+1}" class="empty">No records yet.</td></tr>`;
  h+="</tbody></table></div></div>";el.innerHTML=h;
  const q=$(s+"Search");q.oninput=()=>{const term=q.value.toLowerCase();document.querySelectorAll("#"+s+"Body tr").forEach(r=>r.style.display=r.innerText.toLowerCase().includes(term)?"":"none");};
}
function fieldsFor(s,row){
  const keys=Object.keys(row||{});
  const defaults={
    admins:["user_id","name","email","role","status"],
    users:["name","email","phone","username","profile_image","status"],
    channels:["name","description","logo_url","status"],
    videos:["title","description","thumbnail_url","video_url","category","status"],
    notices:["title","content","status"]
  }[s];
  let f=keys.length?keys.filter(k=>!["id","created_at","updated_at"].includes(k)):defaults;
  if(s==="admins"&&!f.includes("user_id"))f.unshift("user_id");
  return [...new Set(f)].slice(0,10);
}
function inputHTML(k,v){
  const value=esc(v??"");
  if(k==="status"){const opts=["active","inactive","blocked","published","draft","hidden"];return `<select id="f_${esc(k)}"><option value="">— Select —</option>${opts.map(x=>`<option value="${x}" ${String(v??"")===x?"selected":""}>${x}</option>`).join("")}</select>`;}
  if(k==="role"){const opts=["super_admin","admin","editor"];return `<select id="f_${esc(k)}"><option value="">— Select —</option>${opts.map(x=>`<option value="${x}" ${String(v??"")===x?"selected":""}>${x}</option>`).join("")}</select>`;}
  if(/description|content/i.test(k))return `<textarea id="f_${esc(k)}">${value}</textarea>`;
  const type=k==="email"?"email":/url|link/i.test(k)?"url":"text";
  return `<input id="f_${esc(k)}" type="${type}" value="${value}">`;
}
window.openForm=function(s,index){
  const c=sections[s],editing=Number.isInteger(index),row=editing?(cache[s]||[])[index]||{}:{},fields=fieldsFor(s,row);
  $("modalTitle").textContent=(editing?"Edit ":"Add ")+c.singular;
  $("form").innerHTML=fields.map(k=>`<label>${esc(pretty(k))}${inputHTML(k,row[k])}</label>`).join("")+`<div class="formactions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button id="saveBtn" type="submit">Save</button></div><div id="fm" class="formmsg"></div>`;
  $("form").onsubmit=async e=>{
    e.preventDefault();const btn=$("saveBtn");setBusy(btn,true);
    const payload={};fields.forEach(k=>{const x=$("f_"+k);if(x)payload[k]=x.value.trim();});
    delete payload.id;delete payload.created_at;delete payload.updated_at;
    if(s==="admins"&&!editing&&!payload.user_id){$("fm").textContent="User ID is required.";setBusy(btn,false);return;}
    let result;
    if(editing){const key=row.id!==undefined?"id":"user_id";result=await db.from(c.table).update(payload).eq(key,row[key]);}
    else result=await db.from(c.table).insert(payload);
    setBusy(btn,false);
    if(result.error){$("fm").textContent=result.error.message;return;}
    closeModal();toast(c.singular+" saved successfully.");load(s);
  };
  $("modal").classList.remove("hidden");
};
window.removeRow=async function(s,index){
  const c=sections[s],row=(cache[s]||[])[index];if(!row)return;
  if(!confirm("Delete this "+c.singular.toLowerCase()+"?"))return;
  const key=row.id!==undefined?"id":"user_id";
  const {error}=await db.from(c.table).delete().eq(key,row[key]);
  if(error)toast(error.message,false);else{toast("Deleted successfully.");load(s);}
};
function closeModal(){$("modal").classList.add("hidden");$("form").reset();}
window.closeModal=closeModal;

async function dashboard(){
  const el=$("dashboard");el.innerHTML='<div class="panel loading">Loading dashboard…</div>';
  const names=Object.keys(sections);
  const results=await Promise.all(names.map(s=>db.from(sections[s].table).select("*",{count:"exact",head:true})));
  const cards=names.map((s,i)=>`<button class="statcard" onclick="show('${s}')"><span>${sections[s].label}</span><strong>${results[i].error?"—":results[i].count??0}</strong><small>Manage ${sections[s].label.toLowerCase()} →</small></button>`).join("");
  el.innerHTML=`<div class="hero"><div><span class="eyebrow">CONTROL CENTER</span><h2>Pro Income Administration</h2><p>Manage your platform from one secure dashboard.</p></div><button onclick="load('dashboard')">↻ Refresh</button></div><div class="cards">${cards}</div><div class="panel statuspanel"><h3>System Status</h3><div class="statusrow"><span>Authentication</span><b class="good">● Active</b></div><div class="statusrow"><span>Database</span><b class="good">● Connected</b></div><div class="statusrow"><span>Admin Access</span><b class="good">● Verified</b></div></div>`;
}
async function settings(){
  const el=$("settings");el.innerHTML='<div class="panel loading">Loading settings…</div>';
  const {data,error}=await db.from("site_settings").select("*").limit(1).maybeSingle();
  if(error){el.innerHTML=`<div class="panel error">${esc(error.message)}</div>`;return;}
  if(!data){el.innerHTML='<div class="panel"><h2>Website Settings</h2><p>No settings record found.</p></div>';return;}
  const keys=Object.keys(data).filter(k=>!["id","user_id","created_at","updated_at"].includes(k));
  el.innerHTML=`<div class="panel"><h2>Website Settings</h2><p class="muted">Update your public website configuration.</p><div class="settingsgrid">${keys.map(k=>`<label>${esc(pretty(k))}<input id="s_${esc(k)}" value="${esc(data[k]??"")}"></label>`).join("")}</div><div class="formactions"><button id="saveSettings">Save Settings</button></div><div id="sm" class="formmsg"></div></div>`;
  $("saveSettings").onclick=async()=>{const b=$("saveSettings");setBusy(b,true);const payload={};keys.forEach(k=>payload[k]=$("s_"+k).value.trim());if("updated_at"in data)payload.updated_at=new Date().toISOString();const r=await db.from("site_settings").update(payload).eq("id",data.id);setBusy(b,false);$("sm").textContent=r.error?r.error.message:"Settings saved successfully.";if(!r.error)toast("Website settings saved.");};
}
function media(){
  $("media").innerHTML=`<div class="panel"><h2>Media Upload</h2><p class="muted">Upload images, thumbnails or videos to the pia-media storage bucket.</p><div class="uploadbox"><input id="file" type="file" accept="image/*,video/*"><button id="up">Upload File</button></div><div id="mm" class="formmsg"></div></div>`;
  $("up").onclick=async()=>{const f=$("file").files[0];if(!f){$("mm").textContent="Choose a file first.";return;}const b=$("up");setBusy(b,true);$("mm").textContent="Uploading…";const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=currentUser.id+"/"+Date.now()+"-"+safe;const r=await db.storage.from("pia-media").upload(path,f,{upsert:false});if(r.error){$("mm").textContent=r.error.message;setBusy(b,false);return;}const {data}=db.storage.from("pia-media").getPublicUrl(path);setBusy(b,false);$("mm").innerHTML=`Upload complete. <a href="${esc(data.publicUrl)}" target="_blank" rel="noopener">Open file</a>`;toast("File uploaded successfully.");};
}
boot();
