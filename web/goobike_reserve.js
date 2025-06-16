const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function loadEmails() {
  const btn = document.getElementById('fetch-btn');
  if (btn) btn.disabled = true;
  const container = document.getElementById('reserve-list');
  container.innerHTML = '<p>Loading...</p>';
  try {
    const res = await fetch(API + '/api/fetch-goobike-reserve-all');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const groups = {};
    emails.forEach(e => {
      (groups[e.category] = groups[e.category] || []).push(e);
    });
    container.innerHTML = '';
    Object.keys(groups).forEach(cat => {
      const h3 = document.createElement('h3');
      h3.textContent = cat;
      container.appendChild(h3);
      groups[cat].forEach(m => {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        const date = m.date ? new Date(m.date).toLocaleString() : '';
        card.innerHTML = `<div class="card-header">${escapeHtml(m.subject || '')}</div>
<div class="card-body"><div class="mb-2 text-muted">${escapeHtml(date)}</div><pre class="mb-0" style="white-space:pre-wrap;">${escapeHtml(m.body || '')}</pre></div>`;
        container.appendChild(card);
      });
    });
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
