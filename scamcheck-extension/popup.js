(function () {
  var messageText = document.getElementById('messageText');
  var captureButton = document.getElementById('captureButton');
  var readSelectionButton = document.getElementById('readSelectionButton');
  var analyzeButton = document.getElementById('analyzeButton');
  var languageButton = document.getElementById('languageButton');
  var themeButton = document.getElementById('themeButton');
  var autoProtectionToggle = document.getElementById('autoProtectionToggle');
  var siteMuteButton = document.getElementById('siteMuteButton');
  var statusNode = document.getElementById('status');
  var resultNode = document.getElementById('result');
  var language = 'vi';
  var theme = 'light';
  // AI Auto Guard is deliberately opt-in: it can send a limited snapshot of
  // visible page text to ScamCheck's AI endpoint for automatic assessment.
  var autoAiScan = false;
  var currentSiteMuted = false;

  var copy = {
    vi: { tagline: 'AN TOÀN KHÔNG GIAN SỐ', trustStrip: 'RAG tham chiếu · OCR cục bộ · Không tự mở link', eyebrow: 'KIỂM TRA NHANH', quickCheck: 'Quét tin nhắn đáng ngờ', privateBadge: 'Riêng tư', readSelection: 'Đọc phần đã bôi đen', captureScreen: 'Quét ảnh trên trang', privacyNote: 'Chỉ phần chữ bạn chọn hoặc nội dung bạn dán được kiểm tra. Ảnh được OCR ngay trên máy.', messageLabel: 'Tin nhắn cần kiểm tra', messagePlaceholder: 'Dán tin nhắn, hoặc đọc phần chữ đã bôi đen…', sampleBank: 'Mẫu: Ngân hàng', sampleAuthority: 'Mẫu: Công an', sampleSafe: 'Mẫu: An toàn', analyzeButton: 'Phân tích với ScamCheck', resultEyebrow: 'KẾT QUẢ PHÂN TÍCH', redFlagsTitle: 'Dấu hiệu cần chú ý', safeActionsTitle: 'Việc nên làm', linksTitle: 'Đánh giá từng link', ragTitle: 'Mẫu tham chiếu RAG gần giống', ragNote: 'Mẫu tham chiếu hỗ trợ AI, không thay thế cảnh báo chính thức.', footer: 'ScamCheck là công cụ giáo dục. Hãy luôn xác minh qua kênh chính thức.', riskLabel: 'Mức rủi ro', risk_UNKNOWN: 'Chưa đủ dữ kiện', risk_LOW: 'Thấp', risk_MEDIUM: 'Trung bình', risk_HIGH: 'Cao', risk_CRITICAL: 'Nghiêm trọng', loadingSelection: 'Đang đọc phần chữ đã bôi đen…', selectionEmpty: 'Hãy bôi đen đoạn tin nhắn trên trang rồi thử lại.', selectionLoaded: 'Đã nạp phần chữ bạn đã bôi đen. Bạn có thể sửa trước khi phân tích.', captureStarting: 'Đang bật công cụ khoanh vùng…', captureUnavailable: 'Không thể bắt đầu khoanh vùng ở trang này.', analyzing: 'Đang gửi phần chữ và các link tới AI để phân tích…', aiUnavailable: 'AI chưa phản hồi.', aiDone: 'Đã nhận kết quả AI.', offlineDone: 'AI chưa kết nối được; đã hiển thị đối chiếu cục bộ.', connectionError: 'Không thể kết nối API AI.', ocrLoaded: 'Đã nạp nội dung OCR gần nhất. Bạn có thể sửa trước khi phân tích.', offlineNotice: 'Đang dùng đối chiếu cục bộ dự phòng; chưa có kết quả AI trực tuyến.', switchLanguage: 'Switch to English', darkMode: 'Bật chế độ tối', lightMode: 'Bật chế độ sáng' },
    en: { tagline: 'SAFER DIGITAL LIFE', trustStrip: 'Reference RAG · On-device OCR · Never opens links', eyebrow: 'QUICK CHECK', quickCheck: 'Scan a suspicious message', privateBadge: 'Private', readSelection: 'Read selected text', captureScreen: 'Scan an image area', privacyNote: 'Only text you select or paste is checked. Images are processed with on-device OCR.', messageLabel: 'Message to check', messagePlaceholder: 'Paste a message, or read selected text from the page…', sampleBank: 'Sample: Bank', sampleAuthority: 'Sample: Police', sampleSafe: 'Sample: Safe', analyzeButton: 'Analyse with ScamCheck', resultEyebrow: 'ANALYSIS RESULT', redFlagsTitle: 'Warning signs', safeActionsTitle: 'What to do', linksTitle: 'Link assessment', ragTitle: 'Similar RAG reference patterns', ragNote: 'Reference patterns assist the AI; they are not an official warning.', footer: 'ScamCheck is an educational tool. Always verify through official channels.', riskLabel: 'Risk level', risk_UNKNOWN: 'Not enough evidence', risk_LOW: 'Low', risk_MEDIUM: 'Medium', risk_HIGH: 'High', risk_CRITICAL: 'Critical', loadingSelection: 'Reading selected text…', selectionEmpty: 'Select the message text on the page, then try again.', selectionLoaded: 'Selected text is ready. You can edit it before analysis.', captureStarting: 'Opening the area selector…', captureUnavailable: 'The area selector is unavailable on this page.', analyzing: 'Sending the text and any links to the AI for analysis…', aiUnavailable: 'The AI did not respond.', aiDone: 'AI result received.', offlineDone: 'The AI is unavailable; a local pattern check is shown.', connectionError: 'Unable to connect to the AI service.', ocrLoaded: 'The most recent OCR text is ready. You can edit it before analysis.', offlineNotice: 'Using a local fallback pattern check; no online AI result is available.', switchLanguage: 'Chuyển sang tiếng Việt', darkMode: 'Enable dark mode', lightMode: 'Enable light mode' }
  };
  var sampleMessages = {
    vi: { bank: 'Tài khoản VCB của bạn sẽ bị khóa sau 2 giờ. Vui lòng đăng nhập www.vcb-update.com để xác thực.', authority: 'Công an thông báo bạn liên quan đến vụ án rửa tiền. Hãy chuyển tiền vào tài khoản tạm giữ để chứng minh vô tội.', safe: 'Ứng dụng gọi xe chính thức thông báo tài xế của bạn đã đến điểm đón.' },
    en: { bank: 'Your bank account will be locked in 2 hours. Verify immediately at www.vcb-update.com.', authority: 'Police say you are linked to a money-laundering case. Transfer money to a temporary account to prove your innocence.', safe: 'The official ride-hailing app notifies you that your driver has arrived at the pickup point.' }
  };
  Object.assign(copy.vi, {
    autoProtectionTitle: 'Bảo vệ tự động bằng AI',
    autoProtectionNote: 'Khi bật, chữ đang hiển thị được gửi cho ScamCheck AI; không lấy biểu mẫu hay mật khẩu.',
    muteSite: 'Tắt cảnh báo ở website này',
    unmuteSite: 'Bật lại cảnh báo ở website này',
    siteMuted: 'Đã tắt cảnh báo cho website này.',
    siteUnmuted: 'Đã bật lại cảnh báo cho website này.'
  });
  Object.assign(copy.en, {
    autoProtectionTitle: 'AI Auto Guard',
    autoProtectionNote: 'When enabled, visible page text is sent to ScamCheck AI; forms and passwords are excluded.',
    muteSite: 'Mute warnings on this site',
    unmuteSite: 'Restore warnings on this site',
    siteMuted: 'Warnings are muted for this site.',
    siteUnmuted: 'Warnings are enabled for this site.'
  });
  var englishPatternNames = { 'vneid-dichvucong-fakeapp': 'Fake VNeID / public-service app', 'tax-refund-fake': 'Fake tax refund or tax settlement', 'bank-login-phishing': 'Fake bank account alert / phishing', 'authority-temporary-account': 'Fake authority temporary-account request', 'job-task-advance-fee': 'Fake online task / commission job', 'telegram-investment-group': 'Telegram/Zalo investment group scam', 'delivery-fee-link': 'Fake delivery-fee link', 'prize-tax-refund': 'Fake prize or loyalty gift', 'sim-identity-takeover': 'SIM lock / identity-update scam', 'impersonation-friend-urgent-transfer': 'Impersonated friend urgent-transfer scam', 'lawyer-scam-recovery': 'Fake fund-recovery service', 'romance-scam-customs': 'Romance / customs-fee scam', 'flight-tour-cheap': 'Too-good-to-be-true flight or tour offer', 'child-hospital-emergency': 'Fake child hospital emergency call', 'generic-free-money-lure': 'Free-money or prize link lure' };

  function t(key) { return copy[language][key] || copy.vi[key] || key; }
  function setStatus(message, tone) { statusNode.textContent = message || ''; statusNode.dataset.tone = tone || 'info'; }
  function updateAnalyzeState() { analyzeButton.disabled = !messageText.value.trim(); }
  function applyPreferences() {
    document.documentElement.lang = language;
    document.body.classList.toggle('is-dark', theme === 'dark');
    document.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) { node.placeholder = t(node.dataset.i18nPlaceholder); });
    languageButton.textContent = language === 'vi' ? 'EN' : 'VI';
    languageButton.title = t('switchLanguage'); languageButton.setAttribute('aria-label', t('switchLanguage'));
    themeButton.textContent = theme === 'dark' ? '☀' : '☾';
    themeButton.title = theme === 'dark' ? t('lightMode') : t('darkMode'); themeButton.setAttribute('aria-label', themeButton.title);
    autoProtectionToggle.checked = autoAiScan;
    if (!siteMuteButton.hidden) siteMuteButton.textContent = t(currentSiteMuted ? 'unmuteSite' : 'muteSite');
  }
  function savePreferences() { return chrome.storage.local.set({ scamcheckUi: { language: language, theme: theme, autoAiScan: autoAiScan } }); }
  function setList(id, values, formatter) {
    var node = document.getElementById(id); node.replaceChildren();
    (Array.isArray(values) ? values : []).slice(0, 5).forEach(function (value) { var item = document.createElement('li'); item.textContent = formatter ? formatter(value) : String(value); node.appendChild(item); });
  }
  function displayPatternName(match) { return language === 'en' && englishPatternNames[match && match.id] ? englishPatternNames[match.id] : String(match && (match.title || match.category) || 'Reference pattern'); }
  function renderResult(analysis, rag, offline) {
    var riskCode = String(analysis.risk || 'UNKNOWN').toUpperCase();
    document.getElementById('riskBadge').textContent = riskCode;
    document.getElementById('risk').textContent = t('riskLabel') + ': ' + t('risk_' + riskCode);
    document.getElementById('summary').textContent = String(analysis.summary || t('risk_UNKNOWN'));
    resultNode.className = 'card result-card risk-' + riskCode.toLowerCase();
    setList('redFlags', analysis.redFlags); setList('safeActions', analysis.safeActions);
    var links = document.getElementById('links'); links.replaceChildren();
    var assessments = Array.isArray(analysis.linkAssessments) ? analysis.linkAssessments : [];
    assessments.slice(0, 8).forEach(function (assessment) { var item = document.createElement('li'); var reasons = Array.isArray(assessment.reasons) ? assessment.reasons.join('; ') : ''; item.textContent = String(assessment.url || 'Link') + ' — ' + String(assessment.risk || 'UNKNOWN') + (reasons ? ': ' + reasons : ''); links.appendChild(item); });
    document.getElementById('linksBlock').hidden = assessments.length === 0;
    var ragMatches = document.getElementById('ragMatches'); ragMatches.replaceChildren();
    var matches = rag && Array.isArray(rag.matches) ? rag.matches : [];
    matches.slice(0, 3).forEach(function (match) { var item = document.createElement('li'); var signals = language === 'vi' && Array.isArray(match.matchedSignals) && match.matchedSignals.length ? ' (' + match.matchedSignals.join(', ') + ')' : ''; item.textContent = displayPatternName(match) + signals; ragMatches.appendChild(item); });
    document.getElementById('ragBlock').hidden = matches.length === 0;
    document.getElementById('resultSource').hidden = !matches.length;
    var source = document.getElementById('analysisSource'); source.hidden = !offline; source.textContent = offline ? t('offlineNotice') : '';
    resultNode.hidden = false;
  }
  function loadSample(sample) { messageText.value = sampleMessages[language][sample] || ''; resultNode.hidden = true; setStatus(''); updateAnalyzeState(); messageText.focus(); }

  readSelectionButton.addEventListener('click', function () {
    setStatus(t('loadingSelection'));
    chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_READ_SELECTION' }).then(function (response) {
      if (!response || !response.ok || !response.text) { setStatus(response && response.error ? response.error : t('selectionEmpty'), 'error'); return; }
      messageText.value = response.text; resultNode.hidden = true; setStatus(t('selectionLoaded'), 'success'); updateAnalyzeState();
    }).catch(function () { setStatus(t('selectionEmpty'), 'error'); });
  });
  captureButton.addEventListener('click', function () {
    setStatus(t('captureStarting'));
    chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_START_SELECTION' }).then(function (response) {
      if (!response || !response.ok) { setStatus(response && response.error ? response.error : t('captureUnavailable'), 'error'); return; }
      window.close();
    }).catch(function () { setStatus(t('captureUnavailable'), 'error'); });
  });
  messageText.addEventListener('input', updateAnalyzeState);
  document.querySelectorAll('[data-sample]').forEach(function (button) { button.addEventListener('click', function () { loadSample(button.dataset.sample); }); });
  languageButton.addEventListener('click', function () {
    language = language === 'vi' ? 'en' : 'vi';
    resultNode.hidden = true;
    document.getElementById('analysisSource').hidden = true;
    applyPreferences();
    savePreferences();
    setStatus('');
  });
  themeButton.addEventListener('click', function () { theme = theme === 'dark' ? 'light' : 'dark'; applyPreferences(); savePreferences(); });
  autoProtectionToggle.addEventListener('change', function () {
    autoAiScan = autoProtectionToggle.checked;
    savePreferences();
  });
  siteMuteButton.addEventListener('click', function () {
    chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_TOGGLE_SITE_MUTE' }).then(function (response) {
      if (!response || !response.ok) return;
      currentSiteMuted = Boolean(response.muted);
      siteMuteButton.textContent = t(currentSiteMuted ? 'unmuteSite' : 'muteSite');
      setStatus(t(currentSiteMuted ? 'siteMuted' : 'siteUnmuted'), 'success');
    });
  });
  analyzeButton.addEventListener('click', function () {
    analyzeButton.disabled = true; setStatus(t('analyzing'));
    chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_ANALYZE_TEXT', text: messageText.value, language: language }).then(function (response) {
      if (!response || !response.ok) { setStatus(response && response.error ? response.error : t('aiUnavailable'), 'error'); return; }
      renderResult(response.analysis || {}, response.rag || null, response.offline); setStatus(response.offline ? t('offlineDone') : t('aiDone'), response.offline ? 'info' : 'success');
    }).catch(function () { setStatus(t('connectionError'), 'error'); }).finally(updateAnalyzeState);
  });
  Promise.all([chrome.storage.local.get('scamcheckUi'), chrome.storage.session.get(['scamcheckLatest', 'scamcheckAnalysis'])]).then(function (stored) {
    var preferences = stored[0] && stored[0].scamcheckUi;
    if (preferences && (preferences.language === 'vi' || preferences.language === 'en')) language = preferences.language;
    if (preferences && (preferences.theme === 'light' || preferences.theme === 'dark')) theme = preferences.theme;
    if (preferences && typeof preferences.autoAiScan === 'boolean') autoAiScan = preferences.autoAiScan;
    applyPreferences();
    var session = stored[1] || {};
    if (session.scamcheckLatest && session.scamcheckLatest.text) { messageText.value = session.scamcheckLatest.text; setStatus(t('ocrLoaded')); }
    if (session.scamcheckAnalysis && session.scamcheckAnalysis.ok && (session.scamcheckAnalysis.language || 'vi') === language) {
      renderResult(session.scamcheckAnalysis.analysis || {}, session.scamcheckAnalysis.rag || null, session.scamcheckAnalysis.offline);
    }
    updateAnalyzeState();
    return chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_GET_AUTO_GUARD_STATUS' });
  }).then(function (guardStatus) {
    if (!guardStatus || !guardStatus.ok) return;
    currentSiteMuted = Boolean(guardStatus.muted);
    siteMuteButton.hidden = false;
    siteMuteButton.textContent = t(currentSiteMuted ? 'unmuteSite' : 'muteSite');
  }).catch(function () { applyPreferences(); updateAnalyzeState(); });
}());
