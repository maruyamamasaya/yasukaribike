const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function renderTree(node, container) {
  for (const [name, value] of Object.entries(node)) {
    if (name === '_category') continue;
    const li = document.createElement('li');
    const childKeys = Object.keys(value).filter(k => k !== '_category');
    const hasChildren = childKeys.length > 0;
    if (value._category && !hasChildren) {
      const a = document.createElement('a');
      a.href = `goobike_mail.html?cat=${encodeURIComponent(value._category)}`;
      a.textContent = name;
      li.appendChild(a);
    } else {
      li.textContent = name;
      if (hasChildren) {
        const ul = document.createElement('ul');
        renderTree(value, ul);
        li.appendChild(ul);
      }
    }
    container.appendChild(li);
  }
}

async function loadFolderTree() {
  const ul = document.getElementById('category-list');
  if (!ul) return;
  try {
    const res = await fetch(API + '/folder-tree');
    const tree = await res.json();
    ul.innerHTML = '';
    renderTree(tree, ul);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadFolderTree);
