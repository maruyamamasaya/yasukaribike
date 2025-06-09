// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentPage = 1;
const PAGE_SIZE = 20;
let searchResults = [];

async function searchCustomers(page = 1) {
  if (page === 1) {
    const dateInput = document.getElementById('s-date').value.trim();
    const date = dateInput ? dateInput.replace(/-/g, '/') : '';
    const name = document.getElementById('s-name').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const email = document.getElementById('s-email').value.trim();
    const status = document.getElementById('s-status').value.trim();
    const category = document.getElementById('s-category').value.trim();
    const details = document.getElementById('s-details').value.trim();

    const res = await fetch(API + '/customers');
    const data = await res.json();
    let customers = data.Items || data;

    customers = customers.filter(c =>
      (!date || (c.date || '').includes(date)) &&
      (!name || (c.name || '').includes(name)) &&
      (!phone || (c.phone || c.phoneNumber || '').includes(phone)) &&
      (!email || (c.email || '').includes(email)) &&
      (!status || (c.status || '') === status) &&
      (!category || (c.category || '') === category) &&
      (!details || (c.details || '').includes(details))
    );

    searchResults = customers;
  }

  currentPage = page;
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#result-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = searchResults.slice(start, start + PAGE_SIZE);
  slice.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.email || ''}</td>
      <td>${c.category || ''}</td>
      <td>${c.status || ''}</td>
      <td><a href="detail.html?id=${c.order_id}">詳細</a></td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || searchResults.length === 0;
}

function nextPage() {
  searchCustomers(currentPage + 1);
}

function prevPage() {
  searchCustomers(currentPage - 1);
}

document.addEventListener('DOMContentLoaded', () => searchCustomers());
