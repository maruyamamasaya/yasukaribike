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

  const CATEGORY_ORDER = [
    'inbox',
    'goobike',
    'reserve_notice',
    'tentative',
    'answer_request',
    'skip',
    'additional'
  ];

  function compareCategoryNames(a, b) {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }

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
      list.sort((a, b) => compareCategoryNames(a.name || a, b.name || b));

      ul.innerHTML = '';
      for (const item of list) {
        const name = item.name || item;
        if (String(name).toLowerCase() === 'sent') continue;
        const count = item.count;
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
      }
    } catch (err) {
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadCategories);
})();
