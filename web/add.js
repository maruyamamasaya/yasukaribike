const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

async function saveCustomer() {
  const note = document.getElementById('f-history-note').value.trim();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  let history = {};
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
