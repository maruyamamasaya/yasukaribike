const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

async function loadCategories() {
  const ul = document.getElementById('category-list');
  if (!ul) return;
  try {
    let list = window.INIT_CATEGORIES;
    if (!list) {
      const res = await fetch(API + '/categories');
      list = await res.json();
      if (!res.ok) return;
    }
    ul.innerHTML = '';
    for (const item of list) {
      const name = item.name || item;
      const count = item.count;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `goobike_mail.html?cat=${encodeURIComponent(name)}`;
      a.textContent = name;
      li.appendChild(a);
      if (typeof count === 'number') {
        const span = document.createElement('span');
        span.textContent = ` (${count})`;
        li.appendChild(span);
      }
      ul.appendChild(li);
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadCategories);
