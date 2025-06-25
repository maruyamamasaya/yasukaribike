// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentPage = 1;
const PAGE_SIZE = 20;
let searchResults = [];
let mailPage = 1;
const MAIL_PAGE_SIZE = 20;
let mailResults = [];
let mode = 'customer';
let searchTimeout;

function hasText(customer, keyword) {
  if ((customer.details || '').includes(keyword)) return true;
  if (customer.history) {
    for (const note of Object.values(customer.history)) {
      if (typeof note === 'string' && note.includes(keyword)) return true;
    }
  }
  return false;
}

function formatYMD(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function setMode(m) {
  mode = m;
  const cForm = document.getElementById('customer-form');
  const mForm = document.getElementById('mail-form');
  const cRes = document.getElementById('customer-results');
  const mRes = document.getElementById('mail-results');
  if (cForm && cRes) cForm.style.display = cRes.style.display = m === 'customer' ? '' : 'none';
  if (mForm && mRes) mForm.style.display = mRes.style.display = m === 'mail' ? '' : 'none';

  const btnC = document.getElementById('btn-customer');
  const btnM = document.getElementById('btn-mail');
  if (btnC && btnM) {
    if (m === 'customer') {
      btnC.classList.add('btn-primary');
      btnC.classList.remove('btn-outline-primary');
      btnM.classList.add('btn-outline-primary');
      btnM.classList.remove('btn-primary');
    } else {
      btnM.classList.add('btn-primary');
      btnM.classList.remove('btn-outline-primary');
      btnC.classList.add('btn-outline-primary');
      btnC.classList.remove('btn-primary');
    }
  }

  const headerToggle = document.getElementById('header-toggle');
  if (headerToggle) {
    headerToggle.textContent = m === 'customer' ? 'メール検索へ' : '問い合わせ検索へ';
  }
  triggerSearch();
}

function triggerSearch() {
  clearTimeout(searchTimeout);
  const spinner = document.getElementById(mode === 'customer' ? 'loading-customer' : 'loading-mail');
  if (spinner) spinner.style.display = 'block';
  searchTimeout = setTimeout(() => {
    if (mode === 'customer') searchCustomers(1);
    else searchEmails(1);
    if (spinner) spinner.style.display = 'none';
  }, 500);
}

async function searchCustomers(page = 1) {
  if (page === 1) {
    const dateInput = document.getElementById('s-date').value.trim();
    const date = dateInput ? dateInput.replace(/-/g, '/') : '';
    const name = document.getElementById('s-name').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const email = document.getElementById('s-email').value.trim();
    const status = document.getElementById('s-status').value.trim();
    const category = document.getElementById('s-category').value.trim();
    const details = document.getElementById('s-details').value.trim();
    const text = document.getElementById('s-text').value.trim();

    const res = await fetch(API + '/customers');
    const data = await res.json();
    let customers = (data.Items || data).filter(c => !c.draft);

    customers = customers.filter(c =>
      (!date || (c.date || '').includes(date)) &&
      (!name || (c.name || '').includes(name)) &&
      (!phone || (c.phone || c.phoneNumber || '').includes(phone)) &&
      (!email || (c.email || '').includes(email)) &&
      (!status || (c.status || '') === status) &&
      (!category || (c.category || c.type || '') === category) &&
      (!details || (c.details || '').includes(details)) &&
      (!text || hasText(c, text))
    );

    searchResults = customers;
  }

  currentPage = page;
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#result-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = searchResults.slice(start, start + PAGE_SIZE);
  slice.forEach(c => {
    const tr = document.createElement('tr');
    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = c.history[last] || '';
    }
    if (noteSnippet.length > 30) noteSnippet = noteSnippet.slice(0, 30) + '…';
    noteSnippet = noteSnippet.replace(/\n/g, '<br>');

    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.category || c.type || ''}</td>
      <td>${c.details || ''}</td>
      <td>${c.status || ''}</td>
      <td style="white-space: pre-wrap;">${noteSnippet}</td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || searchResults.length === 0;
}

function nextPage() {
  searchCustomers(currentPage + 1);
}

function prevPage() {
  searchCustomers(currentPage - 1);
}

async function searchEmails(page = 1) {
  if (page === 1) {
    const dateInput = document.getElementById('m-date').value.trim();
    const date = dateInput ? dateInput.replace(/-/g, '/') : '';
    const key = document.getElementById('m-key').value.trim();

    const res = await fetch(API + '/emails');
    const data = await res.json();
    let emails = Array.isArray(data.Items) ? data.Items : data;

    emails = emails.filter(e =>
      (!date || formatYMD(e.date || e.createdAt) === formatYMD(date)) &&
      (!key ||
        (e.from || '').includes(key) ||
        (e.to || '').includes(key) ||
        (e.subject || '').includes(key) ||
        (e.body || '').includes(key))
    );

    mailResults = emails;
  }

  mailPage = page;
  const total = Math.max(1, Math.ceil(mailResults.length / MAIL_PAGE_SIZE));
  if (mailPage > total) mailPage = total;
  if (mailPage < 1) mailPage = 1;

  const tbody = document.querySelector('#mail-result-table tbody');
  tbody.innerHTML = '';
  const start = (mailPage - 1) * MAIL_PAGE_SIZE;
  const slice = mailResults.slice(start, start + MAIL_PAGE_SIZE);
  slice.forEach(item => {
    const tr = document.createElement('tr');
    let body = item.body || '';
    if (body.length > 200) body = body.slice(0, 200) + '…';
    const d = item.date
      ? new Date(item.date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
      : '';
    tr.innerHTML = `
      <td>${d}</td>
      <td>${item.from || ''}</td>
      <td>${item.subject || ''}</td>
      <td style="white-space: pre-wrap;">${body}</td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('mail-page-info');
  if (info) info.textContent = `${mailPage} / ${total}`;
  const prev = document.getElementById('mail-prev-btn');
  const next = document.getElementById('mail-next-btn');
  if (prev) prev.disabled = mailPage === 1;
  if (next) next.disabled = mailPage === total || mailResults.length === 0;
}

function mailNextPage() {
  searchEmails(mailPage + 1);
}

function mailPrevPage() {
  searchEmails(mailPage - 1);
}

function searchAll() {
  triggerSearch();
}

document.addEventListener('DOMContentLoaded', () => {
  const btnC = document.getElementById('btn-customer');
  const btnM = document.getElementById('btn-mail');
  const headerToggle = document.getElementById('header-toggle');
  if (btnC) btnC.addEventListener('click', () => setMode('customer'));
  if (btnM) btnM.addEventListener('click', () => setMode('mail'));
  if (headerToggle) headerToggle.addEventListener('click', () => setMode(mode === 'customer' ? 'mail' : 'customer'));

  const btnSearchC = document.getElementById('customer-search-btn');
  const btnSearchM = document.getElementById('mail-search-btn');
  if (btnSearchC) btnSearchC.addEventListener('click', triggerSearch);
  if (btnSearchM) btnSearchM.addEventListener('click', triggerSearch);

  document.querySelectorAll('#customer-form input,#customer-form select').forEach(el => {
    el.addEventListener('input', triggerSearch);
  });
  document.querySelectorAll('#mail-form input').forEach(el => {
    el.addEventListener('input', triggerSearch);
  });

  setMode('customer');
});
