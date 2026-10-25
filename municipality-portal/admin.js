/* Municipality admin dashboard — Supabase JS v2 */
'use strict';

const ADMIN_CONFIG = {
  supabaseUrl: 'https://pbqnrxpvosnlqujeeshd.supabase.co',
  supabaseAnonKey: 'sb_publishable_67AmM4fHGg3yXrJG4MusiA_ctG996Ff'
};

// If your submissions table uses a different primary-key name, change this to that column.
const SUBMISSION_ID_COLUMN = 'id';
const SUBMISSION_FILES_BUCKET = 'request-files';
const NEWS_IMAGES_BUCKET = 'public-news-images';
const STATUS_LABELS = {
  pending: 'قيد المعالجة',
  in_progress: 'قيد المتابعة',
  completed: 'مكتملة'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const ready = /^https:\/\//i.test(ADMIN_CONFIG.supabaseUrl) && Boolean(ADMIN_CONFIG.supabaseAnonKey);
const db = ready && window.supabase
  ? window.supabase.createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

let currentTab = 'submissions';
let submissionsCache = [];
let messagesCache = [];
let newsCache = [];
let toastTimer = null;
let authListenerRegistered = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-LB', { dateStyle: 'medium', timeStyle: 'short' });
}
function normalize(value) { return String(value ?? '').toLocaleLowerCase('ar').trim(); }
function statusLabel(value) { return STATUS_LABELS[value] || String(value || 'قيد المعالجة'); }
function getStatus(item) { return item.status || 'pending'; }
function showToast(message, isError = false) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
function setFormStatus(form, message, type = '') {
  const node = $('.form-status', form);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', type === 'error');
  node.classList.toggle('success', type === 'success');
}
function showError(target, message) {
  target.innerHTML = `<p class="form-status error">${esc(message)}</p>`;
}
function showEmpty(target, message) {
  target.innerHTML = `<p class="empty-state">${esc(message)}</p>`;
}
function humanError(error) {
  const message = String(error?.message || error || 'خطأ غير معروف');
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return 'رفضت صلاحيات قاعدة البيانات العملية. راجع سياسات RLS في Supabase.';
  }
  if (/column .* does not exist|schema cache/i.test(message)) {
    return 'اسم أحد الأعمدة لا يطابق قاعدة البيانات. راجع أسماء الأعمدة المطلوبة في تعليمات الإعداد.';
  }
  if (/failed to fetch|network/i.test(message)) return 'تعذّر الاتصال. تحقق من الإنترنت ورابط Supabase.';
  return message;
}
function validateExternalUrl(raw) {
  try {
    const url = new URL(String(raw || ''), window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch { return null; }
}
async function attachmentList(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return '<span class="muted">لا توجد مرفقات</span>';
  const links = await Promise.all(attachments.map(async (attachment, index) => {
    const item = typeof attachment === 'string' ? { path: attachment, name: `مرفق ${index + 1}` } : (attachment || {});
    const name = item.name || item.filename || item.original_name || `مرفق ${index + 1}`;
    let rawUrl = item.url || item.signedUrl || item.signed_url || '';
    if (!rawUrl && /^https?:\/\//i.test(String(item.path || ''))) rawUrl = item.path;
    if (!rawUrl && item.path && db) {
      const path = String(item.path).replace(/^\/+/, '');
      const { data, error } = await db.storage.from(SUBMISSION_FILES_BUCKET).createSignedUrl(path, 300);
      if (!error && data?.signedUrl) rawUrl = data.signedUrl;
    }
    const url = validateExternalUrl(rawUrl);
    if (!url) return `<span class="admin-file-card" title="${esc(item.path || name)}">${esc(name)} (تعذّر فتح الملف؛ تحقق من bucket والصلاحيات)</span>`;
    return `<a class="admin-file-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح الملف: ${esc(name)}</a>`;
  }));
  return links.join(' ');
}

function updateStats() {
  const total = submissionsCache.length;
  const pending = submissionsCache.filter(item => getStatus(item) === 'pending' || !item.status).length;
  const completed = submissionsCache.filter(item => getStatus(item) === 'completed').length;
  const totalEl = $('#stat-total');
  const pendingEl = $('#stat-pending');
  const completedEl = $('#stat-completed');
  const messagesEl = $('#stat-messages');
  if (totalEl) totalEl.textContent = String(total);
  if (pendingEl) pendingEl.textContent = String(pending);
  if (completedEl) completedEl.textContent = String(completed);
  if (messagesEl) messagesEl.textContent = String(messagesCache.length);
}
function currentFilteredSubmissions() {
  const query = normalize($('#admin-search')?.value);
  const statusFilter = $('#admin-status-filter')?.value || 'all';
  const kindFilter = $('#admin-kind-filter')?.value || 'all';
  return submissionsCache.filter(item => {
    const haystack = normalize([
      item.reference_code, item.full_name, item.name, item.phone, item.email,
      item.kind, item.request_type, item.complaint_type, item.details,
      item.address, item.notes, item.status
    ].join(' '));
    const statusMatches = statusFilter === 'all' || getStatus(item) === statusFilter;
    const kind = normalize(item.kind || item.type);
    const kindMatches = kindFilter === 'all' ||
      (kindFilter === 'complaint' ? /complaint|شكوى|شكاوى/.test(kind) : /request|طلب/.test(kind));
    return (!query || haystack.includes(query)) && statusMatches && kindMatches;
  });
}
async function renderSubmissions(target = $('#admin-content')) {
  if (!target) return;
  const rows = currentFilteredSubmissions();
  if (!rows.length) {
    showEmpty(target, submissionsCache.length ? 'ما في نتائج مطابقة للبحث أو الفلترة.' : 'ما في طلبات من المواطنين بعد.');
    return;
  }
  const renderedRows = await Promise.all(rows.map(async item => {
        const id = item[SUBMISSION_ID_COLUMN];
        const code = item.reference_code || (id != null ? `#${id}` : 'طلب مواطن');
        const attachments = Array.isArray(item.attachments) ? item.attachments : [];
        const status = getStatus(item);
        return `<tr>
          <td><strong>${esc(code)}</strong></td>
          <td>${esc(item.full_name || item.name || '—')}</td>
          <td>${esc(item.phone || '—')}${item.email ? `<br><span class="muted">${esc(item.email)}</span>` : ''}</td>
          <td>${esc(item.request_type || item.complaint_type || item.kind || '—')}</td>
          <td>${esc(item.details || item.message || '—')}</td>
          <td>${await attachmentList(attachments)}</td>
          <td>${esc(formatDate(item.created_at))}</td>
          <td><select class="status-select" data-status-id="${esc(id ?? '')}" aria-label="حالة ${esc(code)}" ${id == null ? 'disabled title="لا يوجد معرّف للطلب"' : ''}>
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select></td>
        </tr>`;
  }));
  target.innerHTML = `
    <h3>طلبات المواطنين وشكاواهم</h3>
    <p class="muted">عرض ${rows.length} من أصل ${submissionsCache.length} معاملة</p>
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>رقم المعاملة</th><th>المواطن</th><th>التواصل</th><th>نوع المعاملة</th><th>التفاصيل</th><th>المرفقات</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>${renderedRows.join('')}</tbody>
    </table></div>`;
  $$('[data-status-id]', target).forEach(select => {
    select.addEventListener('change', () => updateSubmissionStatus(select.dataset.statusId, select.value, select));
  });
}
async function updateSubmissionStatus(id, nextStatus, select) {
  if (!db || !id || !STATUS_LABELS[nextStatus]) return;
  const previous = submissionsCache.find(item => String(item[SUBMISSION_ID_COLUMN]) === String(id));
  if (!previous) return;
  const oldStatus = getStatus(previous);
  select.disabled = true;
  try {
    const { data, error } = await db.from('citizen_submissions')
      .update({ status: nextStatus })
      .eq(SUBMISSION_ID_COLUMN, id)
      .select(SUBMISSION_ID_COLUMN);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('لم يتم تحديث أي سجل. تحقق من معرّف الطلب وسياسات التعديل RLS.');
    previous.status = nextStatus;
    updateStats();
    showToast('تم تحديث حالة المعاملة وحفظها.');
    renderSubmissions();
  } catch (error) {
    console.error('Update submission status:', error);
    select.value = oldStatus;
    showToast('تعذّر تحديث الحالة: ' + humanError(error), true);
  } finally {
    select.disabled = false;
  }
}
function renderMessages(target = $('#admin-content')) {
  if (!target) return;
  const query = normalize($('#admin-search')?.value);
  const rows = messagesCache.filter(item => !query || normalize([item.name, item.email, item.phone, item.message].join(' ')).includes(query));
  if (!rows.length) { showEmpty(target, messagesCache.length ? 'ما في رسائل مطابقة للبحث.' : 'ما في رسائل من المواطنين بعد.'); return; }
  target.innerHTML = `<h3>رسائل المواطنين</h3><p class="muted">عدد الرسائل: ${rows.length}</p><div class="admin-list">${rows.map(message => `
    <article class="admin-card"><h3>${esc(message.name || 'مواطن')}</h3>
      <p><strong>البريد الإلكتروني:</strong> ${esc(message.email || '—')}</p>
      <p><strong>الهاتف:</strong> ${esc(message.phone || '—')}</p>
      <p><strong>الرسالة:</strong><br>${esc(message.message || '—').replace(/\n/g, '<br>')}</p>
      <p><strong>التاريخ:</strong> ${esc(formatDate(message.created_at))}</p>
    </article>`).join('')}</div>`;
}
function renderNews(target = $('#admin-content')) {
  if (!target) return;
  const categories = [
    ['municipal_decisions', 'قرارات البلدية'], ['announcements', 'إعلانات البلدية'],
    ['happy_occasions', 'أفراح ومناسبات'], ['condolences', 'تعازٍ ومواساة'],
    ['activities', 'نشاطات وفعاليات'], ['general', 'أخبار عامة']
  ];
  target.innerHTML = `
    <h3>إدارة الأخبار والإعلانات</h3>
    <p class="muted">أضف عنوان الخبر وتفاصيله وتصنيفه وصورة اختيارية. سيظهر الخبر على صفحة الأخبار العامة.</p>
    <form id="news-form" class="admin-card" enctype="multipart/form-data">
      <label for="news-title">عنوان الخبر</label>
      <input id="news-title" name="title" type="text" required maxlength="200" placeholder="عنوان الخبر">
      <label for="news-category">تصنيف الخبر</label>
      <select id="news-category" name="category" required>${categories.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
      <label for="news-summary">تفاصيل الخبر</label>
      <textarea id="news-summary" name="summary" required rows="5" maxlength="12000" placeholder="اكتب تفاصيل الخبر..."></textarea>
      <label for="news-image">صورة الخبر (اختياري، JPG/PNG/WebP، حتى 5MB)</label>
      <input id="news-image" name="image" type="file" accept="image/jpeg,image/png,image/webp">
      <button class="button button-primary" type="submit">نشر الخبر</button>
      <p class="form-status" aria-live="polite"></p>
    </form>
    <h3>الأخبار المنشورة</h3>
    ${newsCache.length ? `<div class="admin-list">${newsCache.map(news => `
      <article class="admin-card news-admin-card">
        ${news.image_url ? `<img src="${esc(validateExternalUrl(news.image_url) || '')}" alt="" loading="lazy" class="news-admin-image">` : ''}
        <p><strong>${esc(categories.find(([value]) => value === news.category)?.[1] || news.category || 'أخبار عامة')}</strong></p>
        <h3>${esc(news.title || 'بدون عنوان')}</h3><p>${esc(news.summary || '')}</p>
        <p class="muted">${esc(formatDate(news.published_at))}</p>
        <button type="button" class="small-button" data-delete-news="${esc(news.id ?? '')}" ${news.id == null ? 'disabled' : ''}>حذف الخبر</button>
      </article>`).join('')}</div>` : '<p class="muted">ما في أخبار منشورة بعد.</p>'}`;
  $('#news-form', target)?.addEventListener('submit', publishNews);
  $$('[data-delete-news]', target).forEach(button => button.addEventListener('click', async () => {
    if (!button.dataset.deleteNews || !window.confirm('متأكد أنك تريد حذف هذا الخبر؟')) return;
    button.disabled = true;
    try {
      const { error } = await db.from('public_news').delete().eq('id', button.dataset.deleteNews);
      if (error) throw error;
      await loadNews(); renderNews(target); showToast('تم حذف الخبر.');
    } catch (error) {
      console.error('Delete news:', error); showToast('تعذّر حذف الخبر: ' + humanError(error), true); button.disabled = false;
    }
  }));
}

async function fetchRows(table, orderColumn = 'created_at') {
  const { data, error } = await db.from(table).select('*').order(orderColumn, { ascending: false });
  if (error) throw error;
  return data || [];
}
async function loadSubmissions() { submissionsCache = await fetchRows('citizen_submissions', 'created_at'); }
async function loadMessages() { messagesCache = await fetchRows('citizen_messages', 'created_at'); }
async function loadNews() { newsCache = await fetchRows('public_news', 'published_at'); }
async function refreshAllData() {
  if (!db) return;
  const button = $('#refresh-data');
  if (button) button.disabled = true;
  try {
    await Promise.all([loadSubmissions(), loadMessages(), loadNews()]);
    updateStats();
    await renderTab(false);
    showToast('تم تحديث البيانات.');
  } catch (error) {
    console.error('Refresh data:', error);
    showToast('تعذّر تحديث البيانات: ' + humanError(error), true);
  } finally { if (button) button.disabled = false; }
}
async function renderTab(load = true) {
  const target = $('#admin-content');
  if (!target) return;
  if (load) target.innerHTML = '<p class="muted loading-text">يتم تحميل البيانات...</p>';
  try {
    if (load) {
      if (currentTab === 'submissions') await loadSubmissions();
      else if (currentTab === 'messages') await loadMessages();
      else if (currentTab === 'news') await loadNews();
      // Keep overview counts up to date when any section is opened.
      updateStats();
    }
    if (currentTab === 'submissions') renderSubmissions(target);
    else if (currentTab === 'messages') renderMessages(target);
    else if (currentTab === 'news') renderNews(target);
    else showEmpty(target, 'هذا القسم غير متوفر.');
  } catch (error) {
    console.error('Dashboard section:', error);
    showError(target, 'ما قدرنا نحمّل البيانات: ' + humanError(error));
  }
}
async function publishNews(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  const summary = String(formData.get('summary') || '').trim();
  const category = String(formData.get('category') || 'general');
  const imageFile = formData.get('image');
  if (!title || !summary) { setFormStatus(form, 'عبّي عنوان الخبر وتفاصيله.', 'error'); return; }
  if (imageFile instanceof File && imageFile.size > 5 * 1024 * 1024) { setFormStatus(form, 'حجم الصورة أكبر من 5MB.', 'error'); return; }
  if (imageFile instanceof File && imageFile.size && !['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) { setFormStatus(form, 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.', 'error'); return; }
  if (button) button.disabled = true;
  let uploadedPath = null;
  try {
    setFormStatus(form, 'عم ننشر الخبر...');
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً.');
    let imageUrl = null;
    if (imageFile instanceof File && imageFile.size > 0) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'news-image';
      uploadedPath = `${userData.user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await db.storage.from(NEWS_IMAGES_BUCKET).upload(uploadedPath, imageFile, { upsert: false, contentType: imageFile.type });
      if (uploadError) throw uploadError;
      imageUrl = db.storage.from(NEWS_IMAGES_BUCKET).getPublicUrl(uploadedPath).data?.publicUrl || null;
    }
    const { error } = await db.from('public_news').insert({ title, summary, category, image_url: imageUrl, published_at: new Date().toISOString(), created_by: userData.user.id });
    if (error) throw error;
    await loadNews(); renderNews($('#admin-content')); showToast('تم نشر الخبر بنجاح.');
  } catch (error) {
    console.error('Publish news:', error);
    if (uploadedPath) {
      const { error: cleanupError } = await db.storage.from(NEWS_IMAGES_BUCKET).remove([uploadedPath]);
      if (cleanupError) console.warn('Could not clean up uploaded news image:', cleanupError);
    }
    setFormStatus(form, 'ما قدرنا ننشر الخبر: ' + humanError(error), 'error');
  } finally { if (button) button.disabled = false; }
}

async function refreshAuth() {
  const loginPanel = $('#login-panel');
  const dashboard = $('#dashboard');
  const badge = $('#user-badge');
  if (!db) {
    if (loginPanel) loginPanel.hidden = false;
    if (dashboard) dashboard.hidden = true;
    const form = $('#login-form');
    if (form) setFormStatus(form, 'تعذّر تشغيل Supabase. تأكد من رابط المشروع والمفتاح وتحميل مكتبة Supabase.', 'error');
    return;
  }
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (loginPanel) loginPanel.hidden = Boolean(session);
    if (dashboard) dashboard.hidden = !session;
    if (badge) badge.hidden = !session;
    if (session) await renderTab();
  } catch (error) {
    console.error('Auth session:', error);
    if (loginPanel) loginPanel.hidden = false;
    if (dashboard) dashboard.hidden = true;
    const form = $('#login-form');
    if (form) setFormStatus(form, 'تعذّر التحقق من الجلسة: ' + humanError(error), 'error');
  }
}

$('#login-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!db) { setFormStatus(form, 'إعدادات Supabase غير جاهزة.', 'error'); return; }
  if (!email || !password) { setFormStatus(form, 'أدخل البريد الإلكتروني وكلمة المرور.', 'error'); return; }
  if (button) button.disabled = true;
  try {
    setFormStatus(form, 'عم نسجّل الدخول...');
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    form.reset();
    setFormStatus(form, 'تم تسجيل الدخول بنجاح.', 'success');
    await refreshAuth();
  } catch (error) {
    console.error('Login:', error);
    setFormStatus(form, 'تعذّر تسجيل الدخول: ' + humanError(error), 'error');
  } finally { if (button) button.disabled = false; }
});
$('#logout')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    submissionsCache = []; messagesCache = []; newsCache = [];
    updateStats();
    await refreshAuth();
    showToast('تم تسجيل الخروج.');
  } catch (error) {
    console.error('Logout:', error);
    showToast('ما قدرنا نسجّل الخروج: ' + humanError(error), true);
  } finally { button.disabled = false; }
});
$$('[data-tab]').forEach(button => button.addEventListener('click', async () => {
  currentTab = button.dataset.tab;
  $$('[data-tab]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  const filterBar = $('#filter-bar');
  if (filterBar) filterBar.hidden = currentTab === 'news';
  await renderTab();
}));
$('#admin-search')?.addEventListener('input', () => {
  if (currentTab === 'submissions') renderSubmissions();
  else if (currentTab === 'messages') renderMessages();
});
$('#admin-status-filter')?.addEventListener('change', () => currentTab === 'submissions' && renderSubmissions());
$('#admin-kind-filter')?.addEventListener('change', () => currentTab === 'submissions' && renderSubmissions());
$('#refresh-data')?.addEventListener('click', refreshAllData);

if (db && !authListenerRegistered) {
  authListenerRegistered = true;
  db.auth.onAuthStateChange((event, session) => {
    // Defer app queries until the auth callback has returned.
    Promise.resolve().then(async () => {
      if (event === 'SIGNED_OUT' || !session) {
        const loginPanel = $('#login-panel');
        const dashboard = $('#dashboard');
        const badge = $('#user-badge');
        if (loginPanel) loginPanel.hidden = false;
        if (dashboard) dashboard.hidden = true;
        if (badge) badge.hidden = true;
      } else {
        await refreshAuth();
      }
    });
  });
}




/* إدارة دور المياه والنفايات — متوافق مع اتصال db الموجود في admin.js */

const scheduleDays = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت"
];

let scheduleData = null;

async function loadSchedulesAdmin() {
  const message = document.getElementById("scheduleMessage");
  const saveButton = document.getElementById("saveSchedules");
  const waterSelect = document.getElementById("currentWater");
  const settings = document.getElementById("neighborhoodSettings");
  const noteInput = document.getElementById("waterNote");

  if (!message || !saveButton || !waterSelect || !settings || !noteInput) {
    console.error("Schedule admin: one or more HTML elements are missing.");
    return;
  }

  message.textContent = "جارٍ تحميل الجدول...";
  saveButton.disabled = true;

  try {
    if (!db) {
      throw new Error("اتصال Supabase غير جاهز. تحقق من إعدادات الاتصال.");
    }

    const { data, error } = await db
      .from("municipality_schedules")
      .select("schedule_data")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.schedule_data) {
      throw new Error(
        "لم نعثر على سجل الجدول. أنشئ جدول municipality_schedules وأضف السجل الأول في Supabase."
      );
    }

    const loaded = data.schedule_data;

    if (!Array.isArray(loaded.neighborhoods) || loaded.neighborhoods.length !== 8) {
      throw new Error("بيانات الجدول غير مكتملة. يجب أن يحتوي الجدول على 8 حارات.");
    }

    scheduleData = loaded;

    waterSelect.replaceChildren();
    settings.replaceChildren();

    noteInput.value = scheduleData.water_note || "";

    scheduleData.neighborhoods.forEach((neighborhood, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = neighborhood.name;
      waterSelect.appendChild(option);

      const row = document.createElement("div");
      row.className = "schedule-admin-row";

      const name = document.createElement("input");
      name.type = "text";
      name.value = neighborhood.name || "";
      name.maxLength = 100;
      name.required = true;
      name.setAttribute("aria-label", `اسم الحارة ${index + 1}`);

      const day = document.createElement("select");
      day.setAttribute(
        "aria-label",
        `يوم جمع النفايات للحارة ${index + 1}`
      );

      scheduleDays.forEach(dayName => {
        const option = document.createElement("option");
        option.value = dayName;
        option.textContent = dayName;
        day.appendChild(option);
      });

      day.value = scheduleDays.includes(neighborhood.waste_day)
        ? neighborhood.waste_day
        : "الاثنين";

      const label = document.createElement("label");
      label.className = "schedule-admin-neighborhood";
      label.textContent = `الحارة ${index + 1}`;

      const dayLabel = document.createElement("label");
      dayLabel.textContent = "يوم جمع النفايات";

      const fields = document.createElement("div");
      fields.className = "schedule-admin-fields";
      fields.append(name, dayLabel, day);

      row.append(label, fields);
      settings.appendChild(row);

      // حفظ مراجع الحقول لاستخدامها عند النشر
      neighborhood._nameInput = name;
      neighborhood._daySelect = day;
    });

    const currentIndex = scheduleData.neighborhoods.findIndex(
      n => n.name === scheduleData.current_water_neighborhood
    );

    waterSelect.value = String(currentIndex >= 0 ? currentIndex : 0);
    message.textContent = "تم تحميل الجدول بنجاح.";
  } catch (error) {
    console.error("Load schedules error:", error);
    message.textContent = "تعذّر تحميل الجدول: " + (error.message || error);
  } finally {
    saveButton.disabled = false;
  }
}

async function saveSchedulesAdmin() {
  const message = document.getElementById("scheduleMessage");
  const saveButton = document.getElementById("saveSchedules");
  const waterSelect = document.getElementById("currentWater");
  const noteInput = document.getElementById("waterNote");

  if (!scheduleData) {
    message.textContent = "لم يتم تحميل الجدول بعد. حاول تحديث الصفحة.";
    return;
  }

  const neighborhoods = scheduleData.neighborhoods;

  const names = neighborhoods.map(n =>
    n._nameInput ? n._nameInput.value.trim() : n.name
  );

  if (names.some(name => !name)) {
    message.textContent = "يرجى كتابة أسماء الحارات الثمانية.";
    return;
  }

  const normalizedNames = names.map(name => name.toLocaleLowerCase("ar"));
  if (new Set(normalizedNames).size !== names.length) {
    message.textContent = "لا يمكن تكرار اسم الحارة.";
    return;
  }

  const selectedIndex = Number(waterSelect.value);

  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= neighborhoods.length
  ) {
    message.textContent = "اختر الحارة التي عليها دور المياه.";
    return;
  }

  const updatedNeighborhoods = neighborhoods.map((n, index) => ({
    name: names[index],
    water_order: n.water_order ?? index + 1,
    waste_day: n._daySelect.value
  }));

  const updated = {
    current_water_neighborhood: names[selectedIndex],
    water_note: noteInput.value.trim(),
    waste_time: "صباحًا",
    neighborhoods: updatedNeighborhoods
  };

  saveButton.disabled = true;
  message.textContent = "جارٍ حفظ التعديلات...";

  try {
    if (!db) {
      throw new Error("اتصال Supabase غير جاهز.");
    }

    const { data, error } = await db
      .from("municipality_schedules")
      .update({
        schedule_data: updated,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1)
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        "لم يتم تحديث السجل. تحقق من تسجيل دخول المدير وسياسات صلاحيات التعديل."
      );
    }

    message.textContent = "تم حفظ الجدول ونشر التعديلات بنجاح.";
    await loadSchedulesAdmin();
  } catch (error) {
    console.error("Save schedules error:", error);
    message.textContent = "فشل حفظ الجدول: " + (error.message || error);
  } finally {
    saveButton.disabled = false;
  }
}

document
  .getElementById("saveSchedules")
  ?.addEventListener("click", saveSchedulesAdmin);

// لا نحاول التحميل قبل تهيئة اتصال Supabase.
loadSchedulesAdmin();


refreshAuth();
