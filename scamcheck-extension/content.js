(function () {
  if (window.__scamcheckContentInjected) return;
  window.__scamcheckContentInjected = true;

  let selecting = false;
  let startPoint = null;
  let selectionBox = null;
  let helper = null;
  let previousUserSelect = '';
  let analysisOverlay = null;

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

  function appendList(container, values, limit) {
    (Array.isArray(values) ? values : []).slice(0, limit || 3).forEach(function (value) {
      const item = document.createElement('li');
      item.textContent = String(value || '');
      container.appendChild(item);
    });
  }

  function showAnalysisOverlay(analysis, rag, offline) {
    if (analysisOverlay) analysisOverlay.remove();

    const risk = String(analysis && analysis.risk || 'UNKNOWN').toUpperCase();
    const overlay = document.createElement('aside');
    overlay.id = 'scamcheck-analysis-overlay';
    overlay.className = 'scamcheck-risk-' + risk.toLowerCase();
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Kết quả phân tích ScamCheck');
    overlay.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'scamcheck-overlay-header';
    const heading = document.createElement('strong');
    heading.textContent = '🛡️ ScamCheck: ' + risk;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'scamcheck-overlay-close';
    closeButton.textContent = 'Đóng';
    closeButton.addEventListener('click', function () { overlay.remove(); });
    header.append(heading, closeButton);

    const summary = document.createElement('p');
    summary.className = 'scamcheck-overlay-summary';
    summary.textContent = String(analysis && analysis.summary || 'AI chưa có đủ dữ kiện để kết luận.');

    if (offline) {
      const offlineNotice = document.createElement('p');
      offlineNotice.className = 'scamcheck-overlay-offline';
      offlineNotice.textContent = 'Đang dùng đối chiếu cục bộ dự phòng; chưa có kết quả AI trực tuyến.';
      overlay.append(header, summary, offlineNotice);
    } else {
      overlay.append(header, summary);
    }

    const flags = Array.isArray(analysis && analysis.redFlags) ? analysis.redFlags : [];
    const actions = Array.isArray(analysis && analysis.safeActions) ? analysis.safeActions : [];
    const body = document.createElement('div');
    body.className = 'scamcheck-overlay-body';
    if (flags.length) {
      const flagTitle = document.createElement('strong');
      flagTitle.textContent = 'Dấu hiệu cần chú ý';
      const flagList = document.createElement('ul');
      appendList(flagList, flags, 3);
      body.append(flagTitle, flagList);
    }
    if (actions.length) {
      const actionTitle = document.createElement('strong');
      actionTitle.textContent = 'Nên làm ngay';
      const actionList = document.createElement('ul');
      appendList(actionList, actions, 3);
      body.append(actionTitle, actionList);
    }

    const matches = rag && Array.isArray(rag.matches) ? rag.matches : [];
    if (matches.length) {
      const reference = document.createElement('div');
      reference.className = 'scamcheck-overlay-reference';
      const referenceTitle = document.createElement('strong');
      referenceTitle.textContent = 'Mẫu tham chiếu RAG gần giống';
      const referenceList = document.createElement('ul');
      matches.slice(0, 3).forEach(function (match) {
        const item = document.createElement('li');
        item.textContent = String(match.title || match.category || 'Mẫu tham chiếu');
        referenceList.appendChild(item);
      });
      const disclaimer = document.createElement('p');
      disclaimer.textContent = 'Mẫu tham chiếu hỗ trợ đánh giá, không phải kết luận hay cảnh báo chính thức.';
      reference.append(referenceTitle, referenceList, disclaimer);
      body.appendChild(reference);
    }

    overlay.appendChild(body);
    document.documentElement.appendChild(overlay);
    analysisOverlay = overlay;
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
      return;
    }
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_STATUS') {
      showStatus(message.message, message.tone);
      return;
    }
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_SHOW_ANALYSIS') {
      showAnalysisOverlay(message.analysis, message.rag, message.offline);
      sendResponse({ ok: true });
    }
  });
}());
