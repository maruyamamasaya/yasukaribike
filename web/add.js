const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function toHalfWidth(str) {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

function sanitizeEmailInput(e) {
  e.target.value = toHalfWidth(e.target.value);
}

function sanitizePhoneInput(e) {
  e.target.value = toHalfWidth(e.target.value).replace(/-/g, '');
}

let autoSaveTimer = null;
let currentItem = null;

function showStatus(message) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

async function saveCustomer(isDraft = false) {
  const note = document.getElementById('f-history-note').value.trim();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  let history = {};
  if (currentItem && currentItem.history) {
    history = { ...currentItem.history };
  }
  if (note) {
    history[today] = note;
  }

  sanitizeEmailInput({ target: document.getElementById('f-email') });
  sanitizePhoneInput({ target: document.getElementById('f-phone') });

  const email = document.getElementById('f-email').value.trim();
  const phone = document.getElementById('f-phone').value.trim();

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    alert('メールアドレスが不正です');
    return;
  }
  if (phone && !/^[0-9]+$/.test(phone)) {
    alert('電話番号が不正です（数字のみ）');
    return;
  }

  const body = {
    name: document.getElementById('f-name').value,
    kana: document.getElementById('f-kana').value,
    email,
    category: document.getElementById('f-category').value,
    phoneNumber: phone,
    details: document.getElementById('f-details').value,
    staff: document.getElementById('f-staff').value,
    status: currentItem ? currentItem.status || '未済' : '未済',
    history,
    bikes: [],
    draft: isDraft
  };
  const idField = document.getElementById('f-order_id');
  const id = idField.value;

  if (id) {
    await fetch(API + '/customers/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } else {
    const res = await fetch(API + '/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.order_id) idField.value = data.order_id;
    }
  }
  if (isDraft) {
    showStatus('一時保存しました');
  }
  if (!isDraft) {
    window.location.href = 'index.html';
  }
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveCustomer(true), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-email').addEventListener('input', sanitizeEmailInput);
  document.getElementById('f-phone').addEventListener('input', sanitizePhoneInput);
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(el => el.addEventListener('input', scheduleAutoSave));
  loadDraftIfNeeded();
});

async function loadDraftIfNeeded() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;
  const res = await fetch(API + '/customers/' + id);
  if (!res.ok) return;
  const data = await res.json();
  const item = data.Item || data;
  currentItem = item;

  document.getElementById('f-order_id').value = item.order_id || '';
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-kana').value = item.kana || '';
  document.getElementById('f-email').value = item.email || '';
  document.getElementById('f-category').value = item.category || item.type || '電話';
  document.getElementById('f-phone').value = item.phoneNumber || item.phone || '';
  document.getElementById('f-details').value = item.details || '';
  document.getElementById('f-staff').value = item.staff || '';
  const noteField = document.getElementById('f-history-note');
  noteField.value = '';
  if (item.history) {
    const entries = Object.entries(item.history).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length) {
      noteField.value = entries[entries.length - 1][1];
    }
  }
}
