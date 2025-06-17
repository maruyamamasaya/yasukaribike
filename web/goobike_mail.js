const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let sortDescending = true;
let currentPage = 1;
const PAGE_SIZE = 20;

function getCategory() {
  const params = new URLSearchParams(window.location.search);
  return params.get('cat');
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function getKey(item) {
  return item.createdAt || '';
}

function hasText(item, keyword) {
  return (item.body || '').includes(keyword);
}

function formatDateJST(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}

async function fetchData() {
  let res;
  let data = {};
  try {
    res = await fetch(API + '/emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
  if (!res.ok) return [];
  const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  return items;
}

async function loadEmails(page = 1) {
  currentPage = page;
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  let items = await fetchData();
  if (spinner) spinner.style.display = 'none';
  const cat = getCategory();
  if (cat) items = items.filter(i => i.category === cat);

  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  const keyword = qEl ? qEl.value.trim() : '';
  const textKey = tEl ? tEl.value.trim() : '';
  if (keyword) {
    items = items.filter(i =>
      (i.from || '').includes(keyword) ||
      (i.to || '').includes(keyword) ||
      (i.subject || '').includes(keyword)
    );
  }
  if (textKey) {
    items = items.filter(i => hasText(i, textKey));
  }

  items.sort((a, b) =>
    sortDescending ? getKey(b).localeCompare(getKey(a)) : getKey(a).localeCompare(getKey(b))
  );

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#mail-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

  slice.forEach(item => {
    const tr = document.createElement('tr');
    let bodySnippet = item.body || '';
    if (bodySnippet.length > 500) bodySnippet = bodySnippet.slice(0, 500) + '…';
    const link = `mail_detail.html?id=${encodeURIComponent(item.unique_id || '')}`;
    const dateText = formatDateJST(item.date || item.createdAt);
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(dateText)}</a></td>
      <td>${escapeHtml(item.from || '')}</td>
      <td>${escapeHtml(item.subject || '')}</td>
      <td style="white-space:pre-wrap; width:40%;">${escapeHtml(bodySnippet)}</td>`;
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'タスクに追加';
    btn.className = 'btn btn-sm btn-outline-primary';
    if (item.taskAdded) btn.disabled = true;
    btn.addEventListener('click', () => addTaskFromEmail(item, btn));
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || items.length === 0;
}

function nextPage() {
  loadEmails(currentPage + 1);
}

function prevPage() {
  loadEmails(currentPage - 1);
}

async function addTaskFromEmail(item, btn) {
  if (!confirm('このメールをタスクに追加しますか？')) return;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
    .replace(/-/g, '/');
  const history = {};
  history[today] = item.body || '';
  const body = {
    email: item.from || '',
    category: 'メール問い合わせ',
    date: today,
    history
  };
  try {
    const res = await fetch(API + '/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('failed to create task');
    const res2 = await fetch(API + '/emails/' + encodeURIComponent(item.unique_id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskAdded: true })
    });
    if (!res2.ok) throw new Error('failed to update email');
    btn.disabled = true;
  } catch (e) {
    console.error(e);
    alert('タスク追加に失敗しました');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('date-header').addEventListener('click', () => {
    sortDescending = !sortDescending;
    loadEmails();
  });
  document.getElementById('quick-search').addEventListener('input', () => loadEmails(1));
  document.getElementById('text-search').addEventListener('input', () => loadEmails(1));
  loadEmails();
});
