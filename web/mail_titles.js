const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function loadTitles() {
  let res;
  let data = {};
  try {
    res = await fetch(API + '/goobike-emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    return;
  }
  if (!res.ok) return;
  const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  const tbody = document.querySelector('#title-table tbody');
  tbody.innerHTML = '';
  items.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(m.subject || '')}</td><td>${escapeHtml(m.createdAt || '')}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('load-btn').addEventListener('click', loadTitles);
  loadTitles();
});
