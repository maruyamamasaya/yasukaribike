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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}時${mm}分`;
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
    const btnLabel = item.task_added ? '追加済み' : 'タスクに追加';
    const disabled = item.task_added ? 'disabled' : '';
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(dateText)}</a></td>
      <td>${escapeHtml(item.from || '')}</td>
      <td>${escapeHtml(item.subject || '')}</td>
      <td style="white-space:pre-wrap; width:40%;">${escapeHtml(bodySnippet)}</td>
      <td><button class="btn btn-sm btn-primary" onclick="addTask('${item.unique_id}')" ${disabled}>${btnLabel}</button></td>`;
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

async function addTask(id) {
  if (!id) return;
  const res = await fetch(API + `/emails/${encodeURIComponent(id)}/add-task`, {
    method: 'POST'
  });
  if (res.ok) {
    loadEmails(currentPage);
  } else {
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
