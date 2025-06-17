// Enable draggable divider inside mail area

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('mail-sections');
  const top = document.getElementById('mail-top');
  const bottom = document.getElementById('call-log');
  const divider = document.getElementById('mail-divider');
  if (!container || !top || !bottom || !divider) return;

  function onDrag(e) {
    const rect = container.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const min = 50;
    const max = rect.height - 50;
    const topHeight = Math.max(min, Math.min(max, offset));
    const topPercent = (topHeight / rect.height) * 100;
    top.style.height = topPercent + '%';
    bottom.style.height = 100 - topPercent + '%';
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
