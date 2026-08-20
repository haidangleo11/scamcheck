importScripts('offline-patterns.js');

const API_BASE_URL = 'https://scamcheck-c3chuyenhvt.vercel.app';
const CHAT_ENDPOINT = API_BASE_URL + '/api/chat';
const MAX_TEXT_LENGTH = 8000;
const MAX_CAPTURE_EDGE = 2200;

function trimText(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function cleanJson(text) {
  return String(text || '')
    .replace(/^\x60{3}(?:json)?\s*/i, '')
    .replace(/\s*\x60{3}$/i, '')
    .trim();
}

function extractUrls(text) {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>'"\x60]+|\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(?:\/[^\s<>'"\x60]*)?/g;
  const seen = new Set();
  return (String(text || '').match(urlRegex) || [])
    .map(function (url) { return url.replace(/[),.;!?]+$/, ''); })
    .filter(function (url) {
      const key = url.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function sendStatus(tabId, message, tone) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      target: 'SCAMCHECK_CONTENT',
      type: 'SCAMCHECK_STATUS',
      message: message,
      tone: tone || 'info'
    });
  } catch {
    // Tab may have navigated away after the user releases the mouse.
  }
}

async function startSelectionInActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0] && tabs[0].id;
  if (!tabId) throw new Error('Không tìm thấy tab đang mở.');

  const startMessage = {
    target: 'SCAMCHECK_CONTENT',
    type: 'SCAMCHECK_START_SELECTION'
  };

  try {
    await chrome.tabs.sendMessage(tabId, startMessage);
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, startMessage);
  }
}

async function sendContentMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readSelectedTextInActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0] && tabs[0].id;
  if (!tabId) return { ok: false, error: 'Không tìm thấy tab đang mở.' };

  try {
    const response = await sendContentMessage(tabId, {
      target: 'SCAMCHECK_CONTENT',
      type: 'SCAMCHECK_READ_SELECTED_TEXT'
    });
    const text = trimText(response && response.text, MAX_TEXT_LENGTH);
    if (!response || !response.ok || !text) {
      return { ok: false, error: 'Hãy bôi đen đoạn tin nhắn trên trang rồi thử lại.' };
    }
    await chrome.storage.session.set({
      scamcheckLatest: { text: text, createdAt: Date.now(), source: 'selection' }
    });
    return { ok: true, text: text, source: 'selection' };
  } catch {
    return { ok: false, error: 'Trang này không cho phép đọc phần chữ đã bôi đen.' };
  }
}

async function getActivePageHost() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0] && tabs[0].url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.hostname : null;
  } catch {
    return null;
  }
}

async function getAutomaticGuardStatus() {
  const host = await getActivePageHost();
  if (!host) return { ok: false };
  const stored = await chrome.storage.local.get(['scamcheckUi', 'scamcheckMutedHosts']);
  const mutedHosts = Array.isArray(stored.scamcheckMutedHosts) ? stored.scamcheckMutedHosts : [];
  return {
    ok: true,
    host: host,
    muted: mutedHosts.includes(host),
    enabled: Boolean(stored.scamcheckUi && stored.scamcheckUi.autoAiScan === true)
  };
}

async function refreshAutoGuardInActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0] && tabs[0].id;
  if (!tabId) return { ok: false };
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
    return { ok: true };
  } catch {
    // Chrome blocks extension code on its own internal pages and some stores.
    return { ok: false };
  }
}

async function toggleActivePageMute() {
  const host = await getActivePageHost();
  if (!host) return { ok: false };
  const stored = await chrome.storage.local.get('scamcheckMutedHosts');
  const mutedHosts = Array.isArray(stored.scamcheckMutedHosts) ? stored.scamcheckMutedHosts : [];
  const index = mutedHosts.indexOf(host);
  const muted = index < 0;
  if (muted) mutedHosts.push(host);
  else mutedHosts.splice(index, 1);
  await chrome.storage.local.set({ scamcheckMutedHosts: mutedHosts.slice(-100) });
  return { ok: true, host: host, muted: muted };
}

async function ensureOcrDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('ocr.html')]
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'ocr.html',
    reasons: ['WORKERS'],
    justification: 'Chạy OCR cục bộ bằng WebAssembly cho vùng ảnh do người dùng khoanh.'
  });
}

async function showAnalysisOverlay(result) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) return;

  const message = {
    target: 'SCAMCHECK_CONTENT',
    type: 'SCAMCHECK_SHOW_ANALYSIS',
    analysis: result.analysis || {},
    rag: result.rag || null,
    offline: Boolean(result.offline),
    language: result.language === 'en' ? 'en' : 'vi'
  };

  try {
    await sendContentMessage(tab.id, message);
  } catch {
    // Some pages do not allow extension scripts. The popup still keeps the result.
  }
}

function dataUrlToBlob(dataUrl) {
  const separatorIndex = dataUrl.indexOf(',');
  if (separatorIndex < 0) {
    throw new Error('Ảnh chụp không hợp lệ.');
  }

  const header = dataUrl.slice(0, separatorIndex);
  const binary = atob(dataUrl.slice(separatorIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const mimeMatch = /^data:([^;]+)/i.exec(header);
  return new Blob([bytes], { type: mimeMatch ? mimeMatch[1] : 'image/png' });
}

async function cropVisibleCapture(windowId, rect) {
  const screenshot = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const sourceBlob = dataUrlToBlob(screenshot);
  const bitmap = await createImageBitmap(sourceBlob);
  const viewportWidth = Math.max(1, Number(rect.viewportWidth) || bitmap.width);
  const viewportHeight = Math.max(1, Number(rect.viewportHeight) || bitmap.height);
  const scaleX = bitmap.width / viewportWidth;
  const scaleY = bitmap.height / viewportHeight;
  const sourceX = Math.max(0, Math.floor(Number(rect.left) * scaleX));
  const sourceY = Math.max(0, Math.floor(Number(rect.top) * scaleY));
  const sourceWidth = Math.min(bitmap.width - sourceX, Math.max(1, Math.floor(Number(rect.width) * scaleX)));
  const sourceHeight = Math.min(bitmap.height - sourceY, Math.max(1, Math.floor(Number(rect.height) * scaleY)));
  const downscale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(sourceWidth, sourceHeight));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(sourceWidth * downscale)),
    Math.max(1, Math.round(sourceHeight * downscale))
  );
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await croppedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
  }
  return 'data:image/png;base64,' + btoa(binary);
}

async function captureAndRecognize(tab, rect) {
  await sendStatus(tab.id, 'Đang chụp phần bạn đã khoanh…', 'info');
  const imageDataUrl = await cropVisibleCapture(tab.windowId, rect);
  await ensureOcrDocument();
  await sendStatus(tab.id, 'Đang OCR cục bộ trên máy…', 'info');
  const result = await chrome.runtime.sendMessage({
    target: 'SCAMCHECK_OCR_DOCUMENT',
    type: 'SCAMCHECK_RECOGNIZE',
    imageDataUrl: imageDataUrl
  });

  if (!result || !result.ok) {
    throw new Error(result && result.error ? result.error : 'Không nhận được kết quả OCR.');
  }

  const text = trimText(result.text, MAX_TEXT_LENGTH);
  await chrome.storage.session.set({
    scamcheckLatest: {
      text: text,
      createdAt: Date.now(),
      source: 'ocr'
    }
  });
  await sendStatus(tab.id, text ? 'OCR xong. Bấm lại ScamCheck để kiểm tra AI.' : 'Không nhận ra chữ rõ ràng. Hãy khoanh vùng sát hơn và thử lại.', text ? 'success' : 'warning');
  return { ok: true, text: text };
}

async function analyzeText(text, preferredLanguage, mode) {
  const safeText = trimText(text, MAX_TEXT_LENGTH);
  if (!safeText) return { ok: false, error: 'Chưa có nội dung để phân tích.' };
  const isEnglish = preferredLanguage === 'en';
  const isAutoGuard = mode === 'auto_guard';

  const urls = extractUrls(safeText);

  function buildOfflineFallback() {
    const matches = self.ScamCheckOfflineRag && typeof self.ScamCheckOfflineRag.find === 'function'
      ? self.ScamCheckOfflineRag.find(safeText)
      : [];
    const hasCriticalMatch = matches.some(function (match) { return match.risk === 'CRITICAL'; });
    const risk = matches.length ? (hasCriticalMatch ? 'CRITICAL' : 'HIGH') : 'UNKNOWN';
    return {
      ok: true,
      offline: true,
      analysis: {
        risk: risk,
        confidence: 0,
        summary: matches.length
          ? (isEnglish
            ? 'The AI is unavailable. The extension found similar local reference patterns; verify through an official channel.'
            : 'Không thể kết nối AI. Extension chỉ tìm thấy mẫu tham chiếu cục bộ gần giống; hãy xác minh qua kênh chính thức.')
          : (isEnglish
            ? 'The AI is unavailable and local patterns are not enough to reach a conclusion. Pause and verify through an official channel.'
            : 'Không thể kết nối AI và chưa có đủ mẫu cục bộ để kết luận. Hãy tạm dừng thao tác và xác minh qua kênh chính thức.'),
        redFlags: matches.flatMap(function (match) { return match.matchedSignals || []; }).slice(0, 5),
        linkAssessments: urls.map(function (url) {
          return {
            url: url,
            risk: 'UNKNOWN',
            reasons: [isEnglish ? 'No AI connection is available to assess this link.' : 'Chưa có kết nối AI để đánh giá link.']
          };
        }),
        safeActions: isEnglish
          ? ['Do not open links, transfer money, or share one-time codes.', 'Contact the organisation through its official app, website, or hotline.']
          : ['Không bấm link, chuyển tiền hoặc cung cấp OTP.', 'Tự liên hệ tổ chức liên quan qua ứng dụng, website hoặc hotline chính thức.']
      },
      urls: urls,
      rag: { enabled: true, source: 'offline', version: self.ScamCheckOfflineRag ? self.ScamCheckOfflineRag.version : 'unknown', matches: matches }
    };
  }

  async function storeAndShow(result) {
    result.language = isEnglish ? 'en' : 'vi';
    await chrome.storage.session.set({ scamcheckAnalysis: result });
    await showAnalysisOverlay(result);
    return result;
  }

  const prompt = isAutoGuard
    ? (isEnglish
      ? [
        'You are ScamCheck automatic protection. Inspect this visible-page snapshot for online-scam warning signs.',
        'The backend system context contains the full ScamCheck scam catalogue. Use it as educational reference; do not visit links or make identity claims.',
        'Return valid JSON only, without Markdown:',
        '{"shouldWarn":true|false,"risk":"LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN","confidence":0.0,"summary":"...","redFlags":["..."],"safeActions":["..."]}',
        'Set shouldWarn to true only for meaningful evidence that warrants an on-page safety warning. A strange-looking domain alone is not enough. Write every human-readable value in English.',
        'VISIBLE PAGE SNAPSHOT: ' + safeText,
        'EXTRACTED URLS: ' + (urls.length ? urls.join(', ') : 'No clear URL.')
      ].join('\n')
      : [
        'Bạn là chế độ bảo vệ tự động của ScamCheck. Hãy kiểm tra ảnh chụp chữ đang hiển thị trên trang xem có dấu hiệu lừa đảo trực tuyến không.',
        'Ngữ cảnh hệ thống của backend chứa đầy đủ danh mục lừa đảo ScamCheck. Chỉ dùng làm tham khảo giáo dục; không truy cập link và không khẳng định danh tính.',
        'Trả về JSON hợp lệ, không Markdown:',
        '{"shouldWarn":true|false,"risk":"LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN","confidence":0.0,"summary":"...","redFlags":["..."],"safeActions":["..."]}',
        'Chỉ đặt shouldWarn=true khi có bằng chứng đáng kể cần cảnh báo trên trang. Một tên miền trông lạ đơn lẻ chưa đủ. Mọi chữ phải là tiếng Việt Unicode có dấu.',
        'ẢNH CHỤP NỘI DUNG HIỂN THỊ: ' + safeText,
        'URL ĐÃ TÁCH: ' + (urls.length ? urls.join(', ') : 'Không có URL rõ ràng.')
      ].join('\n'))
    : isEnglish
    ? [
      'You are an online-scam safety specialist.',
      'Use only the text and URLs below. Do not visit URLs, verify the sender, or assume that a domain is safe.',
      'Return valid JSON only, without Markdown:',
      '{"risk":"LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN","confidence":0.0,"summary":"...","redFlags":["..."],"linkAssessments":[{"url":"...","risk":"SAFE|SUSPICIOUS|DANGEROUS|UNKNOWN","reasons":["..."]}],"safeActions":["..."]}',
      'Write every human-readable value in English. If evidence is insufficient, use UNKNOWN and state the limitation.',
      'MESSAGE: ' + safeText,
      'EXTRACTED URLS: ' + (urls.length ? urls.join(', ') : 'No clear URL.')
    ].join('\n')
    : [
      'Bạn là chuyên gia chống lừa đảo trực tuyến tại Việt Nam.',
      'Chỉ dùng văn bản và URL dưới đây; không truy cập URL, không xác minh danh tính người gửi và không tự cho rằng một tên miền là an toàn.',
      'Trả về JSON hợp lệ, không Markdown:',
      '{"risk":"LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN","confidence":0.0,"summary":"...","redFlags":["..."],"linkAssessments":[{"url":"...","risk":"SAFE|SUSPICIOUS|DANGEROUS|UNKNOWN","reasons":["..."]}],"safeActions":["..."]}',
      'Mọi chữ phải là tiếng Việt Unicode có dấu. Nếu chưa đủ dữ kiện, dùng UNKNOWN và nói rõ giới hạn.',
      'TIN NHẮN: ' + safeText,
      'URL ĐÃ TÁCH: ' + (urls.length ? urls.join(', ') : 'Không có URL rõ ràng.')
    ].join('\n');

  try {
    const response = await fetchWithTimeout(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: isAutoGuard ? 'openai/gpt-oss-20b' : 'llama-3.3-70b-versatile',
        scamcheck_mode: isAutoGuard ? 'auto_guard' : 'extension_scan',
        response_format: { type: 'json_object' },
        temperature: isAutoGuard ? 0 : 0.2,
        max_tokens: isAutoGuard ? 500 : 1200,
        messages: [
          { role: 'system', content: isAutoGuard ? 'Return only one valid JSON object that follows the requested automatic-guard schema.' : 'Bạn chỉ trả về một JSON hợp lệ theo yêu cầu.' },
          { role: 'user', content: prompt }
        ]
      })
    }, isAutoGuard ? 12000 : 20000);
    const raw = await response.text();
    if (!response.ok) {
      let message = 'API phân tích trả về lỗi ' + response.status + '.';
      try {
        const failure = JSON.parse(raw);
        message = failure && failure.error && failure.error.message ? failure.error.message : message;
      } catch {
        // Keep the status-based message only.
      }
      if (isAutoGuard) return { ok: true, automatic: true, shouldWarn: false, unavailable: true };
      if (response.status >= 500) return storeAndShow(buildOfflineFallback());
      return { ok: false, error: message };
    }

    const data = JSON.parse(raw);
    const content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    const analysis = JSON.parse(cleanJson(content));
    const result = {
      ok: true,
      automatic: isAutoGuard,
      shouldWarn: isAutoGuard
        ? analysis.shouldWarn === true && ['HIGH', 'CRITICAL'].includes(String(analysis.risk || '').toUpperCase())
        : true,
      analysis: analysis,
      urls: urls,
      rag: data.scamcheckRag || null,
      language: isEnglish ? 'en' : 'vi'
    };
    if (isAutoGuard) return result;
    return storeAndShow(result);
  } catch {
    if (isAutoGuard) return { ok: true, automatic: true, shouldWarn: false, unavailable: true };
    return storeAndShow(buildOfflineFallback());
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.target === 'SCAMCHECK_OCR_DOCUMENT') return undefined;

  if (message.type === 'SCAMCHECK_START_SELECTION') {
    startSelectionInActiveTab()
      .then(function () { sendResponse({ ok: true }); })
      .catch(function () {
        sendResponse({ ok: false, error: 'Trang này không hỗ trợ khoanh vùng. Hãy mở một trang web thông thường rồi thử lại.' });
      });
    return true;
  }

  if (message.type === 'SCAMCHECK_READ_SELECTION') {
    readSelectedTextInActiveTab().then(sendResponse);
    return true;
  }

  if (message.type === 'SCAMCHECK_GET_AUTO_GUARD_STATUS') {
    getAutomaticGuardStatus().then(sendResponse).catch(function () { sendResponse({ ok: false }); });
    return true;
  }

  if (message.type === 'SCAMCHECK_REFRESH_AUTO_GUARD') {
    refreshAutoGuardInActiveTab().then(sendResponse).catch(function () { sendResponse({ ok: false }); });
    return true;
  }

  if (message.type === 'SCAMCHECK_TOGGLE_SITE_MUTE') {
    toggleActivePageMute().then(sendResponse).catch(function () { sendResponse({ ok: false }); });
    return true;
  }

  if (message.type === 'SCAMCHECK_CAPTURE_SELECTION') {
    captureAndRecognize(sender.tab, message.rect)
      .then(sendResponse)
      .catch(function (error) {
        sendStatus(sender.tab && sender.tab.id, 'OCR không thành công. ' + (error && error.message ? error.message : ''), 'error');
        sendResponse({ ok: false, error: error && error.message ? error.message : 'Không thể OCR vùng ảnh.' });
      });
    return true;
  }

  if (message.type === 'SCAMCHECK_ANALYZE_TEXT') {
    analyzeText(message.text, message.language, 'extension_scan').then(sendResponse);
    return true;
  }

  if (message.type === 'SCAMCHECK_AUTO_ANALYZE') {
    analyzeText(message.text, message.language, 'auto_guard').then(sendResponse);
    return true;
  }

  return undefined;
});
