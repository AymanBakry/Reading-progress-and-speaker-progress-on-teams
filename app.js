/* ===================== الإعدادات ===================== */
const CONFIG = {
  SUPABASE_URL: 'qmeqjthfsdupxkzrvkrg',
  SUPABASE_KEY: 'sb_publishable_la2DYxS5MwKB0NuDubqwyw_HGVaehDN',
  ALLOW_FILE_MANAGEMENT: false,   // true = السماح للمعلم بإضافة وحذف الملفات الرئيسية
  MAX_IMAGE_SIDE: 1600
};
const BUCKET = 'attachments';
const SCHOOL = 'مدرسة البلاد القديم الابتدائية الإعدادية للبنين';
const STAFF = [
  {role:'مدير المدرسة',  name:'محمد إبراهيم', c:'#CE1126'},
  {role:'المدير المساعد', name:'عبدالله دليم', c:'#0b6f7e'},
  {role:'المعلم الأول',   name:'عباس كاظم',    c:'#9a6b00'},
  {role:'المعلم',         name:'أيمن بكري',    c:'#1d3a8a'}
];
const ACT_COLORS = ['#CE1126','#0b6f7e','#9a6b00','#1d3a8a','#237a4b','#7b3fa0','#c2410c','#0e7490','#7c4a2d','#a3185a'];
const TYPES = {reading:'Reading Progress', speaking:'Speaking Progress on Teams', other:'أخرى'};

/* ===================== أدوات مساعدة ===================== */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

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

/* ===================== الاتصال بـ Supabase ===================== */
const app = $('#app');
let sb = null, state = defaultState(), isAdmin = false, rowExists = false, ready = false;
try { sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY); } catch (e) { sb = null; }

async function loadState(){
  const {data, error} = await sb.from('app_state').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  rowExists = !!data;
  state = (data && data.data && Array.isArray(data.data.files)) ? data.data : defaultState();
}
async function save(){
  if (!isAdmin) return false;
  const {error} = await sb.from('app_state').upsert({id:1, data:state, updated_at:new Date().toISOString()});
  if (error){ toast('تعذر الحفظ: ' + error.message); return false; }
  rowExists = true; return true;
}
function setAuthUI(){ $('#btnAuth').textContent = isAdmin ? 'خروج المعلم' : 'دخول المعلم'; }

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
  app.innerHTML = `
    <div class="crumbs"><a href="#/">الرئيسية</a> / <a href="#/file/${f.id}">${esc(f.name)}</a> / ${esc(a.title)}</div>
    <h1 style="color:${color}">${esc(a.title)}</h1>
    <p class="sub">${esc(a.date || '')} ${a.done ? '— مكتمل' : ''}</p>
    <div class="card" style="--c:${color}">
      <h2>الوصف والملاحظات</h2>
      <div class="notes">${esc(a.notes) || '<span class="meta">لا توجد ملاحظات.</span>'}</div>
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
      toast('جاري الرفع...');
      for (const raw of files){
        try {
          const file = await shrinkImage(raw);
          const ext = ((file.name.match(/\.(\w+)$/) || [])[1] || '').toLowerCase();
          const path = uid() + (ext ? '.' + ext : '');
          const {error} = await sb.storage.from(BUCKET).upload(path, file, {contentType:file.type});
          if (error) throw error;
          const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          a.attachments.push({id:path, path, url, name:raw.name.replace(/\.\w+$/, '') + (ext ? '.' + ext : ''), mime:file.type});
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
    const isPdf = att.mime === 'application/pdf';
    const href = isPdf ? 'https://docs.google.com/gview?embedded=1&url=' + encodeURIComponent(att.url) : att.url;
    const caption = esc(att.name) + (isPdf
      ? ` — <a href="${esc(att.url)}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline">فتح مباشر</a>`
      : '');
    const el = document.createElement('div'); el.className = 'thumb';
    el.innerHTML =
      `<a href="${esc(href)}" data-fancybox="gallery" ${isPdf ? 'data-type="iframe"' : ''} data-caption="${esc(caption)}">` +
        (isPdf ? '<div class="pdf">PDF</div>' : `<img src="${esc(att.url)}" alt="${esc(att.name)}" loading="lazy">`) +
      `</a>` +
      `<div class="cap"><span title="${esc(att.name)}">${esc(att.name)}</span>${isAdmin ? '<button>حذف</button>' : ''}</div>`;
    if (isAdmin){
      el.querySelector('button').onclick = async () => {
        if (!confirm('حذف هذا المرفق؟')) return;
        try { await sb.storage.from(BUCKET).remove([att.path]); } catch {}
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
    <label class="f">البريد الإلكتروني<input type="email" name="email" required autocomplete="username"></label>
    <label class="f">كلمة المرور<input type="password" name="password" required autocomplete="current-password"></label>
    <div class="dlgbtns"><button class="btn" type="submit">دخول</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`);
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const d = new FormData(e.target);
    const {error} = await sb.auth.signInWithPassword({email:d.get('email'), password:d.get('password')});
    if (error) return toast('بيانات الدخول غير صحيحة');
    dlg.close(); isAdmin = true; setAuthUI();
    if (!rowExists) await save();
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
  const paths = a.attachments.map(x => x.path).filter(Boolean);
  if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch {} }
  f.activities = f.activities.filter(x => x.id !== aid);
  await save(); route(); toast('تم الحذف');
}
async function deleteFile(fid){
  if (!CONFIG.ALLOW_FILE_MANAGEMENT || !isAdmin) return;
  const f = findFile(fid);
  if (!confirm(`حذف الملف «${f.name}» بكل أنشطته؟`)) return;
  const paths = f.activities.flatMap(a => a.attachments.map(x => x.path)).filter(Boolean);
  if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch {} }
  state.files = state.files.filter(x => x.id !== fid);
  await save(); route(); toast('تم الحذف');
}

/* ===================== التشغيل ===================== */
$('#btnAuth').onclick = async () => {
  if (!sb) return;
  if (isAdmin){ await sb.auth.signOut(); isAdmin = false; setAuthUI(); route(); toast('تم تسجيل الخروج'); }
  else openLogin();
};

(async function init(){
  if (!sb || CONFIG.SUPABASE_URL.startsWith('PASTE')){
    app.innerHTML = '<div class="empty">لم يتم ربط المنصة بـ Supabase بعد. ضع الرابط والمفتاح في أول ملف app.js.</div>';
    return;
  }
  app.innerHTML = '<div class="empty">جاري التحميل...</div>';
  try {
    const {data} = await sb.auth.getSession();
    isAdmin = !!data.session; setAuthUI();
    await loadState();
    ready = true; route();
  } catch (err) {
    app.innerHTML = `<div class="empty">تعذر تحميل البيانات: ${esc(err.message || err)}<br>تأكد من الرابط والمفتاح ومن تنفيذ كود SQL.</div>`;
  }
})();
