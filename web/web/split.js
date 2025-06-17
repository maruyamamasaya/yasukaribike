// Enable draggable divider between dashboard and mail sections

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('split-container');
  const left = document.getElementById('dashboard');
  const right = document.getElementById('mail');
  const divider = document.getElementById('divider');
  if (!container || !left || !right || !divider) return;

  function onDrag(e) {
    const rect = container.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const min = 100;
    const max = rect.width - 100;
    const leftWidth = Math.max(min, Math.min(max, offset));
    const leftPercent = (leftWidth / rect.width) * 100;
    left.style.width = leftPercent + '%';
    right.style.width = 100 - leftPercent + '%';
  }

  function stopDrag() {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  divider.addEventListener('mousedown', e => {
    e.preventDefault();
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  });
});
