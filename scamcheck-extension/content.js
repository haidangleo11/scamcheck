(function () {
  let selecting = false;
  let startPoint = null;
  let selectionBox = null;
  let helper = null;
  let previousUserSelect = '';

  function createLayer() {
    selectionBox = document.createElement('div');
    selectionBox.id = 'scamcheck-selection-box';
    document.documentElement.appendChild(selectionBox);

    helper = document.createElement('div');
    helper.id = 'scamcheck-selection-helper';
    helper.textContent = 'Kéo để khoanh vùng tin nhắn • Esc để hủy';
    document.documentElement.appendChild(helper);
  }

  function removeLayer() {
    if (selectionBox) selectionBox.remove();
    if (helper) helper.remove();
    selectionBox = null;
    helper = null;
    document.body.style.userSelect = previousUserSelect;
  }

  function stopSelection() {
    selecting = false;
    startPoint = null;
    removeLayer();
  }

  function getRect(event) {
    const currentX = event.clientX;
    const currentY = event.clientY;
    return {
      left: Math.min(startPoint.x, currentX),
      top: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  function drawRect(rect) {
    if (!selectionBox) return;
    selectionBox.style.left = rect.left + 'px';
    selectionBox.style.top = rect.top + 'px';
    selectionBox.style.width = rect.width + 'px';
    selectionBox.style.height = rect.height + 'px';
  }

  function showStatus(message, tone) {
    let toast = document.getElementById('scamcheck-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'scamcheck-toast';
      document.documentElement.appendChild(toast);
    }
    toast.className = 'scamcheck-toast-' + (tone || 'info');
    toast.textContent = message;
    window.clearTimeout(showStatus.timeout);
    showStatus.timeout = window.setTimeout(function () { toast.remove(); }, 6000);
  }

  document.addEventListener('mousedown', function (event) {
    if (!selecting || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startPoint = { x: event.clientX, y: event.clientY };
    drawRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 });
  }, true);

  document.addEventListener('mousemove', function (event) {
    if (!selecting || !startPoint) return;
    event.preventDefault();
    drawRect(getRect(event));
  }, true);

  document.addEventListener('mouseup', function (event) {
    if (!selecting || !startPoint || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = getRect(event);
    stopSelection();
    if (rect.width < 24 || rect.height < 24) {
      showStatus('Vùng chọn quá nhỏ. Hãy kéo bao quanh đoạn tin nhắn.', 'warning');
      return;
    }
    chrome.runtime.sendMessage({ type: 'SCAMCHECK_CAPTURE_SELECTION', rect: rect });
  }, true);

  document.addEventListener('keydown', function (event) {
    if (selecting && event.key === 'Escape') {
      stopSelection();
      showStatus('Đã hủy khoanh vùng.', 'info');
    }
  }, true);

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message) return;
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_START_SELECTION') {
      if (selecting) {
        sendResponse({ ok: true });
        return;
      }
      selecting = true;
      previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      createLayer();
      showStatus('Kéo chuột để khoanh vùng nội dung nghi ngờ. Ảnh chỉ dùng OCR trên máy.', 'info');
      sendResponse({ ok: true });
    }
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_STATUS') {
      showStatus(message.message, message.tone);
    }
  });
}());
