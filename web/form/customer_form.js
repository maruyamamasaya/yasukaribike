const API = window.location.origin;

function toHalfWidth(str) {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

function sanitizeEmailInput(e) {
  e.target.value = toHalfWidth(e.target.value);
}

function sanitizePhoneInput(e) {
  e.target.value = toHalfWidth(e.target.value).replace(/-/g, '');
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
});

async function submitForm() {
  sanitizeEmailInput({ target: document.getElementById('f-email') });
  sanitizePhoneInput({ target: document.getElementById('f-phone') });

  const name = document.getElementById('f-name').value.trim() || '名前を入力してください';
  const kana = document.getElementById('f-kana').value;
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

  const license = document.getElementById('f-license').value;
  const bike = document.getElementById('q-bike').value;
  const bikeModel = document.getElementById('q-bike-model').value.trim();
  const purchaseDate = document.getElementById('q-date').value;
  const budget = document.getElementById('q-budget').value.trim();
  const loan = document.getElementById('q-loan').value;
  const use = document.getElementById('q-use').value;
  const useOther = document.getElementById('q-use-other').value.trim();
  const request = document.getElementById('f-request').value.trim();

  const memoParts = [
    `免許種別: ${license}`,
    `現在所有のバイク車種: ${bike === 'あり' ? (bikeModel || 'あり') : 'なし'}`,
    purchaseDate ? `購入時期予定: ${purchaseDate}` : '',
    budget ? `購入予算: ${budget}` : '',
    `ローン希望確認: ${loan}`,
    `主な用途: ${use === 'その他' ? useOther : use}`,
    request ? `ご要望・ご質問: ${request}` : ''
  ].filter(Boolean);
  const note = memoParts.join('\n');

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  const history = {};
  if (note) history[now] = note;

  const body = {
    name,
    kana,
    email,
    category: document.getElementById('f-category').value,
    phoneNumber: phone,
    details: '',
    staff: '',
    status: '未着手',
    history,
    bikes: [],
    draft: false
  };

  const res = await fetch(API + '/form/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    window.location.replace('https://rebikele.com/');
  } else {
    alert('送信に失敗しました');
  }
}
