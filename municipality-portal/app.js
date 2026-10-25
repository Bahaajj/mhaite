
/* =========================================
   MUNICIPALITY PORTAL - HOME PAGE
   ========================================= */

const SITE_CONFIG = {
  municipalityName: 'المحيدثة',
  address: 'مبنى البلدية - المحيدثة - راشيا الوادي - البقاع - لبنان',
  phone: '110 561 28',
  email: 'info@example.com',

  supabaseUrl: 'https://pbqnrxpvosnlqujeeshd.supabase.co',
  supabaseAnonKey: 'sb_publishable_67AmM4fHGg3yXrJG4MusiA_ctG996Ff'
};

// Initialize Supabase
const backendReady =
  SITE_CONFIG.supabaseUrl.startsWith('https://') &&
  SITE_CONFIG.supabaseAnonKey.startsWith('sb_publishable_');

const db =
  backendReady && window.supabase
    ? window.supabase.createClient(
        SITE_CONFIG.supabaseUrl,
        SITE_CONFIG.supabaseAnonKey
      )
    : null;

// Helpers
const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

let toastTimer;

function toast(message) {
  const node = $('#toast');

  if (!node) return;

  node.textContent = message;
  node.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    node.classList.remove('show');
  }, 4200);
}

function setStatus(form, message, error = false) {
  const node = $('.form-status', form);

  if (!node) return;

  node.textContent = message;
  node.classList.toggle('error', error);
}

function setBusy(form, busy) {
  const button = $('button[type="submit"]', form);

  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = busy;
  button.textContent = busy
    ? 'عم نرسل...'
    : button.dataset.originalText;
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

// Municipality information
$$('[data-municipality]').forEach(node => {
  node.textContent = SITE_CONFIG.municipalityName;
});

const addressNode = $('[data-address]');
const phoneNode = $('[data-phone]');
const emailNode = $('[data-email]');
const yearNode = $('#year');

if (addressNode) addressNode.textContent = SITE_CONFIG.address;
if (phoneNode) phoneNode.textContent = SITE_CONFIG.phone;
if (emailNode) emailNode.textContent = SITE_CONFIG.email;
if (yearNode) yearNode.textContent = new Date().getFullYear();

// Open citizen request / complaint dialog
function showDialog(kind) {
  const dialog = $('#service-dialog');
  const form = $('#service-form');

  if (!dialog || !form) {
    console.error('Service dialog or form is missing from HTML.');
    return;
  }

  form.reset();
  setStatus(form, '');

  const isRequest = kind === 'request';

  $('#service-kind').value = kind;

  $('#modal-title').textContent = isRequest
    ? 'تقديم طلب معاملة'
    : 'شكوى أو ملاحظة';

  $('#modal-description').textContent = isRequest
    ? 'املأ البيانات بدقة. رح يصلك رقم مرجعي بعد الإرسال.'
    : 'شاركنا ملاحظتك، ورح يتابعها الفريق المختص.';

  $('#request-fields').hidden = !isRequest;
  $('#complaint-fields').hidden = isRequest;

  $('select[name="request_type"]', form).required = isRequest;
  $('textarea[name="details"]', form).required = isRequest;

  $('select[name="complaint_type"]', form).required = !isRequest;
  $('textarea[name="complaint_message"]', form).required = !isRequest;

  if (!dialog.open) {
    dialog.showModal();
  }
}

$$('[data-open-form]').forEach(button => {
  button.addEventListener('click', () => {
    showDialog(button.dataset.openForm);
  });
});

const modalClose = $('#modal-close');
const serviceDialog = $('#service-dialog');

if (modalClose && serviceDialog) {
  modalClose.addEventListener('click', () => {
    serviceDialog.close();
  });

  serviceDialog.addEventListener('click', event => {
    if (event.target === serviceDialog) {
      serviceDialog.close();
    }
  });
}

// Mobile navigation
const menuToggle = $('#menu-toggle');
const mainNav = $('#main-nav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
  });

  $$('#main-nav a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
    });
  });
}

// Upload attachments to Supabase Storage

async function uploadFiles(files, requestId) {
  if (!files?.length) return [];

  if (!db) {
    throw new Error('تعذّر الاتصال بقاعدة البيانات.');
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ];

  const output = [];

  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        'نوع الملف غير مسموح. استخدم PDF أو JPG أو PNG.'
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error(
        'حجم كل ملف يجب أن يكون أقل من 5MB.'
      );
    }

    
const safeName = file.name
  .replace(/\.[^.]+$/, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .slice(-60);

const extension = file.name.split('.').pop().toLowerCase();
const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

if (!allowedExtensions.includes(extension)) {
  throw new Error('امتداد الملف غير مسموح.');
}

const path = `${createId()}.${extension}`;


    const { data, error } = await db.storage
      .from('request-files')
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', {
        message: error.message,
        name: error.name,
        statusCode: error.statusCode
      });

      throw new Error(
        `فشل رفع الملف: ${error.message}`
      );
    }

    output.push({
      path: data.path,
      name: file.name,
      size: file.size,
      type: file.type
    });
  }

  return output;
}


// Submit citizen request or complaint
const serviceForm = $('#service-form');

if (serviceForm) {
  
/* =========================================
   CITIZEN SUBMISSION + MUN REFERENCE DIALOG
   ========================================= */

// Create the reference dialog using JavaScript
if (!document.querySelector('#reference-dialog')) {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="reference-dialog" class="reference-dialog" dir="rtl">
      <div class="reference-content">
        <div class="reference-check">✓</div>
        <h2>تم إرسال طلبك بنجاح</h2>
        <p>احتفظ برقم الطلب لتتمكّن من متابعة معاملتك.</p>

        <div id="reference-code-display" class="reference-code"></div>

        <button type="button" id="copy-reference" class="reference-copy">
          نسخ رقم الطلب
        </button>

        <p id="copy-message" class="copy-message"></p>

        <button type="button" id="close-reference" class="reference-close">
          إغلاق
        </button>
      </div>
    </dialog>
  `);
}

const referenceDialog = document.querySelector('#reference-dialog');
const referenceDisplay = document.querySelector('#reference-code-display');
const copyReferenceButton = document.querySelector('#copy-reference');
const copyMessage = document.querySelector('#copy-message');
const closeReferenceButton = document.querySelector('#close-reference');

// Display the actual MUN code returned by Supabase
function showReferenceDialog(referenceCode) {
  referenceDisplay.textContent = referenceCode;
  copyMessage.textContent = '';

  if (!referenceDialog.open) {
    referenceDialog.showModal();
  }
}

// Copy reference code
copyReferenceButton.addEventListener('click', async () => {
  const code = referenceDisplay.textContent.trim();

  try {
    await navigator.clipboard.writeText(code);
    copyMessage.textContent = 'تم نسخ رقم الطلب بنجاح ✓';
  } catch (error) {
    const range = document.createRange();
    range.selectNodeContents(referenceDisplay);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    copyMessage.textContent =
      'حدّدنا الرقم. اضغط Ctrl+C لنسخه.';
  }
});

// Close reference dialog
closeReferenceButton.addEventListener('click', () => {
  referenceDialog.close();
});

// Submit citizen request or complaint
const serviceForm = document.querySelector('#service-form');

if (serviceForm) {
  serviceForm.addEventListener('submit', async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const kind = formData.get('kind');

    if (!db) {
      setStatus(
        form,
        'تعذّر الاتصال بـ Supabase. تأكّد من الإعدادات.',
        true
      );
      return;
    }

    const record = {
      kind,
      full_name: String(formData.get('full_name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim() || null,
      status: 'new'
    };

    if (kind === 'request') {
      record.request_type = formData.get('request_type');
      record.details = String(formData.get('details') || '').trim();
      record.complaint_type = null;
      record.location = null;
    } else if (kind === 'complaint') {
      record.request_type = null;
      record.complaint_type = formData.get('complaint_type');
      record.details = String(
        formData.get('complaint_message') || ''
      ).trim();
      record.location = String(
        formData.get('location') || ''
      ).trim() || null;
    } else {
      setStatus(form, 'نوع الطلب غير صحيح.', true);
      return;
    }

    setBusy(form, true);
    setStatus(form, '');

    try {
      // Upload attachments first
      const requestId = createId();

      const files = await uploadFiles(
        formData.getAll('attachments').filter(
          file => file instanceof File && file.size > 0
        ),
        requestId
      );

      // Submit through the Supabase function.
      // It returns the database-generated MUN reference code.
      const { data: referenceCode, error: saveError } = await db.rpc(
        'submit_citizen_submission',
        {
          p_kind: record.kind,
          p_full_name: record.full_name,
          p_phone: record.phone,
          p_email: record.email,
          p_request_type: record.request_type ?? null,
          p_complaint_type: record.complaint_type ?? null,
          p_details: record.details,
          p_location: record.location ?? null,
          p_attachments: files
        }
      );

      if (saveError) throw saveError;

      if (
        typeof referenceCode !== 'string' ||
        !referenceCode.startsWith('MUN-')
      ) {
        throw new Error(
          'ما وصلنا رقم MUN الصحيح من قاعدة البيانات.'
        );
      }

      // Clear the form and show the real reference code
      form.reset();
      setStatus(form, 'تم إرسال الطلب بنجاح.');
      showReferenceDialog(referenceCode);

    } catch (error) {
      console.error('Submission error:', error);

      setStatus(
        form,
        error.message || 'ما قدرنا نرسل الطلب. جرّب مرة تانية.',
        true
      );

    } finally {
      setBusy(form, false);
    }
  });
}

}

// Submit contact message
const contactForm = $('#contact-form');

if (contactForm) {
  contactForm.addEventListener('submit', async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    if (!db) {
      setStatus(
        form,
        'تعذّر الاتصال بـ Supabase. تأكّد من الإعدادات.',
        true
      );
      return;
    }

    setBusy(form, true);
    setStatus(form, '');

    try {
      const { error } = await db
        .from('citizen_messages')
        .insert({
          name: String(data.get('name') || '').trim(),
          email: String(data.get('email') || '').trim() || null,
          phone: String(data.get('phone') || '').trim() || null,
          message: String(data.get('message') || '').trim()
        });

      if (error) throw error;

      setStatus(
        form,
        'وصلتنا رسالتك، شكراً لتواصلك معنا.'
      );

      toast('تم إرسال رسالتك بنجاح.');
      form.reset();

    } catch (error) {
      console.error('Contact form error:', error);

      setStatus(
        form,
        'ما قدرنا نرسل الرسالة. جرّب مرة تانية.',
        true
      );

    } finally {
      setBusy(form, false);
    }
  });
}

// Escape HTML before displaying database content
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// Load latest public news

async function loadNews() {
  const list = $('#news-list');

  if (!list || !db) return;

  try {
    const { data, error } = await db
      .from('public_news')
      .select('id, title, summary, image_url, category, published_at')
      .order('published_at', { ascending: false })
      .limit(3);

    if (error) throw error;

    if (!data?.length) {
      list.innerHTML =
        '<p class="muted">ما في أخبار منشورة حالياً.</p>';
      return;
    }

    list.innerHTML = data.map(item => {
      const date = item.published_at
        ? new Date(item.published_at).toLocaleDateString('ar-LB')
        : '';

      const imageUrl = item.image_url
        ? String(item.image_url)
        : '';

      const imageHtml = imageUrl
        ? `<img
             src="${escapeHtml(imageUrl)}"
             alt="${escapeHtml(item.title || 'صورة الخبر')}"
             class="news-card-real-image"
             loading="lazy"
           >`
        : '';

      return `
        <article class="news-card">
          ${imageHtml}

          <div class="news-card-body">
            <span class="news-date">
              ${escapeHtml(date)}
            </span>

            <h3>${escapeHtml(item.title)}</h3>

            <p>${escapeHtml(item.summary || '')}</p>
          </div>
        </article>
      `;
    }).join('');

  } catch (error) {
    console.error('News loading error:', error);

    list.innerHTML =
      '<p class="muted">تعذّر تحميل الأخبار حالياً.</p>';
  }
}


// Start
if (!db) {
  console.error(
    'Supabase is not initialized. Check the project URL, publishable key, and Supabase CDN script.'
  );
}

loadNews();
