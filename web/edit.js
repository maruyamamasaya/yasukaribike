const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentItem = null;

async function loadCustomer() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  const res = await fetch(API + '/customers/' + id);
  if (!res.ok) return;
  const data = await res.json();
  const item = data.Item || data;
  currentItem = item;

  document.getElementById('f-order_id').value = item.order_id;
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-kana').value = item.kana || '';
  document.getElementById('f-email').value = item.email || '';
  document.getElementById('f-category').value = item.category || item.type || '電話';
  document.getElementById('f-phone').value = item.phoneNumber || item.phone || '';
  document.getElementById('f-details').value = item.details || '';
  document.getElementById('f-status').value = item.status || '未済';
  document.getElementById('f-staff').value = item.staff || '';
  const noteField = document.getElementById('f-history-note');
  const hv = document.getElementById('history-view');
  noteField.value = '';
  hv.innerHTML = '';
  if (item.history) {
    const entries = Object.entries(item.history).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length) {
      noteField.value = entries[entries.length - 1][1];
    }
    entries.forEach(([d, n]) => {
      const div = document.createElement('div');
      div.style.whiteSpace = 'pre-wrap';
      div.textContent = `${d}: ${n}`;
      hv.appendChild(div);
    });
  }
}

async function saveCustomer() {
  const id = document.getElementById('f-order_id').value;
  const note = document.getElementById('f-history-note').value.trim();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  let history = {};
  if (id && currentItem && currentItem.history) {
    history = { ...currentItem.history };
  }
  if (note) {
    history[today] = note;
  }

  const body = {
    name: document.getElementById('f-name').value,
    kana: document.getElementById('f-kana').value,
    email: document.getElementById('f-email').value,
    category: document.getElementById('f-category').value,
    phoneNumber: document.getElementById('f-phone').value,
    details: document.getElementById('f-details').value,
    staff: document.getElementById('f-staff').value,
    status: document.getElementById('f-status').value || '未済',
    history,
    bikes: []
  };

  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  window.location.href = 'all.html';
}

window.addEventListener('DOMContentLoaded', loadCustomer);
