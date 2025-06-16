const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function displayError(message) {
  const tbody = document.querySelector('#goobike-table tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${escapeHtml(message)}</td></tr>`;
}

async function loadEmails() {
  let res;
  let data = {};
  try {
    res = await fetch(API + '/goobike-emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    displayError('データの取得に失敗しました');
    return;
  }

  if (!res.ok) {
    const msg = data.error || data.message || res.statusText || 'Failed to fetch';
    console.error(msg);
    displayError(msg);
    return;
  }

  const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  const tbody = document.querySelector('#goobike-table tbody');
  tbody.innerHTML = '';

  if (!items.length) {
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.inquiry_id}</td>
      <td>${escapeHtml(item.name || '')}</td>
      <td>${escapeHtml(item.email || '')}</td>
      <td>${escapeHtml(item.phone || '')}</td>
      <td style="white-space:pre-wrap;">${escapeHtml(item.body || '')}</td>
      <td>${item.createdAt || ''}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fetch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('fetch-btn');
    btn.disabled = true;
    try {
      const res = await fetch(API + '/api/fetch-email');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || data.message || res.statusText || 'Failed to fetch';
        displayError(msg);
      }
    } catch (err) {
      console.error(err);
      displayError('メールの取得に失敗しました');
    }
    await loadEmails();
    btn.disabled = false;
  });
  loadEmails();
});
