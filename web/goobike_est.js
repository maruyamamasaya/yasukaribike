const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function getCategory() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category');
}

function renderList(groups) {
  const container = document.getElementById('est-container');
  container.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'list-group';
  Object.keys(groups).forEach(cat => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = cat;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

function renderTable(items, title) {
  const container = document.getElementById('est-container');
  container.innerHTML = '';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  container.appendChild(h2);
  const table = document.createElement('table');
  table.className = 'table table-striped';
  table.innerHTML = `
    <thead><tr>
      <th>受信日時</th>
      <th>タイトル</th>
      <th>本文</th>
    </tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');
  items.forEach(m => {
    const tr = document.createElement('tr');
    const date = m.date ? new Date(m.date).toLocaleString() : '';
    let bodySnippet = m.body || '';
    if (bodySnippet.length > 200) bodySnippet = bodySnippet.slice(0, 200) + '…';
    tr.innerHTML = `<td>${escapeHtml(date)}</td><td>${escapeHtml(m.subject)}</td><td style="white-space:pre-wrap;">${escapeHtml(bodySnippet)}</td>`;
    tbody.appendChild(tr);
  });
  container.appendChild(table);
}

async function loadEmails() {
  const btn = document.getElementById('fetch-btn');
  if (btn) btn.disabled = true;
  const container = document.getElementById('est-container');
  container.innerHTML = '<p>Loading...</p>';
  try {
    const res = await fetch(API + '/api/fetch-goobike-est-all');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const groups = {};
    emails.forEach(e => { (groups[e.category] = groups[e.category] || []).push(e); });
    const cat = getCategory();
    if (!cat) {
      renderList(groups);
    } else {
      renderTable(groups[cat] || [], cat);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="text-danger">メールの取得に失敗しました</p>';
  }
  if (btn) btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('fetch-btn');
  if (btn) btn.addEventListener('click', loadEmails);
});
