const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

async function loadDebug() {
  const out = document.getElementById('data');
  try {
    const res = await fetch(API + '/customers');
    const data = await res.json();
    const customers = data.Items || data;
    out.textContent = JSON.stringify(customers, null, 2);
  } catch (e) {
    console.error(e);
    out.textContent = 'Failed to load data';
  }
}

window.addEventListener('DOMContentLoaded', loadDebug);
