const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

let titles = [];
let folderFilter = 'inbox';
let categoryFilter = 'all';
let categories = [];
let sortKey = 'date';
let sortAsc = false;
let currentPage = 1;
const PAGE_SIZE = 20;

const ACCOUNT_LABELS = {
  1: 'アカウント1',
  2: 'info@rebikele.com',
  3: 'kanamori@rebikele.com'
};

function updateAccountLabel() {
  const sel = document.getElementById('account-select');
  const label = document.getElementById('selected-account');
  if (!sel || !label) return;
  const val = sel.value;
  if (!val) {
    label.textContent = 'すべてのアカウント';
  } else {
    const name = ACCOUNT_LABELS[val] || `アカウント${val}`;
    label.textContent = name;
  }
}

async function loadCategories() {
  try {
    const sel = document.getElementById('account-select');
    const param = sel && sel.value ? `?account=${encodeURIComponent(sel.value)}` : '';
    const res = await fetch(API + '/categories' + param);
    const list = await res.json();
    if (!res.ok) return;
    categories = (Array.isArray(list) ? list : []).filter(c => (c.name || c) !== 'Sent');
    renderCategoryButtons();
  } catch (err) {
    console.error(err);
  }
}

function renderCategoryButtons() {
  const container = document.getElementById('category-buttons');
  if (!container) return;
  container.innerHTML = '';
  if (folderFilter === 'sent') {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'inline-flex';
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-outline-secondary btn-sm';
  if (categoryFilter === 'all') allBtn.classList.add('active');
  allBtn.textContent = 'すべて';
  allBtn.addEventListener('click', () => {
    categoryFilter = 'all';
    renderCategoryButtons();
    renderTable(1);
  });
  container.appendChild(allBtn);
  categories.forEach(cat => {
    const name = cat.name || cat;
    const label = name === 'inbox' ? '受信ボックス' : name;
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary btn-sm';
    if (categoryFilter === name) btn.classList.add('active');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      categoryFilter = name;
      renderCategoryButtons();
      renderTable(1);
    });
    container.appendChild(btn);
  });
}

async function loadTitles() {
  let res;
  let data = {};
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  try {
    const sel = document.getElementById('account-select');
    const param = sel && sel.value ? `?account=${encodeURIComponent(sel.value)}` : '';
    res = await fetch(API + '/emails' + param);
    data = await res.json();
  } catch (err) {
    console.error(err);
    if (spinner) spinner.style.display = 'none';
    return;
  }
  if (!res.ok) return;
  titles = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  renderTable();
  if (spinner) spinner.style.display = 'none';
}

async function fetchEmails() {
  try {
    const sel = document.getElementById('account-select');
    const param = sel && sel.value ? `?account=${encodeURIComponent(sel.value)}` : '';
    await fetch(API + '/api/fetch-all-emails' + param);
  } catch (err) {
    console.error(err);
  }
}

function formatDateJST(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `<span class="date-part">${y}/${m}/${day}</span><br><span class="time-part">${hh}時${mm}分</span>`;
}

function renderTable(page = currentPage) {
  const tbody = document.querySelector('#title-table tbody');
  if (!tbody) return;
  let filtered = titles.filter(m => {
    if (folderFilter === 'sent') return m.category === 'Sent';
    if (m.category === 'Sent') return false;
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    return true;
  });
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
    const subjectShort = (m.subject || '').slice(0, 60);
    const dateText = formatDateJST(m.date);
    tr.innerHTML = `
      <td><a href="${link}">${dateText}</a></td>
      <td>${escapeHtml(m.account || '')}</td>
      <td>${escapeHtml(m.from || '')}</td>
      <td>${escapeHtml(subjectShort)}</td>
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

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const acc = params.get('account');
  const sel = document.getElementById('account-select');
  if (acc && sel) sel.value = acc;
  const loadBtn = document.getElementById('load-btn');
  loadBtn.addEventListener('click', async () => {
    const original = loadBtn.textContent;
    loadBtn.disabled = true;
    loadBtn.textContent = '読み込み中...';
    await fetchAndLoad();
    loadBtn.textContent = '完了';
    setTimeout(() => {
      loadBtn.textContent = original;
      loadBtn.disabled = false;
    }, 1000);
  });
  document.getElementById('inbox-btn').addEventListener('click', () => {
    folderFilter = 'inbox';
    categoryFilter = 'all';
    renderCategoryButtons();
    renderTable(1);
  });
  document.getElementById('sent-btn').addEventListener('click', () => {
    folderFilter = 'sent';
    categoryFilter = 'all';
    renderCategoryButtons();
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
  loadCategories();
  updateAccountLabel();
  loadTitles();

  const sel = document.getElementById('account-select');
  if (sel) {
    sel.addEventListener('change', () => {
      updateAccountLabel();
      loadTitles();
    });
  }
});

function nextPage() {
  renderTable(currentPage + 1);
}

function prevPage() {
  renderTable(currentPage - 1);
}
