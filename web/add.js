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

async function saveCustomer() {
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
    bikes: []
  };

  await fetch(API + '/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-email').addEventListener('input', sanitizeEmailInput);
  document.getElementById('f-phone').addEventListener('input', sanitizePhoneInput);
});
