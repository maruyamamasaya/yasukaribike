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

async function saveCustomer(isDraft = false) {
  const note = document.getElementById('f-history-note').value.trim();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  let history = {};
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
    status: '未済',
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
});
