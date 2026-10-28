/* ===================== الإعدادات ===================== */
const CONFIG = {
  ALLOW_FILE_MANAGEMENT: false,   // true = السماح بإضافة وحذف الملفات الرئيسية
  MAX_IMAGE_SIDE: 1600
};
const SCHOOL = 'مدرسة البلاد القديم الابتدائية الإعدادية للبنين';
const STAFF = [
  {role:'مدير المدرسة',  name:'محمد إبراهيم', c:'#CE1126'},
  {role:'المدير المساعد', name:'عبدالله دليم', c:'#0b6f7e'},
  {role:'المعلم الأول',   name:'عباس كاظم',    c:'#9a6b00'},
  {role:'المعلم',         name:'أيمن بكري',    c:'#1d3a8a'}
];
const ACT_COLORS = ['#CE1126','#0b6f7e','#9a6b00','#1d3a8a','#237a4b','#7b3fa0','#c2410c','#0e7490','#7c4a2d','#a3185a'];
const STATE_KEY = 'platform-state-v2';

/* ===================== أدوات مساعدة ===================== */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
const TYPES = {reading:'Reading Progress', speaking:'Speaking Progress on Teams', other:'أخرى'};

/* ===================== الأنشطة الجاهزة ===================== */
const READING = [
  'sports','health','My Family and Friends','The Weather and Seasons','Healthy Food vs. Junk Food',
  'My Favorite School Subject','Bahraini Traditional Food','Ramadan in Bahrain',"Mothers' Day",'Bahraini Landmarks'
];
const SPEAKING = [
  'A place I visited and liked so much','My Daily Routine','Festivals','Bahrain National Day','Describe Your house',
  'My favourite sport','My favourite hobby','A Trip to the Zoo or Park','A Family Day at the Beach','Four seasons of the year'
];
const makeActs = (prefix, titles) => titles.map((t, i) => ({
  id: uid(), title: `${prefix} ${i + 1}: ${t}`, date: '', notes: '', link: '', done: false, attachments: []
}));
function defaultState(){
  return {files:[
    {id:uid(), name:'Reading Progress', type:'reading', activities:makeActs('Reading progress', READING)},
    {id:uid(), name:'Speaking Progress on Teams', type:'speaking', activities:makeActs('Speaker progress', SPEAKING)}
  ]};
}

/* ===================== الحالة (localStorage) ===================== */
let state;
try { state = JSON.parse(localStorage.getItem(STATE_KEY)) || defaultState(); } catch { state = defaultState(); }
function save(){
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); return true; }
  catch { toast('تعذر الحفظ: مساحة المتصفح ممتلئة'); return false; }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ===================== الملفات (IndexedDB) ===================== */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('platform-files', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('blobs');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function tx(mode, fn){
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction('blobs', mode);
    const out = fn(t.objectStore('blobs'));
    t.oncomplete = () => res(out.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const putBlob = (id, blob) => tx('readwrite', s => s.put(blob, id));
const getBlob = id => tx('readonly', s => s.get(id));
const delBlob = id => tx('readwrite', s => s.delete(id));

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
const app = $('#app');
const findFile = id => state.files.find(f => f.id === id);
let objectUrls = [];

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
  objectUrls.forEach(u => URL.revokeObjectURL(u)); objectUrls = [];
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
  const manage = CONFIG.ALLOW_FILE_MANAGEMENT;
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
      <button class="btn" id="addAct">إضافة نشاط</button>
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
          <input type="checkbox" data-done="${a.id}" ${a.done ? 'checked' : ''} aria-label="مكتمل">
          <span>
            <strong>${esc(a.title)}</strong>
            <span class="meta" style="display:block">${esc(a.date || '')}${a.attachments.length ? ' — ' + a.attachments.length + ' مرفق' : ''}</span>
          </span>
        </label>
        <div class="row" style="margin:0">
          <a class="btn" href="#/file/${f.id}/act/${a.id}">فتح</a>
          <button class="btn danger" data-del-act="${a.id}">حذف</button>
        </div>
      </div>`).join('') ||
      `<div class="empty">${q ? 'لا توجد نتائج مطابقة.' : 'لا توجد أنشطة. اضغط «إضافة نشاط».'}</div>`;
  };
  draw();

  $('#search').oninput = draw;
  $('#addAct').onclick = () => openActivityForm(fid);
  $('#list').onclick = e => {
    const del = e.target.closest('[data-del-act]');
    if (del) deleteActivity(fid, del.dataset.delAct);
  };
  $('#list').onchange = e => {
    const cb = e.target.closest('[data-done]');
    if (!cb) return;
    f.activities.find(x => x.id === cb.dataset.done).done = cb.checked;
    save(); draw();
  };
}

/* ===================== صفحة النشاط ===================== */
async function renderActivity(fid, aid){
  const f = findFile(fid), idx = f.activities.findIndex(x => x.id === aid), a = f.activities[idx];
  if (!a) return renderFile(fid);
  const color = ACT_COLORS[idx % ACT_COLORS.length];
  app.innerHTML = `
    <div class="crumbs"><a href="#/">الرئيسية</a> / <a href="#/file/${f.id}">${esc(f.name)}</a> / ${esc(a.title)}</div>
    <h1 style="color:${color}">${esc(a.title)}</h1>
    <p class="sub">${esc(a.date || '')} ${a.done ? '— مكتمل' : ''}</p>
    <div class="card" style="--c:${color}">
      <h2>الوصف والملاحظات</h2>
      <div class="notes">${esc(a.notes) || '<span class="meta">لا توجد ملاحظات.</span>'}</div>
      ${a.link ? `<p><a href="${esc(a.link)}" target="_blank" rel="noopener">فتح رابط النشاط</a></p>` : ''}
      <button class="btn ghost" id="editAct">تعديل</button>
    </div>
    <div class="card" style="--c:${color}">
      <h2>المرفقات (صور و PDF)</h2>
      <div class="row">
        <label class="btn" for="upl" style="background:${color};border-color:${color}">إضافة صور أو PDF</label>
        <input type="file" id="upl" accept="image/*,application/pdf" multiple hidden>
      </div>
      <div class="thumbs" id="thumbs"></div>
    </div>`;

  $('#editAct').onclick = () => openActivityForm(fid, a);
  $('#upl').onchange = async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    toast('جاري الرفع...');
    for (const raw of files){
      try {
        const file = await shrinkImage(raw);
        const id = uid();
        await putBlob(id, file);
        a.attachments.push({id, name:raw.name.replace(/\.\w+$/, '') + (file.name.match(/\.\w+$/) || [''])[0], mime:file.type});
      } catch { toast('تعذر حفظ ' + raw.name + ' (المساحة ممتلئة؟)'); }
    }
    save(); toast('تمت الإضافة'); route();
  };

  const box = $('#thumbs');
  if (!a.attachments.length){
    box.innerHTML = '<div class="empty" style="grid-column:1/-1">لا توجد مرفقات.</div>';
    return;
  }
  for (const att of a.attachments){
    const blob = await getBlob(att.id);
    const el = document.createElement('div'); el.className = 'thumb';
    if (!blob){
      el.innerHTML = `<div class="pdf" style="font-size:1rem">غير متوفر</div><div class="cap"><span>${esc(att.name)}</span><button>حذف</button></div>`;
    } else {
      const url = URL.createObjectURL(blob); objectUrls.push(url);
      const isPdf = att.mime === 'application/pdf';
      el.innerHTML = (isPdf ? '<div class="pdf" style="cursor:pointer">PDF</div>' : `<img src="${url}" alt="${esc(att.name)}">`) +
        `<div class="cap"><span title="${esc(att.name)}">${esc(att.name)}</span><button>حذف</button></div>`;
      el.firstElementChild.onclick = () => isPdf ? window.open(url, '_blank') : openImage(url, att.name);
    }
    el.querySelector('button').onclick = async () => {
      if (!confirm('حذف هذا المرفق؟')) return;
      try { await delBlob(att.id); } catch {}
      a.attachments = a.attachments.filter(x => x.id !== att.id);
      save(); route();
    };
    box.appendChild(el);
  }
}

/* ===================== النوافذ ===================== */
const dlg = $('#dlg');
dlg.addEventListener('click', e => { if (e.target.closest('[data-close]')) dlg.close(); });
function showDialog(html, wide){ dlg.className = wide ? 'wide' : ''; dlg.innerHTML = html; dlg.showModal(); }
function openImage(url, name){
  showDialog(`<img class="full" src="${url}" alt="${esc(name)}"><div class="dlgbtns"><button class="btn ghost" data-close>إغلاق</button></div>`, true);
}
function openFileForm(){
  showDialog(`<form method="dialog" id="ff"><h2>ملف جديد</h2>
    <label class="f">اسم الملف<input type="text" name="name" required></label>
    <label class="f">النوع<select name="type">${Object.entries(TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <div class="dlgbtns"><button class="btn" value="ok">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`);
  $('#ff').onsubmit = e => {
    const d = new FormData(e.target);
    state.files.push({id:uid(), name:d.get('name').trim(), type:d.get('type'), activities:[]});
    save(); route(); toast('تمت إضافة الملف');
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
  $('#af').onsubmit = e => {
    const d = new FormData(e.target), f = findFile(fid);
    const data = {title:d.get('title').trim(), date:d.get('date'), link:d.get('link'), notes:d.get('notes')};
    if (existing) Object.assign(existing, data);
    else f.activities.push({id:uid(), done:false, attachments:[], ...data});
    save(); route(); toast('تم الحفظ');
  };
}

/* ===================== الحذف ===================== */
async function deleteActivity(fid, aid){
  const f = findFile(fid), a = f.activities.find(x => x.id === aid);
  if (!confirm(`حذف النشاط «${a.title}» وكل مرفقاته؟`)) return;
  for (const att of a.attachments) { try { await delBlob(att.id); } catch {} }
  f.activities = f.activities.filter(x => x.id !== aid);
  save(); route(); toast('تم الحذف');
}
async function deleteFile(fid){
  if (!CONFIG.ALLOW_FILE_MANAGEMENT) return;
  const f = findFile(fid);
  if (!confirm(`حذف الملف «${f.name}» بكل أنشطته؟`)) return;
  for (const a of f.activities) for (const att of a.attachments) { try { await delBlob(att.id); } catch {} }
  state.files = state.files.filter(x => x.id !== fid);
  save(); route(); toast('تم الحذف');
}

/* ===================== نسخة احتياطية ===================== */
const toDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
$('#btnExport').onclick = async () => {
  toast('جاري تجهيز النسخة...');
  const blobs = {};
  for (const f of state.files) for (const a of f.activities) for (const att of a.attachments){
    try { const b = await getBlob(att.id); if (b) blobs[att.id] = await toDataURL(b); } catch {}
  }
  const out = new Blob([JSON.stringify({state, blobs})], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(out);
  link.download = 'platform-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  toast('تم حفظ النسخة الاحتياطية');
};
$('#importInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.state || !Array.isArray(data.state.files)) throw new Error('bad');
    if (!confirm('سيتم استبدال البيانات الحالية بالنسخة المحفوظة. هل تريد المتابعة؟')) return;
    for (const [id, url] of Object.entries(data.blobs || {})) await putBlob(id, await (await fetch(url)).blob());
    state = data.state; save(); route(); toast('تم استرجاع النسخة');
  } catch { toast('الملف غير صالح'); }
  e.target.value = '';
};

route();
