'use strict';
const NEWS_CONFIG = {
  supabaseUrl: 'https://pbqnrxpvosnlqujeeshd.supabase.co',
  supabaseAnonKey: 'sb_publishable_67AmM4fHGg3yXrJG4MusiA_ctG996Ff'
};
const newsDb = window.supabase?.createClient(NEWS_CONFIG.supabaseUrl, NEWS_CONFIG.supabaseAnonKey);
const newsCategories = [
  ['all', 'كل الأخبار'], ['municipal_decisions', 'قرارات البلدية'], ['announcements', 'إعلانات البلدية'],
  ['happy_occasions', 'أفراح ومناسبات'], ['condolences', 'تعازٍ ومواساة'], ['activities', 'نشاطات وفعاليات'], ['general', 'أخبار عامة']
];
const newsEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newsDate = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ar-LB',{year:'numeric',month:'long',day:'numeric'}) : ''; };
const categoryLabel = value => newsCategories.find(([key]) => key === value)?.[1] || 'أخبار عامة';
const newsContent = document.getElementById('news-content');
let allNews = [];
let selectedCategory = 'all';
function safeImage(url) { try { const parsed = new URL(url, location.href); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; } }
function renderFilters() {
  const wrap = document.getElementById('news-filters');
  wrap.innerHTML = newsCategories.map(([key,label]) => `<button type="button" class="news-filter ${selectedCategory === key ? 'active' : ''}" data-category="${key}">${label}</button>`).join('');
  wrap.hidden = Boolean(new URLSearchParams(location.search).get('id'));
  wrap.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { selectedCategory = button.dataset.category; renderFilters(); renderNewsList(); }));
}
function renderNewsList() {
  const rows = selectedCategory === 'all' ? allNews : allNews.filter(item => item.category === selectedCategory);
  if (!rows.length) { newsContent.className = ''; newsContent.innerHTML = '<p class="news-state">ما في أخبار منشورة ضمن هالتصنيف حاليًا.</p>'; return; }
  newsContent.className = 'news-grid';
  newsContent.innerHTML = rows.map(item => {
    const image = safeImage(item.image_url);
    const excerpt = String(item.summary || '').length > 210 ? `${String(item.summary).slice(0,210)}…` : (item.summary || '');
    return `<article class="news-card">${image ? `<img src="${newsEsc(image)}" alt="صورة: ${newsEsc(item.title)}" loading="lazy">` : ''}<div class="news-card-body"><span class="news-category">${newsEsc(categoryLabel(item.category))}</span><h2>${newsEsc(item.title || 'خبر من البلدية')}</h2><p>${newsEsc(excerpt)}</p><time class="news-date">${newsEsc(newsDate(item.published_at))}</time><a class="news-link" href="news.html?id=${encodeURIComponent(item.id)}">قراءة الخبر كاملًا ←</a></div></article>`;
  }).join('');
}
async function renderNewsDetail(id) {
  document.getElementById('back-to-list').hidden = false;
  document.getElementById('page-title').textContent = 'تفاصيل الخبر';
  document.getElementById('page-description').hidden = true;
  document.getElementById('news-filters').hidden = true;
  const { data, error } = await newsDb.from('public_news').select('id,title,summary,category,image_url,published_at').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) { newsContent.className = ''; newsContent.innerHTML = '<p class="news-state">ما لقينا هالخبر، يمكن انحذف أو الرابط غير صحيح.</p>'; return; }
  document.title = `${data.title || 'خبر البلدية'} | بلديّتنا`;
  const image = safeImage(data.image_url);
  newsContent.className = '';
  newsContent.innerHTML = `<article class="news-detail">${image ? `<img src="${newsEsc(image)}" alt="صورة: ${newsEsc(data.title)}">` : ''}<div class="news-detail-body"><span class="news-category">${newsEsc(categoryLabel(data.category))}</span><h1>${newsEsc(data.title || 'خبر من البلدية')}</h1><time class="news-date">${newsEsc(newsDate(data.published_at))}</time><p>${newsEsc(data.summary || '')}</p></div></article>`;
}
async function startNewsPage() {
  if (!newsDb) throw new Error('تعذّر تشغيل مكتبة Supabase.');
  const id = new URLSearchParams(location.search).get('id');
  if (id) { await renderNewsDetail(id); return; }
  const { data, error } = await newsDb.from('public_news').select('id,title,summary,category,image_url,published_at').order('published_at', {ascending:false});
  if (error) throw error;
  allNews = data || [];
  renderFilters(); renderNewsList();
}
startNewsPage().catch(error => {
  console.error('Public news:', error);
  newsContent.className = '';
  newsContent.innerHTML = '<p class="news-state">ما قدرنا نحمّل الأخبار. تأكد من إعدادات Supabase وصلاحية قراءة الأخبار العامة.</p>';
});
