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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('q-bike').addEventListener('change', e => {
    document.getElementById('q-bike-model').style.display = e.target.value === 'あり' ? '' : 'none';
  });
  document.getElementById('q-use').addEventListener('change', e => {
    document.getElementById('q-use-other').style.display = e.target.value === 'その他' ? '' : 'none';
  });
  document.getElementById('f-email').addEventListener('input', sanitizeEmailInput);
  document.getElementById('f-phone').addEventListener('input', sanitizePhoneInput);
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(el => el.addEventListener('input', scheduleAutoSave));
  loadDraftIfNeeded();
});

async function saveCustomer(isDraft = false) {
  sanitizeEmailInput({ target: document.getElementById('f-email') });
  sanitizePhoneInput({ target: document.getElementById('f-phone') });

  const name = document.getElementById('f-name').value.trim() || '名前を入力してください';
  const kana = document.getElementById('f-kana').value;
  const email = document.getElementById('f-email').value.trim();
  const phone = document.getElementById('f-phone').value.trim();

  if (!kana) {
    alert('氏名カナは必須です');
    return;
  }
  if (!email) {
    alert('E-mailは必須です');
    return;
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    alert('メールアドレスが不正です');
    return;
  }
  if (phone && !/^[0-9]+$/.test(phone)) {
    alert('電話番号が不正です（数字のみ）');
    return;
  }

  const license = document.getElementById('f-license').value;
  const bike = document.getElementById('q-bike').value;
  const bikeModel = document.getElementById('q-bike-model').value.trim();
  const purchaseDate = document.getElementById('q-date').value;
  const budget = document.getElementById('q-budget').value.trim();
  const loan = document.getElementById('q-loan').value;
  const use = document.getElementById('q-use').value;
  const useOther = document.getElementById('q-use-other').value.trim();
  const visitPurpose = document.getElementById('q-visit-purpose').value;
  const request = document.getElementById('f-request').value.trim();

  const memoParts = [
    `免許種別: ${license}`,
    `現在所有のバイク車種: ${bike === 'あり' ? (bikeModel || 'あり') : 'なし'}`,
    purchaseDate ? `購入時期予定: ${purchaseDate}` : '',
    budget ? `購入予算: ${budget}` : '',
    `ローン希望確認: ${loan}`,
    `主な用途: ${use === 'その他' ? useOther : use}`,
    `ご来店用件: ${visitPurpose}`,
    request ? `ご要望・ご質問: ${request}` : ''
  ].filter(Boolean);
  const note = memoParts.join('\n');

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  let history = {};
  if (currentItem && currentItem.history) {
    history = { ...currentItem.history };
  }
  if (note) history[today] = note;

  const body = {
    name,
    kana,
    email,
    category: document.getElementById('f-category').value,
    phoneNumber: phone,
    details: '',
    staff: '',
    status: currentItem ? currentItem.status || '未着手' : '未着手',
    history,
    bikes: [],
    draft: isDraft
  };
  const idField = document.getElementById('f-order_id');
  const id = idField.value;

  let res;
  if (id) {
    res = await fetch(API + '/customers/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } else {
    res = await fetch(API + '/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.order_id) idField.value = data.order_id;
    }
  }

  if (!res.ok) {
    alert('送信に失敗しました');
    return;
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
  document.getElementById('f-category').value = item.category || item.type || '顧客WEB入力';
  document.getElementById('f-phone').value = item.phoneNumber || item.phone || '';
  // History note is not parsed back into fields
}
