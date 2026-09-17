(() => {
  const bridge = window.scamcheckDesktop;
  if (!bridge?.isDesktop) return;

  const TESSERACT_OPTIONS = {
    workerPath: 'scamcheck://app/vendor/tesseract/worker.min.js',
    corePath: 'scamcheck://app/vendor/tesseract-core',
    langPath: 'scamcheck://app/vendor/tessdata',
    gzip: true,
    workerBlobURL: false,
    logger: () => {}
  };
  const LIMIT_CHARS = 3500;
  const MIN_AUTO_GAP_MS = 60_000;
  let preferences = { clipboardWatch: false, screenWatch: false, autoAnalyze: false, startOnLogin: false };
  let lastAutoAnalysis = 0;
  let scanning = false;
  let scanLogEntries = [];
  const automaticRiskFingerprints = new Map();

  function byId(id) { return document.getElementById(id); }
  function vietnamese() { return window.currentLanguage !== 'en'; }
  function label(vi, en) { return vietnamese() ? vi : en; }
  function setStatus(message, variant = 'neutral') {
    const node = byId('desktopScanStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.variant = variant;
  }
  function notify(title, body) { bridge.notify({ title, body }); }

  function eventSource(source) {
    if (source === 'clipboard') return label('Clipboard', 'Clipboard');
    if (source === 'screen') return label('Màn hình', 'Screen');
    return label('Ứng dụng', 'App');
  }

  function renderScanLog(entries = scanLogEntries) {
    scanLogEntries = Array.isArray(entries) ? entries : [];
    const list = byId('desktopScanLog');
    if (!list) return;
    list.replaceChildren();
    if (!scanLogEntries.length) {
      const empty = document.createElement('p');
      empty.className = 'desktop-log-empty';
      empty.textContent = label('Chưa có sự kiện quét nào trong ứng dụng này.', 'No desktop scan events have been recorded yet.');
      list.appendChild(empty);
      return;
    }
    scanLogEntries.slice(0, 5).forEach(entry => {
      const item = document.createElement('div');
      item.className = 'desktop-log-item';
      item.dataset.variant = entry.severity || 'neutral';
      const meta = document.createElement('span');
      const time = entry.recordedAt ? new Date(entry.recordedAt).toLocaleTimeString(vietnamese() ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      meta.textContent = `${eventSource(entry.source)}${time ? ` · ${time}` : ''}`;
      const detail = document.createElement('strong');
      detail.textContent = entry.detail || label('Sự kiện quét', 'Scan event');
      item.append(meta, detail);
      list.appendChild(item);
    });
  }

  async function refreshScanLog() {
    try { renderScanLog(await bridge.getScanLog()); } catch (error) { console.error('Could not load desktop scan log:', error); }
  }

  function recordEvent(source, detail, severity = 'neutral') {
    bridge.recordScanEvent({ source, detail, severity })
      .then(renderScanLog)
      .catch(error => console.error('Could not save desktop scan event:', error));
  }

  function recordAutomaticRiskOnce(text, source, detail) {
    const fingerprint = `${source}:${String(text || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 400)}`;
    const previous = automaticRiskFingerprints.get(fingerprint) || 0;
    if (Date.now() - previous < 10 * 60_000) return;
    automaticRiskFingerprints.set(fingerprint, Date.now());
    recordEvent(source, detail, 'warning');
  }

  function redactSensitiveText(value) {
    return String(value || '')
      .replace(/((?:password|mật\s*khẩu|passcode)\s*[:=-]\s*)\S+/gi, '$1[REDACTED]')
      .replace(/((?:otp|mã\s*xác\s*minh|verification\s*code)\s*[:=-]\s*)\d{4,8}/gi, '$1[REDACTED]')
      .replace(/\u0000/g, '')
      .trim()
      .slice(0, LIMIT_CHARS);
  }

  function localRisk(text) {
    const value = String(text || '').toLowerCase();
    const signals = [
      /https?:\/\//, /\b(otp|password|mật khẩu|verify|xác minh|đăng nhập)\b/,
      /\b(chuyển tiền|transfer|bank account|tài khoản|ngân hàng)\b/,
      /\b(urgent|khẩn cấp|ngay|2 giờ|locked|bị khóa)\b/,
      /\b(quà tặng|gift|reward|donation|lottery|trúng thưởng|crypto)\b/,
      /\b(remote access|cài ứng dụng|install app|screen share|chia sẻ màn hình)\b/,
      /\b(việc làm|job|commission|hoa hồng|nhiệm vụ)\b/
    ];
    const matches = signals.filter(pattern => pattern.test(value)).length;
    return { suspicious: matches >= 2 || (matches >= 1 && /(http|www\.)/.test(value)), matches };
  }

  function setInput(text) {
    const input = byId('messageInput');
    if (!input) return false;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    return true;
  }

  function autoAnalyze(text, source) {
    if (!preferences.autoAnalyze || Date.now() - lastAutoAnalysis < MIN_AUTO_GAP_MS) return false;
    const checkButton = byId('checkBtn');
    if (!checkButton || checkButton.disabled) return false;
    lastAutoAnalysis = Date.now();
    setInput(text);
    setStatus(label(`Đang gửi nội dung ${source} có rủi ro rõ để AI phân tích…`, `Sending clearly risky ${source} content to AI for analysis…`), 'warning');
    checkButton.click();
    return true;
  }

  function ingestText(rawText, { source, automatic }) {
    const text = redactSensitiveText(rawText);
    if (text.length < 10) return;
    const assessment = localRisk(text);
    if (!assessment.suspicious) {
      if (!automatic) {
        setInput(text);
        setStatus(label('Đã đưa nội dung vào ô kiểm tra. Hãy xem lại rồi bấm “Kiểm tra ngay”.', 'Content was added to the checker. Review it, then choose “Check now”.'), 'neutral');
        recordEvent(source, label('Đã thêm nội dung để bạn tự kiểm tra.', 'Content was added for your review.'), 'neutral');
      }
      return;
    }
    const sourceLabel = source === 'clipboard' ? label('clipboard', 'clipboard') : label('màn hình', 'screen');
    setInput(text);
    const detail = label(`Phát hiện ${assessment.matches} dấu hiệu rủi ro từ ${sourceLabel}.`, `${assessment.matches} risk signal(s) found in ${sourceLabel} content.`);
    if (automatic) recordAutomaticRiskOnce(text, source, detail);
    else recordEvent(source, detail, 'warning');
    if (autoAnalyze(text, sourceLabel)) {
      recordEvent(source, label('Đã gửi nội dung có rủi ro rõ để AI phân tích.', 'Clearly risky content was sent to AI for analysis.'), 'success');
      notify('ScamCheck', detail);
      return;
    }
    setStatus(`${detail} ${label('Nội dung đã được đưa vào ô kiểm tra; chưa gửi AI.', 'The content was added to the checker; it has not been sent to AI.')}`, 'warning');
    notify('ScamCheck - cần kiểm tra', detail);
  }

  async function recognizeScreen(dataUrl) {
    if (!window.Tesseract) throw new Error(label('OCR chưa sẵn sàng. Kiểm tra lại kết nối hoặc khởi động lại ứng dụng.', 'OCR is not ready. Check the connection or restart the app.'));
    const result = await window.Tesseract.recognize(dataUrl, 'vie+eng', TESSERACT_OPTIONS);
    return String(result?.data?.text || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function processScreens(screens, automatic) {
    if (scanning || !Array.isArray(screens) || screens.length === 0) return;
    scanning = true;
    try {
      setStatus(label('Đang OCR chữ hiển thị trên màn hình…', 'Reading visible screen text with local OCR…'), 'neutral');
      for (const screen of screens) {
        const text = await recognizeScreen(screen.dataUrl);
        if (text) ingestText(text, { source: 'screen', automatic });
      }
      if (!automatic) setStatus(label('Đã hoàn tất quét màn hình. Kiểm tra nội dung trong ô nhập trước khi gửi AI.', 'Screen scan is complete. Review the input before sending it to AI.'), 'success');
      if (!automatic) recordEvent('screen', label('Đã hoàn tất OCR màn hình cục bộ.', 'Local screen OCR completed.'), 'success');
    } catch (error) {
      console.error('Desktop screen OCR failed:', error);
      setStatus(label(`Không thể quét màn hình: ${error.message}`, `Could not scan the screen: ${error.message}`), 'error');
      recordEvent('screen', label('OCR màn hình không hoàn tất.', 'Screen OCR did not complete.'), 'error');
    } finally {
      scanning = false;
    }
  }

  async function scanClipboardNow() {
    recordEvent('clipboard', label('Bắt đầu quét clipboard theo yêu cầu.', 'Manual clipboard scan started.'), 'neutral');
    const text = await bridge.readClipboard();
    if (!text) {
      setStatus(label('Clipboard chưa có đoạn chữ đủ dài để kiểm tra.', 'The clipboard does not contain enough text to inspect.'), 'neutral');
      return;
    }
    ingestText(text, { source: 'clipboard', automatic: false });
  }

  async function scanScreenNow() {
    recordEvent('screen', label('Bắt đầu OCR màn hình theo yêu cầu.', 'Manual screen OCR started.'), 'neutral');
    const screens = await bridge.captureScreens();
    await processScreens(screens, false);
  }

  async function saveSettings() {
    preferences.clipboardWatch = byId('desktopClipboardWatch').checked;
    preferences.screenWatch = byId('desktopScreenWatch').checked;
    preferences.autoAnalyze = byId('desktopAutoAnalyze').checked;
    preferences.startOnLogin = byId('desktopStartOnLogin').checked;
    preferences = await bridge.setPreferences(preferences);
    setStatus(label('Đã lưu tùy chọn bảo vệ desktop.', 'Desktop protection settings saved.'), 'success');
  }

  function injectPanel() {
    const input = byId('messageInput');
    if (!input || byId('desktopScanPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'desktopScanPanel';
    panel.className = 'desktop-scan-panel';
    panel.innerHTML = `
      <div class="desktop-scan-heading">
        <div><span class="desktop-kicker">WINDOWS DESKTOP</span><h2>🖥️ ${label('Quét an toàn trên máy tính', 'Safe computer-wide scanning')}</h2></div>
        <span class="desktop-local">${label('OCR cục bộ trước', 'Local OCR first')}</span>
      </div>
      <p>${label('ScamCheck có thể đọc chữ từ clipboard và màn hình đang hiển thị trong các ứng dụng Windows. Mặc định mọi cơ chế theo dõi đều tắt.', 'ScamCheck can read text from the clipboard and the visible screen in Windows apps. All monitoring is off by default.')}</p>
      <div class="desktop-actions">
        <button type="button" id="desktopScanClipboard">📋 ${label('Quét clipboard', 'Scan clipboard')}</button>
        <button type="button" id="desktopScanScreen">🖼️ ${label('Quét màn hình', 'Scan screen')}</button>
      </div>
      <div class="desktop-toggles">
        <label><input id="desktopClipboardWatch" type="checkbox"> <span>${label('Theo dõi clipboard', 'Watch clipboard')}</span></label>
        <label><input id="desktopScreenWatch" type="checkbox"> <span>${label('Theo dõi màn hình mỗi 60 giây', 'Watch screen every 60 seconds')}</span></label>
        <label><input id="desktopAutoAnalyze" type="checkbox"> <span>${label('Tự gửi AI khi có rủi ro rõ', 'Auto-send clearly risky text to AI')}</span></label>
        <label><input id="desktopStartOnLogin" type="checkbox"> <span>${label('Khởi động cùng Windows', 'Start with Windows')}</span></label>
      </div>
      <div class="desktop-hotkeys"><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> ${label('quét clipboard', 'scan clipboard')}</span><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> ${label('quét màn hình', 'scan screen')}</span></div>
      <div class="desktop-log-heading"><strong>${label('Hoạt động gần đây', 'Recent activity')}</strong><button type="button" id="desktopClearLog">${label('Xóa nhật ký', 'Clear log')}</button></div>
      <div id="desktopScanLog" class="desktop-scan-log" aria-live="polite"></div>
      <p id="desktopScanStatus" class="desktop-status" data-variant="neutral">${label('Chuỗi OTP/mật khẩu nhận diện được sẽ bị che trước khi xử lý tự động; kiểm tra thủ công luôn được ưu tiên.', 'Recognised OTP/password strings are redacted before automatic processing; manual review is always preferred.')}</p>
    `;
    const anchor = input.closest('.relative');
    anchor.parentNode.insertBefore(panel, anchor);
    byId('desktopScanClipboard').addEventListener('click', scanClipboardNow);
    byId('desktopScanScreen').addEventListener('click', scanScreenNow);
    byId('desktopClearLog').addEventListener('click', async () => {
      try {
        renderScanLog(await bridge.clearScanLog());
        setStatus(label('Đã xóa nhật ký quét trên thiết bị này.', 'The scan log on this device was cleared.'), 'success');
      } catch (error) {
        setStatus(label('Không thể xóa nhật ký quét.', 'Could not clear the scan log.'), 'error');
      }
    });
    ['desktopClipboardWatch', 'desktopScreenWatch', 'desktopAutoAnalyze', 'desktopStartOnLogin'].forEach(id => byId(id).addEventListener('change', saveSettings));
  }

  function injectStyle() {
    const css = document.createElement('style');
    css.textContent = `
      .desktop-scan-panel{margin:0 0 1.25rem;padding:1rem;border:1px solid #bfdbfe;border-radius:1rem;background:linear-gradient(135deg,#eff6ff,#f8fbff);box-shadow:0 1px 3px rgba(15,23,42,.05)}
      .dark .desktop-scan-panel{background:linear-gradient(135deg,rgba(30,58,138,.25),rgba(15,23,42,.55));border-color:#1e40af}
      .desktop-scan-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.desktop-scan-heading h2{margin:.12rem 0 0;color:#0f3b88;font-size:1.08rem;font-weight:800}.dark .desktop-scan-heading h2{color:#bfdbfe}
      .desktop-kicker{color:#2563eb;font-size:.68rem;font-weight:800;letter-spacing:.08em}.desktop-local{border:1px solid #86efac;background:#ecfdf5;color:#166534;padding:.25rem .55rem;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap}.dark .desktop-local{background:rgba(22,101,52,.35);color:#bbf7d0}
      .desktop-scan-panel>p{margin:.65rem 0;color:#475569;font-size:.86rem;line-height:1.45}.dark .desktop-scan-panel>p{color:#cbd5e1}.desktop-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin:.7rem 0}.desktop-actions button{border:1px solid #93c5fd;background:#2563eb;color:white;padding:.54rem .78rem;border-radius:.6rem;font-weight:700;font-size:.84rem}.desktop-actions button+button{background:white;color:#1d4ed8}.dark .desktop-actions button+button{background:#172554;color:#bfdbfe}
       .desktop-toggles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem .7rem;padding:.7rem;border-radius:.65rem;background:rgba(255,255,255,.65)}.dark .desktop-toggles{background:rgba(15,23,42,.5)}.desktop-toggles label{display:flex;gap:.45rem;align-items:flex-start;font-size:.81rem;font-weight:600;color:#334155}.dark .desktop-toggles label{color:#dbeafe}.desktop-toggles input{margin-top:.15rem;accent-color:#2563eb}
       .desktop-hotkeys{display:flex;gap:.45rem .9rem;flex-wrap:wrap;margin:.75rem 0;color:#475569;font-size:.74rem}.dark .desktop-hotkeys{color:#cbd5e1}.desktop-hotkeys kbd{padding:.13rem .3rem;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:.3rem;background:#fff;color:#334155;font:700 .68rem ui-monospace,monospace}.dark .desktop-hotkeys kbd{border-color:#475569;background:#0f172a;color:#e2e8f0}.desktop-log-heading{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-top:.8rem;color:#0f3b88;font-size:.84rem}.dark .desktop-log-heading{color:#bfdbfe}.desktop-log-heading button{border:0;background:transparent;color:#2563eb;font-size:.76rem;font-weight:700;text-decoration:underline;cursor:pointer}.desktop-scan-log{display:grid;gap:.38rem;margin-top:.45rem}.desktop-log-item{padding:.5rem .6rem;border-left:3px solid #93c5fd;border-radius:.45rem;background:rgba(255,255,255,.68)}.desktop-log-item[data-variant=warning]{border-color:#f59e0b}.desktop-log-item[data-variant=success]{border-color:#22c55e}.desktop-log-item[data-variant=error]{border-color:#ef4444}.dark .desktop-log-item{background:rgba(15,23,42,.48)}.desktop-log-item span{display:block;color:#64748b;font-size:.67rem}.dark .desktop-log-item span{color:#94a3b8}.desktop-log-item strong{display:block;margin-top:.1rem;color:#334155;font-size:.74rem;line-height:1.35}.dark .desktop-log-item strong{color:#e2e8f0}.desktop-log-empty{margin:.35rem 0!important;color:#64748b!important;font-size:.76rem!important}
       .desktop-status{border-left:3px solid #93c5fd;padding-left:.65rem}.desktop-status[data-variant=warning]{border-color:#f59e0b;color:#92400e}.desktop-status[data-variant=success]{border-color:#22c55e;color:#166534}.desktop-status[data-variant=error]{border-color:#ef4444;color:#b91c1c}@media(max-width:640px){.desktop-toggles{grid-template-columns:1fr}.desktop-scan-heading{flex-direction:column;gap:.35rem}}
    `;
    document.head.appendChild(css);
  }

  function wrapResultRenderer() {
    const original = window.renderResult;
    if (typeof original !== 'function') return;
    window.renderResult = function wrappedRenderResult(data, text, language) {
      const result = original.apply(this, arguments);
      const risk = String(data?.risk || '').toUpperCase();
      if (risk.includes('NGUY_HIEM') || risk.includes('HIGH') || risk.includes('DANGEROUS')) {
        notify('ScamCheck - dấu hiệu rủi ro cao', String(data?.title || label('Cần xác minh qua kênh chính thức.', 'Verify through an official channel.')));
      }
      return result;
    };
  }

  window.addEventListener('load', async () => {
    injectStyle();
    injectPanel();
    wrapResultRenderer();
    try {
      preferences = { ...preferences, ...(await bridge.getPreferences()) };
      byId('desktopClipboardWatch').checked = preferences.clipboardWatch;
      byId('desktopScreenWatch').checked = preferences.screenWatch;
      byId('desktopAutoAnalyze').checked = preferences.autoAnalyze;
      byId('desktopStartOnLogin').checked = preferences.startOnLogin;
      await refreshScanLog();
    } catch (error) {
      console.error('Could not load desktop preferences:', error);
    }
  });

  bridge.onClipboardText(payload => ingestText(payload?.text, { source: 'clipboard', automatic: Boolean(payload?.automatic) }));
  bridge.onScreenImages(payload => processScreens(payload?.screens, Boolean(payload?.automatic)));
})();
