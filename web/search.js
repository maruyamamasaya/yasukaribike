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
let totalEmailCount = 0; // 総メール件数
let mailSortDescending = true;
let searchTimeout;
let globalKey = '';

function updateFilterState(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const details = input.closest('details');
  if (!details) return;
  const summary = details.querySelector('summary');
  const clear = details.querySelector('.clear-filter');
  const val = input.value.trim();
  if (val) {
    summary.classList.add('active', 'btn-primary');
    summary.classList.remove('btn-outline-secondary');
    if (clear) clear.style.display = '';
  } else {
    summary.classList.remove('active', 'btn-primary');
    summary.classList.add('btn-outline-secondary');
    if (clear) clear.style.display = 'none';
  }
}

function setupFilter(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const details = input.closest('details');
  const clear = details.querySelector('.clear-filter');
  input.addEventListener('input', () => {
    updateFilterState(id);
    triggerSearch();
  });
  if (clear) {
    clear.addEventListener('click', () => {
      input.value = '';
      updateFilterState(id);
      triggerSearch();
    });
  }
  updateFilterState(id);
}

function hasText(customer, keyword) {
  if ((customer.details || '').includes(keyword)) return true;
  if (customer.history) {
    for (const note of Object.values(customer.history)) {
      if (typeof note === 'string' && note.includes(keyword)) return true;
    }
  }
  return false;
}

function matchesGlobalCustomer(c, key) {
  if (!key) return true;
  const props = [c.order_id, c.status, c.email, c.name, c.kana, c.category || c.type, c.details, c.date, c.staff, c.phone, c.phoneNumber];
  for (const p of props) {
    if (p && String(p).includes(key)) return true;
  }
  return hasText(c, key);
}

function matchesGlobalEmail(e, key) {
  if (!key) return true;
  const props = [e.from, e.to, e.subject, e.body, e.folder, e.category];
  for (const p of props) {
    if (p && String(p).includes(key)) return true;
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

function getEmailTimeValue(item) {
  const d = item.date || item.createdAt;
  return d ? new Date(d).getTime() : 0;
}


function triggerSearch() {
  clearTimeout(searchTimeout);
  const spinnerC = document.getElementById('loading-customer');
  const spinnerM = document.getElementById('loading-mail');
  if (spinnerC) spinnerC.style.display = 'block';
  if (spinnerM) spinnerM.style.display = 'block';
  searchTimeout = setTimeout(() => {
    searchCustomers(1);
    searchEmails(1);
    if (spinnerC) spinnerC.style.display = 'none';
    if (spinnerM) spinnerM.style.display = 'none';
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
      (!name || (c.name || '').includes(name) || (c.kana || '').includes(name)) &&
      (!phone || (c.phone || c.phoneNumber || '').includes(phone)) &&
      (!email || (c.email || '').includes(email)) &&
      (!status || (c.status || '') === status) &&
      (!category || (c.category || c.type || '') === category) &&
      (!details || (c.details || '').includes(details)) &&
      (!text || hasText(c, text)) &&
      matchesGlobalCustomer(c, globalKey)
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
  const ccount = document.getElementById('customer-count');
  if (ccount) ccount.textContent = `【${slice.length}件／${searchResults.length}件中】`;
}

function nextPage() {
  searchCustomers(currentPage + 1);
}

function prevPage() {
  searchCustomers(currentPage - 1);
}

async function searchEmails(page = 1, refresh = false) {
  if (page === 1 || refresh) {
    const dateInput = document.getElementById('m-date').value.trim();
    const date = dateInput ? dateInput.replace(/-/g, '/') : '';
    const key = document.getElementById('m-key').value.trim();

    const res = await fetch(API + '/emails');
    const data = await res.json();
    let emails = Array.isArray(data.Items) ? data.Items : data;
    totalEmailCount = emails.length;

    emails = emails.filter(e =>
      (!date || formatYMD(e.date || e.createdAt) === formatYMD(date)) &&
      (!key ||
        (e.from || '').includes(key) ||
        (e.to || '').includes(key) ||
        (e.subject || '').includes(key) ||
        (e.body || '').includes(key)) &&
      matchesGlobalEmail(e, globalKey)
    );

    emails.sort((a, b) =>
      mailSortDescending
        ? getEmailTimeValue(b) - getEmailTimeValue(a)
        : getEmailTimeValue(a) - getEmailTimeValue(b)
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
      ? new Date(item.date).toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour12: false,
        })
      : '';
    const link = `mail_detail.html?id=${encodeURIComponent(item.unique_id || '')}`;
    const btnLabel = item.task_added ? '追加済み' : 'ボードに追加';
    const btnClass = item.task_added ? 'btn btn-sm btn-success' : 'btn btn-sm btn-primary';
    tr.innerHTML = `
      <td><a href="${link}">${d}</a></td>
      <td>${item.from || ''}</td>
      <td>${item.subject || ''}</td>
      <td style="white-space: pre-wrap;">${body}</td>
      <td><button class="${btnClass}" onclick="addTask('${item.unique_id}')" data-added="${item.task_added ? '1' : '0'}">${btnLabel}</button></td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('mail-page-info');
  if (info) info.textContent = `${mailPage} / ${total}`;
  const prev = document.getElementById('mail-prev-btn');
  const next = document.getElementById('mail-next-btn');
  if (prev) prev.disabled = mailPage === 1;
  if (next) next.disabled = mailPage === total || mailResults.length === 0;
  const mcount = document.getElementById('mail-count');
  if (mcount) mcount.textContent = `【${mailResults.length}件／${totalEmailCount}件中】`;
}

function mailNextPage() {
  searchEmails(mailPage + 1);
}

function mailPrevPage() {
  searchEmails(mailPage - 1);
}

async function addTask(id) {
  if (!id) return;
  const item = mailResults.find(e => e.unique_id === id);
  if (item && item.task_added) {
    const ok = confirm('再度追加しますか？\n前回追加済みの場合は、タスクが重複する恐れがあります。');
    if (!ok) return;
  }
  const res = await fetch(API + `/emails/${encodeURIComponent(id)}/add-task`, {
    method: 'POST'
  });
  if (res.ok) {
    searchEmails(mailPage, true);
  } else {
    alert('タスク追加に失敗しました');
  }
}

function searchAll() {
  triggerSearch();
}

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('details.static').forEach(d => {
    const s = d.querySelector('summary');
    if (s) s.addEventListener('click', e => e.preventDefault());
    d.open = true;
  });
  [
    's-date','s-name','s-phone','s-email','s-status','s-category','s-details','s-text',
    'm-date','m-key'
  ].forEach(setupFilter);
  const g = document.getElementById('all-key');
  if (g) g.addEventListener('input', () => { globalKey = g.value.trim(); triggerSearch(); });

  const mailHeader = document.getElementById('mail-date-header');
  if (mailHeader) mailHeader.addEventListener('click', () => {
    mailSortDescending = !mailSortDescending;
    searchEmails(mailPage, true);
  });

  searchCustomers(1);
  searchEmails(1);
});
