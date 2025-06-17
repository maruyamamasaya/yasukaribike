const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function getKey(item) {
  if (item.order_id) return item.order_id.slice(0, 8);
  if (item.date) return item.date.replace(/\//g, '');
  return '';
}

function groupByMonth(data) {
  const map = {};
  data.forEach(c => {
    const dayKey = getKey(c);
    if (!dayKey) return;
    const monthKey = dayKey.slice(0, 6);
    const day = `${dayKey.slice(0,4)}/${dayKey.slice(4,6)}/${dayKey.slice(6,8)}`;
    const month = `${dayKey.slice(0,4)}/${dayKey.slice(4,6)}`;
    if (!map[month]) map[month] = {};
    if (!map[month][day]) map[month][day] = { total:0, done:0 };
    map[month][day].total++;
    if ((c.status || '') === '済') map[month][day].done++;
  });
  return map;
}

function createDayRow(day, stats) {
  const div = document.createElement('div');
  div.className = 'd-flex align-items-center mb-2';
  const btn = document.createElement('button');
  btn.className = 'btn btn-sm btn-outline-primary me-2 flex-shrink-0';
  btn.textContent = day;
  btn.disabled = true;
  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const progress = document.createElement('div');
  progress.className = 'progress flex-grow-1';
  progress.innerHTML = `<div class="progress-bar" role="progressbar" style="width:${percent}%">${stats.done}/${stats.total}</div>`;
  div.appendChild(btn);
  div.appendChild(progress);
  return div;
}

async function loadCalendar() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  const customers = (data.Items || data).filter(c => !c.draft);
  const monthMap = groupByMonth(customers);
  const monthList = document.getElementById('month-list');
  monthList.innerHTML = '';
  const months = Object.keys(monthMap).sort().reverse();
  months.forEach(month => {
    const monthBtn = document.createElement('button');
    monthBtn.className = 'btn btn-light w-100 text-start mb-1';
    const total = Object.values(monthMap[month]).reduce((sum, d) => sum + d.total, 0);
    monthBtn.textContent = `${month} (${total})`;
    const content = document.createElement('div');
    content.className = 'ms-3 mb-3 d-none';
    const days = Object.keys(monthMap[month]).sort().reverse();
    days.forEach(day => {
      const row = createDayRow(day, monthMap[month][day]);
      content.appendChild(row);
    });
    monthBtn.addEventListener('click', () => {
      content.classList.toggle('d-none');
    });
    monthList.appendChild(monthBtn);
    monthList.appendChild(content);
  });
}

window.addEventListener('DOMContentLoaded', loadCalendar);
