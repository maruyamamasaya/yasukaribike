const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

async function loadCategories() {
  const ul = document.getElementById('category-list');
  if (!ul) return;
  try {
    const res = await fetch(API + '/categories');
    const list = await res.json();
    if (!res.ok) return;
    ul.innerHTML = '';
    for (const cat of list) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `goobike_mail.html?cat=${encodeURIComponent(cat)}`;
      a.textContent = cat;
      li.appendChild(a);
      ul.appendChild(li);
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadCategories);
