/* ===================== الإعدادات ===================== */
const CONFIG = {
  OWNER: 'aymanbakry',
  REPO: 'Reading-progress-and-speaker-progress-on-teams',
  BRANCH: 'main',
  ALLOW_FILE_MANAGEMENT: false,   // true = السماح للمعلم بإضافة وحذف الملفات الرئيسية
  MAX_IMAGE_SIDE: 1600,
  MAX_FILE_MB: 20
};
const API = `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents`;
const RAW = `https://raw.githubusercontent.com/${CONFIG.OWNER}/${CONFIG.REPO}/${CONFIG.BRANCH}`;
const TOKEN_KEY = 'gh-token-v1';

const SCHOOL = 'مدرسة البلاد القديم الابتدائية الإعدادية للبنين';
const STAFF = [
  {role:'مدير المدرسة',  name:'محمد إبراهيم', c:'#CE1126'},
  {role:'المدير المساعد', name:'عبدالله دليم', c:'#0b6f7e'},
  {role:'المعلم الأول',   name:'عباس كاظم',    c:'#9a6b00'},
  {role:'المعلم',         name:'أيمن بكري',    c:'#1d3a8a'}
];
const ACT_COLORS = ['#CE1126','#0b6f7e','#9a6b00','#1d3a8a','#237a4b','#7b3fa0','#c2410c','#0e7490','#7c4a2d','#a3185a'];
const TYPES = {reading:'Reading Progress', speaking:'Speaking Progress on Teams', other:'أخرى'};

/* روابط مجلدات الأنشطة في جوجل درايف (اختيارية): الصق الرابط بين علامتي الاقتباس */
const DRIVE_LINKS = {
  'r-1': '',  'r-2': '',  'r-3': '',  'r-4': '',  'r-5': '',
  'r-6': '',  'r-7': '',  'r-8': '',  'r-9': '',  'r-10': '',
  's-1': '',  's-2': '',  's-3': '',  's-4': '',  's-5': '',
  's-6': '',  's-7': '',  's-8': '',  's-9': '',  's-10': ''
};

/* ===================== أدوات مساعدة ===================== */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
const toB64 = str => btoa(unescape(encodeURIComponent(str)));
const fromB64 = b64 => decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
const fileToB64 = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});
const attUrl = att => `${RAW}/${att.path}`;

/* ===================== الأنشطة الجاهزة ===================== */
const READING = [
  'sports','health','My Family and Friends','The Weather and Seasons','Healthy Food vs. Junk Food',
  'My Favorite School Subject','Bahraini Traditional Food','Ramadan in Bahrain',"Mothers' Day",'Bahraini Landmarks'
];
const SPEAKING = [
  'A place I visited and liked so much','My Daily Routine','Festivals','Bahrain National Day','Describe Your house',
  'My favourite sport','My favourite hobby','A Trip to the Zoo or Park','A Family Day at the Beach','Four seasons of the year'
];
const makeActs = (key, prefix, titles) => titles.map((t, i) => ({
  id: `${key}-${i + 1}`, title: `${prefix} ${i + 1}: ${t}`, date: '', notes: '', link: '', done: false, attachments: []
}));
function defaultState(){
  return {files:[
    {id:'reading',  name:'Reading Progress',          type:'reading',  activities:makeActs('r', 'Reading progress', READING)},
    {id:'speaking', name:'Speaking Progress on Teams', type:'speaking', activities:makeActs('s', 'Speaker progress', SPEAKING)}
  ]};
}

/* ===================== الاتصال بـ GitHub ===================== */
const app = $('#app');
let state = defaultState(), dataSha = null, ready = false;
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
let isAdmin = !!getToken();

function gh(path, opts = {}){
  return fetch(`${API}/${path}`, {
    ...opts,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + getToken(),
      ...(opts.body ? {'Content-Type': 'application/json'} : {})
    }
  });
}
function setAuthUI(){ $('#btnAuth').textContent = isAdmin ? 'خروج المعلم' : 'دخول المعلم'; }
function dropToken(){ try { localStorage.removeItem(TOKEN_KEY); } catch {} isAdmin = false; dataSha = null; setAuthUI(); }

async function loadState(){
  if (isAdmin){
    const res = await gh(`data.json?ref=${CONFIG.BRANCH}&t=${Date.now()}`);
    if (res.status === 401){ dropToken(); toast('انتهت صلاحية المفتاح، سجّل الدخول من جديد'); return loadState(); }
    if (res.status === 404){ dataSha = null; state = defaultState(); return; }
    if (!res.ok) throw new Error('GitHub ' + res.status);
    const j = await res.json();
    dataSha = j.sha;
    state = JSON.parse(fromB64(j.content));
  } else {
    const res = await fetch(`${RAW}/data.json?t=${Date.now()}`);
    state = res.ok ? await res.json() : defaultState();
  }
  if (!state || !Array.isArray(state.files)) state = defaultState();
}

/* الحفظ يتم بالتتابع حتى لا تتعارض الطلبات */
let saveChain = Promise.resolve();
function save(){
  const run = () => doSave(true);
  saveChain = saveChain.then(run, run);
  return saveChain;
}
async function doSave(retry){
  if (!isAdmin) return false;
  const body = {message:'update data', content:toB64(JSON.stringify(state, null, 1)), branch:CONFIG.BRANCH};
  if (dataSha) body.sha = dataSha;
  let res;
  try { res = await gh('data.json', {method:'PUT', body:JSON.stringify(body)}); }
  catch { toast('تعذر الحفظ: تحقق من الاتصال بالإنترنت'); return false; }
  if (res.ok){ dataSha = (await res.json()).content.sha; return true; }
  if ((res.status === 409 || res.status === 422) && retry){
    const r = await gh(`data.json?ref=${CONFIG.BRANCH}&t=${Date.now()}`);
    dataSha = r.ok ? (await r.json()).sha : null;
    return doSave(false);
  }
  if (res.status === 401 || res.status === 403){ toast('المفتاح لا يملك صلاحية الكتابة. أنشئ مفتاحاً جديداً.'); return false; }
  toast('تعذر الحفظ (' + res.status + ')');
  return false;
}

async function uploadFile(file){
  const ext = ((file.name.match(/\.(\w+)$/) || [])[1] || '').toLowerCase();
  const name = uid() + (ext ? '.' + ext : '');
  const path = 'uploads/' + name;
  const content = await fileToB64(file);
  const res = await gh(path, {method:'PUT', body:JSON.stringify({message:'upload ' + name, content, branch:CONFIG.BRANCH})});
  if (!res.ok){
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || ('HTTP ' + res.status));
  }
  const j = await res.json();
  return {path, sha:j.content.sha};
}
async function removeRemote(att){
  try {
    const r = await gh(`${att.path}?ref=${CONFIG.BRANCH}&t=${Date.now()}`);
    if (!r.ok) return;
    const sha = (await r.json()).sha;
    await gh(att.path, {method:'DELETE', body:JSON.stringify({message:'delete file', sha, branch:CONFIG.BRANCH})});
  } catch {}
}

/* ===================== ضغط الصور ===================== */
async function shrinkImage(file){
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, CONFIG.MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 800 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    if (blob && blob.size < file.size)
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {type:'image/jpeg'});
  } catch {}
  return file;
}

/* ===================== التوجيه والتنقل ===================== */
const findFile = id => state.files.find(f => f.id === id);

function sequence(){
  const s = ['#/'];
  state.files.forEach(f => {
    s.push(`#/file/${f.id}`);
    f.activities.forEach(a => s.push(`#/file/${f.id}/act/${a.id}`));
  });
  return s;
}
function pagerHtml(cls){
  const seq = sequence();
  const cur = location.hash && location.hash !== '#' ? location.hash : '#/';
  const i = Math.max(0, seq.indexOf(cur));
  const prev = seq[i - 1], next = seq[i + 1];
  return `<div class="pager ${cls}">
    ${prev ? `<a class="btn nav" href="${prev}">→ الصفحة السابقة</a>` : '<span></span>'}
    <span class="pos">${i + 1} / ${seq.length}</span>
    ${next ? `<a class="btn nav" href="${next}">الصفحة التالية ←</a>` : '<span></span>'}
  </div>`;
}
function route(){
  if (!ready) return;
  const [, page, fid, , aid] = location.hash.split('/');
  window.scrollTo(0, 0);
  if (page === 'file' && findFile(fid)) aid ? renderActivity(fid, aid) : renderFile(fid);
  else renderHome();
  app.insertAdjacentHTML('afterbegin', pagerHtml('top'));
  app.insertAdjacentHTML('beforeend', pagerHtml('bottom'));
}
window.addEventListener('hashchange', route);

/* ===================== الصفحة الرئيسية ===================== */
function renderHome(){
  const manage = CONFIG.ALLOW_FILE_MANAGEMENT && isAdmin;
  app.innerHTML = `
    <section class="hero">
      <h1>${SCHOOL}</h1>
      <div class="staff">
        ${STAFF.map(p => `<div class="person" style="--c:${p.c}"><small>${p.role}</small><strong>${esc(p.name)}</strong></div>`).join('')}
      </div>
    </section>
    ${manage ? '<div class="row"><button class="btn" id="addFile">إضافة ملف جديد</button></div>' : ''}
    <div class="grid">
      ${state.files.map(f => {
        const done = f.activities.filter(a => a.done).length;
        const pct = f.activities.length ? Math.round(done / f.activities.length * 100) : 0;
        return `
        <article class="file" data-type="${f.type}">
          <h2>${esc(f.name)}</h2>
          <div>${f.activities.length} نشاط — مكتمل ${done}</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="actions">
            <a class="btn" href="#/file/${f.id}">فتح الملف</a>
            ${manage ? `<button class="btn danger" data-del-file="${f.id}">حذف</button>` : ''}
          </div>
        </article>`;
      }).join('') || '<div class="empty">لا توجد ملفات.</div>'}
    </div>`;
  if (manage){
    $('#addFile').onclick = openFileForm;
    app.querySelectorAll('[data-del-file]').forEach(b => b.onclick = () => deleteFile(b.dataset.delFile));
  }
}

/* ===================== صفحة الملف ===================== */
function renderFile(fid){
  const f = findFile(fid);
  app.innerHTML = `
    <div class="crumbs"><a href="#/">الرئيسية</a> / ${esc(f.name)}</div>
    <h1>${esc(f.name)}</h1>
    <p class="sub" id="progress"></p>
    <div class="row">
      ${isAdmin ? '<button class="btn" id="addAct">إضافة نشاط</button>' : ''}
      <input type="text" id="search" placeholder="ابحث في الأنشطة..." aria-label="بحث" style="max-width:260px;margin:0">
    </div>
    <div class="list" id="list"></div>`;

  const draw = () => {
    const q = $('#search').value.trim().toLowerCase();
    const done = f.activities.filter(a => a.done).length;
    $('#progress').textContent = `${TYPES[f.type] || ''} — أنجزت ${done} من ${f.activities.length}`;
    const items = f.activities.map((a, i) => ({a, i}))
      .filter(({a}) => !q || (a.title + ' ' + a.notes).toLowerCase().includes(q));
    $('#list').innerHTML = items.map(({a, i}) => `
      <div class="act" style="--c:${ACT_COLORS[i % ACT_COLORS.length]}">
        <label style="display:flex;gap:12px;align-items:center;flex:1;cursor:pointer;min-width:220px">
          <span class="num">${i + 1}</span>
          <input type="checkbox" data-done="${a.id}" ${a.done ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} aria-label="مكتمل">
          <span>
            <strong>${esc(a.title)}</strong>
            <span class="meta" style="display:block">${esc(a.date || '')}${a.attachments.length ? ' — ' + a.attachments.length + ' مرفق' : ''}</span>
          </span>
        </label>
        <div class="row" style="margin:0">
          <a class="btn" href="#/file/${f.id}/act/${a.id}">فتح</a>
          ${isAdmin ? `<button class="btn danger" data-del-act="${a.id}">حذف</button>` : ''}
        </div>
      </div>`).join('') ||
      `<div class="empty">${q ? 'لا توجد نتائج مطابقة.' : 'لا توجد أنشطة.'}</div>`;
  };
  draw();

  $('#search').oninput = draw;
  if (isAdmin) $('#addAct').onclick = () => openActivityForm(fid);
  $('#list').onclick = e => {
    const del = e.target.closest('[data-del-act]');
    if (del) deleteActivity(fid, del.dataset.delAct);
  };
  $('#list').onchange = async e => {
    const cb = e.target.closest('[data-done]');
    if (!cb || !isAdmin) return;
    f.activities.find(x => x.id === cb.dataset.done).done = cb.checked;
    draw(); await save();
  };
}

/* ===================== صفحة النشاط ===================== */
function renderActivity(fid, aid){
  const f = findFile(fid), idx = f.activities.findIndex(x => x.id === aid), a = f.activities[idx];
  if (!a) return renderFile(fid);
  const color = ACT_COLORS[idx % ACT_COLORS.length];
  const drive = DRIVE_LINKS[a.id] || '';
  app.innerHTML = `
    <div class="crumbs"><a href="#/">الرئيسية</a> / <a href="#/file/${f.id}">${esc(f.name)}</a> / ${esc(a.title)}</div>
    <h1 style="color:${color}">${esc(a.title)}</h1>
    <p class="sub">${esc(a.date || '')} ${a.done ? '— مكتمل' : ''}</p>
    <div class="card" style="--c:${color}">
      <h2>الوصف والملاحظات</h2>
      <div class="notes">${esc(a.notes) || '<span class="meta">لا توجد ملاحظات.</span>'}</div>
      ${drive ? `<p><a class="btn" href="${esc(drive)}" target="_blank" rel="noopener" style="background:${color};border-color:${color}">فتح مجلد النشاط في جوجل درايف</a></p>` : ''}
      ${a.link ? `<p><a href="${esc(a.link)}" target="_blank" rel="noopener">فتح رابط النشاط</a></p>` : ''}
      ${isAdmin ? '<button class="btn ghost" id="editAct">تعديل</button>' : ''}
    </div>
    <div class="card" style="--c:${color}">
      <h2>المرفقات (صور و PDF)</h2>
      ${isAdmin ? `<div class="row">
        <label class="btn" for="upl" style="background:${color};border-color:${color}">إضافة صور أو PDF</label>
        <input type="file" id="upl" accept="image/*,application/pdf" multiple hidden>
      </div>` : ''}
      <div class="thumbs" id="thumbs"></div>
    </div>`;

  if (isAdmin){
    $('#editAct').onclick = () => openActivityForm(fid, a);
    $('#upl').onchange = async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      for (let n = 0; n < files.length; n++){
        const raw = files[n];
        toast(`جاري رفع ${n + 1} من ${files.length}...`);
        try {
          const file = await shrinkImage(raw);
          if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024) throw new Error('حجم الملف أكبر من ' + CONFIG.MAX_FILE_MB + ' ميجابايت');
          const up = await uploadFile(file);
          const ext = ((file.name.match(/\.(\w+)$/) || [])[1] || '').toLowerCase();
          a.attachments.push({id:up.path, path:up.path, sha:up.sha, name:raw.name.replace(/\.\w+$/, '') + (ext ? '.' + ext : ''), mime:file.type});
        } catch (err) { toast('تعذر رفع ' + raw.name + ': ' + (err.message || '')); }
      }
      await save(); toast('تمت الإضافة'); route();
    };
  }

  const box = $('#thumbs');
  if (!a.attachments.length){
    box.innerHTML = '<div class="empty" style="grid-column:1/-1">لا توجد مرفقات.</div>';
    return;
  }
  for (const att of a.attachments){
    const url = attUrl(att);
    const isPdf = att.mime === 'application/pdf';
    const href = isPdf ? 'https://docs.google.com/gview?embedded=1&url=' + encodeURIComponent(url) : url;
    const caption = esc(att.name) + (isPdf
      ? ` — <a href="${esc(url)}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline">فتح مباشر</a>`
      : '');
    const el = document.createElement('div'); el.className = 'thumb';
    el.innerHTML =
      `<a href="${esc(href)}" data-fancybox="gallery" ${isPdf ? 'data-type="iframe"' : ''} data-caption="${esc(caption)}">` +
        (isPdf ? '<div class="pdf">PDF</div>' : `<img src="${esc(url)}" alt="${esc(att.name)}" loading="lazy">`) +
      `</a>` +
      `<div class="cap"><span title="${esc(att.name)}">${esc(att.name)}</span>${isAdmin ? '<button>حذف</button>' : ''}</div>`;
    if (isAdmin){
      el.querySelector('button').onclick = async () => {
        if (!confirm('حذف هذا المرفق؟')) return;
        toast('جاري الحذف...');
        await removeRemote(att);
        a.attachments = a.attachments.filter(x => x.id !== att.id);
        await save(); route();
      };
    }
    box.appendChild(el);
  }
  if (window.Fancybox) Fancybox.bind(box, '[data-fancybox="gallery"]', {Hash:false});
}

/* ===================== النوافذ ===================== */
const dlg = $('#dlg');
dlg.addEventListener('click', e => { if (e.target.closest('[data-close]')) dlg.close(); });
function showDialog(html){ dlg.innerHTML = html; dlg.showModal(); }

function openLogin(){
  showDialog(`<form id="lf"><h2>دخول المعلم</h2>
    <label class="f">مفتاح GitHub (يبدأ بـ github_pat_)
      <input type="password" name="token" required autocomplete="off" placeholder="الصق المفتاح هنا"></label>
    <p class="meta">يُحفظ المفتاح في هذا المتصفح فقط ولا يظهر لأحد. لا تشاركه مع أحد.</p>
    <div class="dlgbtns"><button class="btn" type="submit">دخول</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`);
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const token = new FormData(e.target).get('token').trim();
    try {
      const res = await fetch(`https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}`, {
        headers: {'Accept':'application/vnd.github+json', 'Authorization':'Bearer ' + token}
      });
      if (!res.ok) return toast('المفتاح غير صالح أو لا يصل إلى هذا المستودع');
      const j = await res.json();
      if (j.permissions && j.permissions.push === false) return toast('المفتاح لا يملك صلاحية الكتابة (Contents: Read and write)');
    } catch { return toast('تعذر الاتصال بـ GitHub'); }
    try { localStorage.setItem(TOKEN_KEY, token); } catch { return toast('المتصفح يمنع حفظ المفتاح'); }
    isAdmin = true; setAuthUI(); dlg.close();
    try { await loadState(); if (!dataSha) await save(); } catch (err) { toast('تعذر تحميل البيانات: ' + err.message); }
    route(); toast('تم تسجيل الدخول');
  };
}
function openFileForm(){
  showDialog(`<form method="dialog" id="ff"><h2>ملف جديد</h2>
    <label class="f">اسم الملف<input type="text" name="name" required></label>
    <label class="f">النوع<select name="type">${Object.entries(TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <div class="dlgbtns"><button class="btn" value="ok">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`);
  $('#ff').onsubmit = async e => {
    const d = new FormData(e.target);
    state.files.push({id:uid(), name:d.get('name').trim(), type:d.get('type'), activities:[]});
    await save(); route(); toast('تمت إضافة الملف');
  };
}
function openActivityForm(fid, existing){
  const a = existing || {title:'', date:new Date().toISOString().slice(0, 10), notes:'', link:''};
  showDialog(`<form method="dialog" id="af"><h2>${existing ? 'تعديل النشاط' : 'نشاط جديد'}</h2>
    <label class="f">عنوان النشاط<input type="text" name="title" required value="${esc(a.title)}"></label>
    <label class="f">التاريخ<input type="date" name="date" value="${esc(a.date)}"></label>
    <label class="f">رابط (Teams أو غيره) اختياري<input type="url" name="link" value="${esc(a.link)}"></label>
    <label class="f">ملاحظات<textarea name="notes">${esc(a.notes)}</textarea></label>
    <div class="dlgbtns"><button class="btn" value="ok">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`);
  $('#af').onsubmit = async e => {
    const d = new FormData(e.target), f = findFile(fid);
    const data = {title:d.get('title').trim(), date:d.get('date'), link:d.get('link'), notes:d.get('notes')};
    if (existing) Object.assign(existing, data);
    else f.activities.push({id:uid(), done:false, attachments:[], ...data});
    await save(); route(); toast('تم الحفظ');
  };
}

/* ===================== الحذف ===================== */
async function deleteActivity(fid, aid){
  const f = findFile(fid), a = f.activities.find(x => x.id === aid);
  if (!confirm(`حذف النشاط «${a.title}» وكل مرفقاته؟`)) return;
  toast('جاري الحذف...');
  for (const att of a.attachments) await removeRemote(att);
  f.activities = f.activities.filter(x => x.id !== aid);
  await save(); route(); toast('تم الحذف');
}
async function deleteFile(fid){
  if (!CONFIG.ALLOW_FILE_MANAGEMENT || !isAdmin) return;
  const f = findFile(fid);
  if (!confirm(`حذف الملف «${f.name}» بكل أنشطته؟`)) return;
  toast('جاري الحذف...');
  for (const a of f.activities) for (const att of a.attachments) await removeRemote(att);
  state.files = state.files.filter(x => x.id !== fid);
  await save(); route(); toast('تم الحذف');
}

/* ===================== التشغيل ===================== */
$('#btnAuth').onclick = async () => {
  if (isAdmin){
    dropToken();
    try { await loadState(); } catch {}
    route(); toast('تم تسجيل الخروج');
  } else openLogin();
};

(async function init(){
  setAuthUI();
  app.innerHTML = '<div class="empty">جاري التحميل...</div>';
  try {
    await loadState();
    ready = true; route();
  } catch (err) {
    app.innerHTML = `<div class="empty">تعذر تحميل البيانات: ${esc(err.message || err)}<br>تأكد من الاتصال بالإنترنت وأعد المحاولة.</div>`;
  }
})();
