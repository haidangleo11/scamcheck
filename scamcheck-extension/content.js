(function () {
  const CONTENT_SCRIPT_VERSION = '1.4.9';
  if (window.__scamcheckContentInjected === CONTENT_SCRIPT_VERSION) return;
  window.__scamcheckContentInjected = CONTENT_SCRIPT_VERSION;

  let selecting = false;
  let startPoint = null;
  let selectionBox = null;
  let helper = null;
  let previousUserSelect = '';
  let analysisOverlay = null;
  let automaticWarning = null;
  let automaticChecking = null;
  let automaticNoticeTimer = null;
  let automaticScanTimer = null;
  let automaticRetryTimer = null;
  let automaticAlertSignature = '';
  let automaticRetrySignature = '';
  let autoProtectionEnabled = false;
  let autoMutedForHost = false;
  let autoLanguage = 'vi';
  let automaticRequestInFlight = false;
  let automaticLastRequestAt = 0;
  const AUTO_TEXT_LIMIT = 6000;
  const AUTO_SCAN_DELAY = 450;
  const AUTO_REQUEST_COOLDOWN = 15000;
  const AUTO_RETRY_DELAY = 20000;

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

  function getSelectedText() {
    const selected = String(window.getSelection && window.getSelection().toString() || '').trim();
    if (selected) return selected;
    const active = document.activeElement;
    if (active && typeof active.value === 'string' && typeof active.selectionStart === 'number' && active.selectionEnd > active.selectionStart) {
      return active.value.slice(active.selectionStart, active.selectionEnd).trim();
    }
    return '';
  }

  function overlayCopy(language) {
    if (language === 'en') {
      return {
        label: 'ScamCheck result',
        close: 'Close',
        unknown: 'The AI does not have enough evidence to reach a conclusion.',
        offline: 'Using a local fallback pattern check; no online AI result is available.',
        flags: 'Warning signs',
        actions: 'What to do now',
        references: 'Similar RAG reference patterns',
        note: 'Reference patterns support the assessment; they are not an official warning.'
      };
    }
    return {
      label: 'Kết quả phân tích ScamCheck',
      close: 'Đóng',
      unknown: 'AI chưa có đủ dữ kiện để kết luận.',
      offline: 'Đang dùng đối chiếu cục bộ dự phòng; chưa có kết quả AI trực tuyến.',
      flags: 'Dấu hiệu cần chú ý',
      actions: 'Nên làm ngay',
      references: 'Mẫu tham chiếu RAG gần giống',
      note: 'Mẫu tham chiếu hỗ trợ đánh giá, không phải kết luận hay cảnh báo chính thức.'
    };
  }

  function referenceName(match, language) {
    const englishNames = {
      'vneid-dichvucong-fakeapp': 'Fake VNeID / public-service app',
      'tax-refund-fake': 'Fake tax refund or tax settlement',
      'bank-login-phishing': 'Fake bank account alert / phishing',
      'authority-temporary-account': 'Fake authority temporary-account request',
      'job-task-advance-fee': 'Fake online task / commission job',
      'telegram-investment-group': 'Telegram/Zalo investment group scam',
      'delivery-fee-link': 'Fake delivery-fee link',
      'prize-tax-refund': 'Fake prize or loyalty gift',
      'sim-identity-takeover': 'SIM lock / identity-update scam',
      'impersonation-friend-urgent-transfer': 'Impersonated friend urgent-transfer scam',
      'lawyer-scam-recovery': 'Fake fund-recovery service',
      'romance-scam-customs': 'Romance / customs-fee scam',
      'flight-tour-cheap': 'Too-good-to-be-true flight or tour offer',
      'child-hospital-emergency': 'Fake child hospital emergency call',
      'generic-free-money-lure': 'Free-money or prize link lure',
      'piracy-gambling-link-injection': 'Piracy page with gambling / Tài Xỉu links'
    };
    if (language === 'en' && englishNames[match && match.id]) return englishNames[match.id];
    return String(match && (match.title || match.category) || 'Reference pattern');
  }

  function showAnalysisOverlay(analysis, rag, offline, language) {
    if (analysisOverlay) analysisOverlay.remove();

    const words = overlayCopy(language);
    const risk = String(analysis && analysis.risk || 'UNKNOWN').toUpperCase();
    const overlay = document.createElement('aside');
    overlay.id = 'scamcheck-analysis-overlay';
    overlay.className = 'scamcheck-risk-' + risk.toLowerCase();
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', words.label);
    overlay.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'scamcheck-overlay-header';
    const brand = document.createElement('div');
    brand.className = 'scamcheck-overlay-brand';
    const heading = document.createElement('strong');
    heading.textContent = '🛡️ ScamCheck';
    const riskBadge = document.createElement('span');
    riskBadge.className = 'scamcheck-overlay-risk-badge';
    riskBadge.textContent = risk;
    brand.append(heading, riskBadge);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'scamcheck-overlay-close';
    closeButton.textContent = words.close;
    closeButton.addEventListener('click', function () { overlay.remove(); });
    header.append(brand, closeButton);

    const summary = document.createElement('p');
    summary.className = 'scamcheck-overlay-summary';
    summary.textContent = String(analysis && analysis.summary || words.unknown);

    if (offline) {
      const offlineNotice = document.createElement('p');
      offlineNotice.className = 'scamcheck-overlay-offline';
      offlineNotice.textContent = words.offline;
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
      flagTitle.textContent = words.flags;
      const flagList = document.createElement('ul');
      appendList(flagList, flags, 3);
      body.append(flagTitle, flagList);
    }
    if (actions.length) {
      const actionTitle = document.createElement('strong');
      actionTitle.textContent = words.actions;
      const actionList = document.createElement('ul');
      appendList(actionList, actions, 3);
      body.append(actionTitle, actionList);
    }

    const matches = rag && Array.isArray(rag.matches) ? rag.matches : [];
    if (matches.length) {
      const reference = document.createElement('div');
      reference.className = 'scamcheck-overlay-reference';
      const referenceTitle = document.createElement('strong');
      referenceTitle.textContent = words.references;
      const referenceList = document.createElement('ul');
      matches.slice(0, 3).forEach(function (match) {
        const item = document.createElement('li');
        item.textContent = referenceName(match, language);
        referenceList.appendChild(item);
      });
      const disclaimer = document.createElement('p');
      disclaimer.textContent = words.note;
      reference.append(referenceTitle, referenceList, disclaimer);
      body.appendChild(reference);
    }

    overlay.appendChild(body);
    document.documentElement.appendChild(overlay);
    analysisOverlay = overlay;
  }

  function automaticCopy() {
    if (autoLanguage === 'en') {
      return {
        title: 'AI safety alert',
        detected: 'ScamCheck AI found meaningful warning signs on this page.',
        checking: 'ScamCheck AI is checking the visible content…',
        unavailable: 'ScamCheck AI could not return a result yet. It will try again when this page changes.',
        localOnly: 'The visible-text snapshot was analysed by ScamCheck AI. Form and password fields are excluded.',
        localFallback: 'ScamCheck AI is temporarily unavailable. This warning is based on matching local safety patterns; it will retry once shortly.',
        details: 'View safety guidance',
        mute: 'Mute on this site',
        close: 'Dismiss',
        high: 'High-risk signs',
        critical: 'Critical-risk signs',
        summary: 'This page contains patterns often used to pressure people into sharing information, opening a link, or transferring money.'
      };
    }
    return {
      title: 'Cảnh báo an toàn AI',
      detected: 'ScamCheck AI phát hiện dấu hiệu đáng kể cần thận trọng trên trang này.',
      checking: 'ScamCheck AI đang kiểm tra nội dung hiển thị…',
      unavailable: 'ScamCheck AI tạm thời chưa trả được kết quả. Extension sẽ thử lại khi nội dung trang thay đổi.',
      localOnly: 'Bản chụp chữ đang hiển thị đã được ScamCheck AI phân tích. Ô form và mật khẩu được loại trừ.',
      localFallback: 'ScamCheck AI tạm thời không khả dụng. Cảnh báo này dựa trên mẫu an toàn đối chiếu cục bộ; extension sẽ tự thử lại một lần trong giây lát.',
      details: 'Xem hướng dẫn an toàn',
      mute: 'Tắt ở trang này',
      close: 'Đóng',
      high: 'Dấu hiệu rủi ro cao',
      critical: 'Dấu hiệu rủi ro nghiêm trọng',
      summary: 'Trang có các mẫu thường được dùng để gây áp lực, dụ mở link, cung cấp thông tin hoặc chuyển tiền.'
    };
  }

  function snapshotFingerprint(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return location.href + ':' + (hash >>> 0).toString(36);
  }

  function collectVisibleText(root, limit) {
    const chunks = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('[id^="scamcheck-"], script, style, noscript, form, textarea, input, select, option, [download], [data-attachment-id], .aQH') || parent.getClientRects().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let current = walker.nextNode();
    let size = 0;
    while (current && size < limit) {
      const value = String(current.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (value) {
        chunks.push(value);
        size += value.length + 1;
      }
      current = walker.nextNode();
    }
    return chunks.join(' ').slice(0, limit);
  }

  function getPreferredScanRoot() {
    if (location.hostname !== 'mail.google.com') return null;
    // Gmail places an opened message body in .a3s. Prioritising it avoids
    // filling the request with Gmail navigation before the email itself.
    return [...document.querySelectorAll('.a3s.aiL, .a3s')]
      .find(function (node) { return node.getClientRects().length > 0 && String(node.innerText || '').trim().length >= 20; }) || null;
  }

  function getVisiblePageText() {
    if (!document.body) return '';
    const scanRoot = getPreferredScanRoot() || document.body;
    const visibleText = collectVisibleText(scanRoot, AUTO_TEXT_LIMIT);
    const links = [...scanRoot.querySelectorAll('a[href]')].slice(0, 40)
      .filter(function (link) { return link.getClientRects().length > 0 && !link.closest('[download], [data-attachment-id], .aQH'); })
      .map(function (link) { return link.href; })
      .filter(Boolean)
      .join(' ');
    const source = scanRoot === document.body ? 'Nội dung trang' : 'Thân email Gmail đang mở';
    return ('Trang: ' + location.hostname + '\nNguồn: ' + source + '\n' + visibleText + '\nLiên kết: ' + links).slice(0, AUTO_TEXT_LIMIT);
  }

  function dismissAutomaticChecking() {
    window.clearTimeout(automaticNoticeTimer);
    automaticNoticeTimer = null;
    if (automaticChecking && automaticChecking.isConnected) automaticChecking.remove();
    automaticChecking = null;
  }

  function showAutomaticChecking() {
    dismissAutomaticChecking();
    const badge = document.createElement('div');
    badge.id = 'scamcheck-auto-checking';
    badge.dataset.scamcheckMode = 'checking';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.textContent = '🛡️ ' + automaticCopy().checking;
    document.documentElement.appendChild(badge);
    automaticChecking = badge;
  }

  function showAutomaticTemporaryNotice(message) {
    dismissAutomaticChecking();
    const badge = document.createElement('div');
    badge.id = 'scamcheck-auto-checking';
    badge.dataset.scamcheckMode = 'notice';
    badge.className = 'scamcheck-auto-notice';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.textContent = 'ℹ️ ' + message;
    document.documentElement.appendChild(badge);
    automaticChecking = badge;
    automaticNoticeTimer = window.setTimeout(dismissAutomaticChecking, 7000);
  }

  function dismissAutomaticWarning() {
    if (automaticWarning && automaticWarning.isConnected) automaticWarning.remove();
    automaticWarning = null;
  }

  function scheduleAutomaticRetry(signature) {
    // A temporary provider failure should not leave a local-only warning stuck
    // on screen forever. Limit this to one retry for each page snapshot to
    // avoid repeatedly sending the same page content when AI is unavailable.
    if (automaticRetrySignature === signature) return;
    automaticRetrySignature = signature;
    window.clearTimeout(automaticRetryTimer);
    automaticRetryTimer = window.setTimeout(function () {
      automaticAlertSignature = '';
      dismissAutomaticWarning();
      scheduleAutomaticScan();
    }, AUTO_RETRY_DELAY);
  }

  function muteCurrentSite() {
    const host = location.hostname;
    chrome.storage.local.get('scamcheckMutedHosts').then(function (stored) {
      const mutedHosts = Array.isArray(stored.scamcheckMutedHosts) ? stored.scamcheckMutedHosts : [];
      if (!mutedHosts.includes(host)) mutedHosts.push(host);
      return chrome.storage.local.set({ scamcheckMutedHosts: mutedHosts.slice(-100) });
    }).finally(function () {
      autoMutedForHost = true;
      dismissAutomaticWarning();
    });
  }

  function showAutomaticWarning(analysis, rag, offline) {
    dismissAutomaticChecking();
    dismissAutomaticWarning();
    const words = automaticCopy();
    const isCritical = String(analysis && analysis.risk || '').toUpperCase() === 'CRITICAL';
    const warning = document.createElement('aside');
    warning.id = 'scamcheck-auto-warning';
    warning.className = isCritical ? 'scamcheck-auto-critical' : 'scamcheck-auto-high';
    warning.setAttribute('role', 'alert');
    warning.setAttribute('aria-live', 'assertive');

    const header = document.createElement('div');
    header.className = 'scamcheck-auto-header';
    const title = document.createElement('strong');
    title.textContent = '🛡️ ScamCheck · ' + (isCritical ? words.critical : words.high);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'scamcheck-auto-close';
    close.textContent = '×';
    close.setAttribute('aria-label', words.close);
    close.addEventListener('click', dismissAutomaticWarning);
    header.append(title, close);

    const message = document.createElement('p');
    message.textContent = String(analysis && analysis.summary || words.detected);
    const localOnly = document.createElement('p');
    localOnly.className = 'scamcheck-auto-local';
    localOnly.textContent = offline ? words.localFallback : words.localOnly;
    const actions = document.createElement('div');
    actions.className = 'scamcheck-auto-actions';
    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'scamcheck-auto-details';
    details.textContent = words.details;
    details.addEventListener('click', function () {
      showAnalysisOverlay(analysis || {}, rag || { enabled: true, source: 'automatic-ai', matches: [] }, Boolean(offline), autoLanguage);
      dismissAutomaticWarning();
    });
    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'scamcheck-auto-mute';
    mute.textContent = words.mute;
    mute.addEventListener('click', muteCurrentSite);
    actions.append(details, mute);
    warning.append(header, message, localOnly, actions);
    document.documentElement.appendChild(warning);
    automaticWarning = warning;
  }

  function runAutomaticScan() {
    automaticScanTimer = null;
    // A newly injected version deactivates any stale content script that
    // Chrome left in an already-open page after an extension reload.
    if (window.__scamcheckContentInjected !== CONTENT_SCRIPT_VERSION) return;
    if (!autoProtectionEnabled || autoMutedForHost || selecting) return;
    if (automaticWarning && automaticWarning.isConnected) return;
    automaticWarning = null;
    if (automaticRequestInFlight || Date.now() - automaticLastRequestAt < AUTO_REQUEST_COOLDOWN) return;
    const snapshot = getVisiblePageText();
    if (snapshot.length < 20) return;
    const signature = snapshotFingerprint(snapshot);
    const pageUrl = location.href;
    if (signature === automaticAlertSignature) return;
    automaticAlertSignature = signature;
    automaticRequestInFlight = true;
    automaticLastRequestAt = Date.now();
    showAutomaticChecking();
    chrome.runtime.sendMessage({
      target: 'SCAMCHECK_BACKGROUND',
      type: 'SCAMCHECK_AUTO_ANALYZE',
      text: snapshot,
      language: autoLanguage
    }).then(function (response) {
      // Dynamic pages such as Gmail and streaming sites change their DOM while
      // AI is responding. Keep the result unless the user actually navigated.
      if (location.href !== pageUrl) return;
      if (response && response.ok && response.shouldWarn) {
        showAutomaticWarning(response.analysis || {}, response.rag || null, Boolean(response.offline));
        if (response.unavailable) scheduleAutomaticRetry(signature);
      } else if (!response || !response.ok || response.unavailable) {
        showAutomaticTemporaryNotice(automaticCopy().unavailable);
        scheduleAutomaticRetry(signature);
      }
    }).catch(function () {
      // Automatic protection must stay silent when the AI is unavailable.
    }).finally(function () {
      automaticRequestInFlight = false;
      if (automaticChecking && automaticChecking.dataset.scamcheckMode === 'checking') dismissAutomaticChecking();
    });
  }

  function scheduleAutomaticScan() {
    if (window.__scamcheckContentInjected !== CONTENT_SCRIPT_VERSION) return;
    if (!autoProtectionEnabled || autoMutedForHost) return;
    window.clearTimeout(automaticScanTimer);
    automaticScanTimer = window.setTimeout(runAutomaticScan, AUTO_SCAN_DELAY);
  }

  function applyAutomaticSettings(stored) {
    const ui = stored && stored.scamcheckUi || {};
    const mutedHosts = stored && Array.isArray(stored.scamcheckMutedHosts) ? stored.scamcheckMutedHosts : [];
    autoProtectionEnabled = ui.autoAiScan === true;
    autoMutedForHost = mutedHosts.includes(location.hostname);
    autoLanguage = ui.language === 'en' ? 'en' : 'vi';
    if (!autoProtectionEnabled || autoMutedForHost) {
      automaticAlertSignature = '';
      automaticRetrySignature = '';
      window.clearTimeout(automaticRetryTimer);
      automaticRetryTimer = null;
      dismissAutomaticWarning();
      dismissAutomaticChecking();
    }
    else scheduleAutomaticScan();
  }

  function initialiseAutomaticProtection() {
    chrome.storage.local.get(['scamcheckUi', 'scamcheckMutedHosts']).then(applyAutomaticSettings).catch(function () {
      autoProtectionEnabled = false;
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || (!changes.scamcheckUi && !changes.scamcheckMutedHosts)) return;
      chrome.storage.local.get(['scamcheckUi', 'scamcheckMutedHosts']).then(applyAutomaticSettings);
    });
    const observer = new MutationObserver(function () { scheduleAutomaticScan(); });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
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
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_READ_SELECTED_TEXT') {
      const text = getSelectedText();
      sendResponse(text ? { ok: true, text: text } : { ok: false });
      return;
    }
    if (message.target === 'SCAMCHECK_CONTENT' && message.type === 'SCAMCHECK_SHOW_ANALYSIS') {
      showAnalysisOverlay(message.analysis, message.rag, message.offline, message.language);
      sendResponse({ ok: true });
    }
  });

  initialiseAutomaticProtection();
}());
