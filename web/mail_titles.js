const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

let titles = [];
let sortKey = 'date';
let sortAsc = false;
let currentPage = 1;
const PAGE_SIZE = 20;
let filterMode = 'inbox';
let categoryFilter = 'all';

const NAME_MAP = {
  inbox: '受信ボックス',
  goobike: 'グーバイク',
  reserve_notice: '予約報告',
  tentative: '仮予約受付',
  answer_request: '回答依頼',
  skip: '見送りのお知らせ',
  additional: '追加連絡',
  sent: '送信ボックス'
};

async function loadTitles() {
  let res;
  let data = {};
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  try {
    res = await fetch(API + '/emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    if (spinner) spinner.style.display = 'none';
    return;
  }
  if (!res.ok) return;
  titles = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  createCategoryButtons();
  renderTable();
  if (spinner) spinner.style.display = 'none';
}

async function fetchEmails() {
  try {
    await fetch(API + '/api/fetch-all-emails');
  } catch (err) {
    console.error(err);
  }
}

function formatDateJST(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}

function renderTable(page = currentPage) {
  const tbody = document.querySelector('#title-table tbody');
  if (!tbody) return;

  let filtered = titles.filter(t =>
    filterMode === 'sent' ? t.category === 'sent' : t.category !== 'sent'
  );
  if (filterMode === 'inbox' && categoryFilter !== 'all') {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] || '';
    const bv = b[sortKey] || '';
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (sortAsc ? 1 : -1);
  });

  currentPage = page;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);
  slice.forEach(m => {
    const tr = document.createElement('tr');
    const link = `mail_detail.html?id=${encodeURIComponent(m.unique_id || '')}`;
    const bodyShort = (m.body || '').split('\n')[0].slice(0, 60);
    const dateText = formatDateJST(m.date);
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(dateText)}</a></td>
      <td>${escapeHtml(m.from || '')}</td>
      <td>${escapeHtml(bodyShort)}</td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || sorted.length === 0;

  document.querySelectorAll('th[data-key]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    icon.textContent = th.dataset.key === sortKey ? (sortAsc ? '▲' : '▼') : '';
  });
}

async function fetchAndLoad() {
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  await fetchEmails();
  await loadTitles();
  if (spinner) spinner.style.display = 'none';
}

function createCategoryButtons() {
  const container = document.getElementById('category-filters');
  if (!container) return;
  container.innerHTML = '';
  const categories = Array.from(
    new Set(
      titles
        .filter(t => t.category && t.category !== 'sent')
        .map(t => t.category)
    )
  ).sort();
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-outline-secondary active';
  allBtn.textContent = '全て';
  allBtn.dataset.cat = 'all';
  container.appendChild(allBtn);
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary';
    btn.dataset.cat = cat;
    btn.textContent = NAME_MAP[cat] || cat;
    container.appendChild(btn);
  });
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      categoryFilter = btn.dataset.cat;
      renderTable(1);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('load-btn').addEventListener('click', fetchAndLoad);
  document.getElementById('inbox-btn').addEventListener('click', () => {
    filterMode = 'inbox';
    categoryFilter = 'all';
    document.getElementById('inbox-btn').classList.add('active');
    document.getElementById('sent-btn').classList.remove('active');
    document.getElementById('category-filters').style.display = '';
    createCategoryButtons();
    renderTable(1);
  });
  document.getElementById('sent-btn').addEventListener('click', () => {
    filterMode = 'sent';
    document.getElementById('inbox-btn').classList.remove('active');
    document.getElementById('sent-btn').classList.add('active');
    document.getElementById('category-filters').style.display = 'none';
    renderTable(1);
  });
  document.querySelectorAll('th[data-key]').forEach(th => {
    const span = document.createElement('span');
    span.className = 'sort-icon';
    th.appendChild(span);
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      renderTable();
    });
  });
  loadTitles();
});

function nextPage() {
  renderTable(currentPage + 1);
}

function prevPage() {
  renderTable(currentPage - 1);
}
