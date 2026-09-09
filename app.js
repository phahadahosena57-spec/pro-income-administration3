
const db = window.supabase.createClient(PIA_SUPABASE_URL, PIA_SUPABASE_KEY);

let currentUser = null;
let currentSection = 'dashboard';
let rowsCache = {};

const sectionConfig = {
  admins:   { table:'admins', label:'Admin' },
  users:    { table:'users', label:'User' },
  channels: { table:'channels', label:'Channel' },
  videos:   { table:'videos', label:'Video' },
  notices:  { table:'notices', label:'Notice' }
};

const $ = id => document.getElementById(id);

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function pretty(k){
  return String(k).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
}

function notify(msg, ok=false){
  const el = $('toast');
  if(!el) return alert(msg);
  el.textContent = msg;
  el.className = 'toast ' + (ok ? 'ok' : 'bad');
  setTimeout(()=>el.className='toast hidden', 3000);
}

async function boot(){
  const {data:{session}} = await db.auth.getSession();
  if(!session) return location.href='./login.html';
  currentUser = session.user;

  const {data:admin, error} = await db.from('admins')
    .select('*').eq('user_id', currentUser.id).maybeSingle();

  if(error || !admin){
    // Compatibility with an older admins table that used id instead of user_id.
    const fallback = await db.from('admins').select('*').eq('id', currentUser.id).maybeSingle();
    if(fallback.data) {
      currentUser.adminRow = fallback.data;
    } else {
      await db.auth.signOut();
      return location.href='./login.html';
    }
  } else {
    currentUser.adminRow = admin;
  }

  const a = currentUser.adminRow || {};
  $('who').textContent = (a.name || currentUser.email || 'Admin') +
    (a.role ? ' • '+a.role : '');

  document.querySelectorAll('[data-s]').forEach(b=>{
    b.addEventListener('click',()=>show(b.dataset.s));
  });
  $('logout').onclick = async()=>{ await db.auth.signOut(); location.href='./login.html'; };
  $('refresh').onclick = ()=>load(currentSection);
  $('close').onclick = ()=>closeModal();
  $('modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });

  // Add a toast container if not present.
  if(!$('toast')){
    const t=document.createElement('div');
    t.id='toast'; t.className='toast hidden'; document.body.appendChild(t);
  }
  show('dashboard');
}

function show(s){
  currentSection=s;
  document.querySelectorAll('.main>div').forEach(x=>x.classList.add('hidden'));
  const target=$(s);
  if(target) target.classList.remove('hidden');
  document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('active',b.dataset.s===s));
  $('title').textContent=s==='settings'?'Website Settings':s==='media'?'Media Upload':pretty(s);
  load(s);
}

async function load(s){
  if(s==='dashboard') return dashboardLoad();
  if(s==='settings') return settingsLoad();
  if(s==='media') return mediaLoad();
  const cfg=sectionConfig[s];
  if(!cfg) return;

  const {data,error}=await db.from(cfg.table).select('*').order('created_at',{ascending:false});
  const el=$(s);
  if(error){
    el.innerHTML=`<div class="panel"><b>Database error</b><p>${esc(error.message)}</p></div>`;
    return;
  }
  rowsCache[s]=data||[];
  renderTable(s, rowsCache[s]);
}

function renderTable(s, data){
  const cfg=sectionConfig[s], el=$(s);
  const columns=chooseColumns(s,data);
  let html=`<div class="panel">
    <div class="toolbar">
      <input id="${s}_search" placeholder="Search ${cfg.label}s...">
      <button onclick="openForm('${s}')">+ Add ${cfg.label}</button>
    </div>
    <div class="tablewrap"><table class="table"><thead><tr>`;
  columns.forEach(k=>html+=`<th>${esc(pretty(k))}</th>`);
  html+=`<th>Actions</th></tr></thead><tbody id="${s}_body">`;
  data.forEach((r,i)=>{
    html+='<tr data-index="'+i+'">';
    columns.forEach(k=>html+=`<td>${esc(formatCell(r[k]))}</td>`);
    html+=`<td><div class="actions">
      <button class="small secondary" onclick="openForm('${s}',${i})">Edit</button>
      <button class="small danger" onclick="removeRow('${s}',${i})">Delete</button>
    </div></td></tr>`;
  });
  if(!data.length) html+=`<tr><td colspan="${columns.length+1}">No records yet.</td></tr>`;
  html+=`</tbody></table></div></div>`;
  el.innerHTML=html;

  const search=$(s+'_search');
  search.oninput=()=>{
    const q=search.value.toLowerCase();
    document.querySelectorAll('#'+s+'_body tr').forEach(tr=>{
      tr.style.display=tr.innerText.toLowerCase().includes(q)?'':'none';
    });
  };
}

function chooseColumns(s,data){
  const preferred={
    admins:['user_id','name','email','role','status','created_at'],
    users:['id','name','email','phone','username','profile_image','profile_photo_url','status','created_at'],
    channels:['id','name','description','logo_url','status','created_at'],
    videos:['id','title','description','thumbnail_url','video_url','category','status','created_at'],
    notices:['id','title','content','status','created_at']
  }[s] || [];
  const sample=data[0]||{};
  const found=preferred.filter(k=>Object.prototype.hasOwnProperty.call(sample,k));
  if(found.length) return found.slice(0,6);
  return Object.keys(sample).filter(k=>!['updated_at'].includes(k)).slice(0,6);
}

function formatCell(v){
  if(v===null||v===undefined) return '';
  if(typeof v==='object') return JSON.stringify(v);
  return String(v).slice(0,100);
}

function fieldsFor(s,row={}){
  const sample=(rowsCache[s]&&rowsCache[s][0])||row||{};
  const defaults={
    admins:['user_id','name','email','role','status'],
    users:['name','email','phone','username','profile_image','profile_photo_url','status'],
    channels:['name','description','logo_url','status'],
    videos:['title','description','thumbnail_url','video_url','category','status'],
    notices:['title','content','status']
  }[s];
  const available=Object.keys(sample);
  let fields=available.length ? available.filter(k=>!['id','created_at','updated_at'].includes(k)) : defaults;
  if(s==='admins' && !fields.includes('user_id')) fields.unshift('user_id');
  if(!fields.length) fields=defaults;
  return [...new Set(fields)].slice(0,10);
}

function inputFor(k,v){
  const val=esc(v??'');
  if(k==='status' || k==='role'){
    const opts=k==='role'?['super_admin','admin','editor']:['active','inactive','blocked','published','draft','hidden'];
    return `<select id="f_${esc(k)}">${opts.map(o=>`<option ${String(v??'')===o?'selected':''}>${o}</option>`).join('')}</select>`;
  }
  if(/description|content/i.test(k)) return `<textarea id="f_${esc(k)}">${val}</textarea>`;
  let type='text';
  if(k==='email') type='email';
  if(/url|link/i.test(k)) type='url';
  return `<input id="f_${esc(k)}" type="${type}" value="${val}">`;
}

window.openForm=function(s,index){
  const cfg=sectionConfig[s], row=(typeof index==='number'?rowsCache[s][index]:{})||{};
  const editing=typeof index==='number';
  const fields=fieldsFor(s,row);
  $('modalTitle').textContent=(editing?'Edit ':'Add ')+cfg.label;
  $('form').innerHTML=fields.map(k=>`<label>${esc(pretty(k))}${inputFor(k,row[k])}</label>`).join('')+
    `<button type="submit">Save ${esc(cfg.label)}</button><div id="fm"></div>`;
  $('form').onsubmit=async e=>{
    e.preventDefault();
    const payload={};
    fields.forEach(k=>{
      const el=$('f_'+k); if(el) payload[k]=el.value.trim();
    });

    // Never try to overwrite generated primary keys.
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    if(s==='admins' && !editing && !payload.user_id){
      $('fm').textContent='User ID is required.';
      return;
    }

    let result;
    if(editing){
      const key = row.id!==undefined ? 'id' : 'user_id';
      result=await db.from(cfg.table).update(payload).eq(key,row[key]);
    }else{
      result=await db.from(cfg.table).insert(payload);
    }
    if(result.error){
      $('fm').textContent=result.error.message;
    }else{
      closeModal(); notify(cfg.label+' saved successfully.',true); load(s);
    }
  };
  $('modal').classList.remove('hidden');
};

window.removeRow=async function(s,index){
  const cfg=sectionConfig[s], row=rowsCache[s][index];
  if(!row) return;
  const key=row.id!==undefined?'id':'user_id';
  if(!confirm('Delete this '+cfg.label.toLowerCase()+'?')) return;
  const {error}=await db.from(cfg.table).delete().eq(key,row[key]);
  if(error) notify(error.message); else { notify('Deleted successfully.',true); load(s); }
};

function closeModal(){ $('modal').classList.add('hidden'); }

async function dashboardLoad(){
  const names=Object.keys(sectionConfig);
  const results=await Promise.all(names.map(n=>db.from(sectionConfig[n].table).select('*',{count:'exact',head:true})));
  $('dashboard').innerHTML=`<div class="cards">${
    names.map((n,i)=>`<div class="card"><div>${pretty(n)}</div><div class="num">${results[i].error?'—':(results[i].count||0)}</div></div>`).join('')
  }</div>
  <div class="panel" style="margin-top:14px">
    <h2>System Status</h2>
    <p>Authentication: Active</p>
    <p>Database: Connected</p>
    <p>Admin access: Verified</p>
    <p>Storage: pia-media</p>
  </div>`;
}

async function settingsLoad(){
  const {data,error}=await db.from('site_settings').select('*').limit(1).maybeSingle();
  if(error){ $('settings').innerHTML=`<div class="panel">${esc(error.message)}</div>`; return; }
  if(!data){ $('settings').innerHTML='<div class="panel">No settings record found.</div>'; return; }

  const keys=Object.keys(data).filter(k=>!['id','user_id','created_at','updated_at'].includes(k));
  $('settings').innerHTML=`<div class="panel"><div class="formgrid">
    ${keys.map(k=>`<label>${esc(pretty(k))}<input id="s_${esc(k)}" value="${esc(data[k]??'')}"></label>`).join('')}
    <button id="saveSettings">Save Settings</button><div id="sm"></div>
  </div></div>`;
  $('saveSettings').onclick=async()=>{
    const payload={};
    keys.forEach(k=>payload[k]=$('s_'+k).value.trim());
    if(Object.prototype.hasOwnProperty.call(data,'updated_at')) payload.updated_at=new Date().toISOString();
    const {error}=await db.from('site_settings').update(payload).eq('id',data.id);
    $('sm').textContent=error?error.message:'Settings saved successfully.';
    if(!error) notify('Website settings saved.',true);
  };
}

function mediaLoad(){
  $('media').innerHTML=`<div class="panel">
    <h2>Media Upload</h2>
    <p>Upload an image, thumbnail or video to Supabase Storage.</p>
    <input id="file" type="file" accept="image/*,video/*">
    <button id="up">Upload</button>
    <div id="mm"></div>
  </div>`;
  $('up').onclick=async()=>{
    const f=$('file').files[0];
    if(!f) return $('mm').textContent='Choose a file first.';
    $('mm').textContent='Uploading...';
    const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=currentUser.id+'/'+Date.now()+'-'+safe;
    const {error}=await db.storage.from('pia-media').upload(path,f,{upsert:false});
    if(error){ $('mm').textContent=error.message; return; }
    const {data}=db.storage.from('pia-media').getPublicUrl(path);
    $('mm').innerHTML=`Upload complete: <a target="_blank" rel="noopener" href="${esc(data.publicUrl)}">Open file</a>`;
    notify('File uploaded successfully.',true);
  };
}

boot();
