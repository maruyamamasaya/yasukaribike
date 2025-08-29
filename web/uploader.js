const API_BASE = '/uploader/api';
const PUBLIC_BASE = 'https://rebikele-file.s3.ap-northeast-1.amazonaws.com';

function $(sel) {
  return document.querySelector(sel);
}

const key = location.pathname.split('/').filter(Boolean).pop() || '';
$('#key-label').textContent = key;

const dropZone = $('#drop-zone');
const fileInput = $('#file-input');
let queue = [];
let uploading = false;

function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    queue.push(f);
  }
  if (!uploading) uploadSequential();
}

['dragover', 'drop'].forEach(ev => {
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
  });
});

dropZone.addEventListener('drop', e => {
  handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

async function uploadSequential() {
  if (queue.length === 0) return;
  uploading = true;
  const status = $('#status-msg');
  let count = 0;
  while (queue.length > 0) {
    const file = queue.shift();
    count++;
    status.textContent = `アップロード中... (${count})`;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const resp = await fetch(`${API_BASE}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ext })
    });
    if (!resp.ok) {
      alert('アップロードURL取得に失敗');
      break;
    }
    const info = await resp.json();
    await fetch(info.presignedUrl, {
      method: 'PUT',
      body: file
    });
    await refreshList();
    await new Promise(r => setTimeout(r, 500));
  }
  status.textContent = '';
  uploading = false;
  if (queue.length > 0) uploadSequential();
}

async function refreshList() {
  const res = await fetch(`${API_BASE}/images/${key}?format=json`);
  if (!res.ok) return;
  const data = await res.json();
  const gallery = $('#gallery');
  const thumb = $('#thumbnail');
  gallery.innerHTML = '';
  thumb.innerHTML = '';
  $('#empty-msg').style.display = data.files.length ? 'none' : 'block';
  data.files.forEach(name => {
    const col = document.createElement('div');
    col.className = 'col';
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = `${PUBLIC_BASE}/keys/${key}/${name}`;
    img.className = 'card-img-top';
    card.appendChild(img);
    const body = document.createElement('div');
    body.className = 'card-body p-2 text-center';
    const fname = document.createElement('div');
    fname.textContent = name;
    fname.className = 'small';
    body.appendChild(fname);

    const btnGrp = document.createElement('div');
    btnGrp.className = 'btn-group btn-group-sm mt-2';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-secondary';
    copyBtn.textContent = 'URL';
    copyBtn.onclick = () => navigator.clipboard.writeText(img.src);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = '削除';
    delBtn.onclick = async () => {
      await fetch(`${API_BASE}/images/${key}/${name}`, { method: 'DELETE' });
      refreshList();
    };

    const starBtn = document.createElement('button');
    starBtn.className = data.thumbnail === name ? 'btn btn-warning' : 'btn btn-outline-warning';
    starBtn.textContent = '★';
    starBtn.onclick = async () => {
      await fetch(`${API_BASE}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, filename: name })
      });
      refreshList();
    };

    btnGrp.append(copyBtn, delBtn, starBtn);
    body.appendChild(btnGrp);
    card.appendChild(body);
    col.appendChild(card);
    if (data.thumbnail === name) {
      thumb.appendChild(col);
    } else {
      gallery.appendChild(col);
    }
  });
}

$('#csv-btn').addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/images/${key}?format=csv`);
  if (res.ok) {
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    alert('CSVをコピーしました');
  }
});

refreshList();
