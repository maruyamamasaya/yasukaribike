(() => {
  const API = (typeof window !== 'undefined' && window.API_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
    window.location.origin;

  const NAME_MAP = {
    inbox: '受信ボックス',
    goobike: 'グーバイク',
    reserve_notice: '予約報告',
    tentative: '仮予約受付',
    answer_request: '回答依頼',
    skip: '見送りのお知らせ',
    additional: '追加連絡'
  };

  const ORDER = [
    'inbox',
    'goobike',
    'reserve_notice',
    'tentative',
    'answer_request',
    'skip',
    'additional'
  ];

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

      const counts = {};
      for (const item of list) {
        const name = item.name || item;
        if (name === 'sent') continue;
        counts[name] = item.count || 0;
      }

      ul.innerHTML = '';
      ORDER.forEach(name => {
        const count = counts[name] || 0;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `goobike_mail.html?cat=${encodeURIComponent(name)}`;
        a.textContent = NAME_MAP[name] || name;
        li.appendChild(a);
        if (typeof count === 'number') {
          const span = document.createElement('span');
          span.textContent = ` (${count})`;
          li.appendChild(span);
        }
        ul.appendChild(li);
      });

    } catch (err) {
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadCategories);
})();
