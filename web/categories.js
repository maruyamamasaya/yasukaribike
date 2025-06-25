(() => {
  const API = (typeof window !== 'undefined' && window.API_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
    window.location.origin;

  async function loadCategories() {
    const ul = document.getElementById('category-list');
    if (!ul) return;
    try {
      const accountSel = document.getElementById('mail-account-select');
      const acc = accountSel ? accountSel.value : '';
      let list;
      const useInit = !acc && window.INIT_CATEGORIES;
      if (useInit) {
        list = window.INIT_CATEGORIES;
      } else {
        const res = await fetch(API + '/categories' + (acc ? `?account=${acc}` : ''));
        list = await res.json();
        if (!res.ok) return;
      }

      // fetch all emails to count today's messages
      const res2 = await fetch(API + '/emails' + (acc ? `?account=${acc}` : ''));
      const all = await res2.json();
      const items = Array.isArray(all.Items) ? all.Items : Array.isArray(all) ? all : [];
      const todayStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
      const todayCounts = {};
      items.forEach(m => {
        const cat = m.category;
        if (!cat) return;
        const d = new Date(m.date || m.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
        if (d === todayStr) {
          todayCounts[cat] = (todayCounts[cat] || 0) + 1;
        }
      });

      ul.innerHTML = '';
      const filtered = list.filter(i => {
        const n = i.name || i;
        return n !== 'Sent';
      });
      for (const item of filtered) {
        const name = item.name || item;
        const label = name === 'inbox' ? '受信ボックス' : name;
        const count = item.count;
        const today = todayCounts[name] || 0;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `goobike_mail.html?cat=${encodeURIComponent(name)}`;
        a.textContent = label;
        li.appendChild(a);
        if (typeof count === 'number') {
          const span = document.createElement('span');
          span.textContent = ` (${count})`;
          li.appendChild(span);
        }
        if (today) {
          const span2 = document.createElement('span');
          span2.className = 'text-muted ms-1';
          span2.textContent = `今日:${today}`;
          li.appendChild(span2);
        }
        ul.appendChild(li);
      }
    } catch (err) {
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    const sel = document.getElementById('mail-account-select');
    if (sel) sel.addEventListener('change', loadCategories);
  });
})();
