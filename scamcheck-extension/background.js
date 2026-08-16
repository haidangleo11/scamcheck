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

async function analyzeText(text) {
  const safeText = trimText(text, MAX_TEXT_LENGTH);
  if (!safeText) return { ok: false, error: 'Chưa có nội dung để phân tích.' };

  const urls = extractUrls(safeText);
  const prompt = [
    'Bạn là chuyên gia chống lừa đảo trực tuyến tại Việt Nam.',
    'Chỉ dùng văn bản và URL dưới đây; không truy cập URL, không xác minh danh tính người gửi và không tự cho rằng một tên miền là an toàn.',
    'Trả về JSON hợp lệ, không Markdown:',
    '{"risk":"LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN","confidence":0.0,"summary":"...","redFlags":["..."],"linkAssessments":[{"url":"...","risk":"SAFE|SUSPICIOUS|DANGEROUS|UNKNOWN","reasons":["..."]}],"safeActions":["..."]}',
    'Mọi chữ phải là tiếng Việt Unicode có dấu. Nếu chưa đủ dữ kiện, dùng UNKNOWN và nói rõ giới hạn.',
    'TIN NHẮN: ' + safeText,
    'URL ĐÃ TÁCH: ' + (urls.length ? urls.join(', ') : 'Không có URL rõ ràng.')
  ].join('\n');

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Bạn chỉ trả về một JSON hợp lệ theo yêu cầu.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = 'API phân tích trả về lỗi ' + response.status + '.';
      try {
        const failure = JSON.parse(raw);
        message = failure && failure.error && failure.error.message ? failure.error.message : message;
      } catch {
        // Keep the status-based message only.
      }
      return { ok: false, error: message };
    }

    const data = JSON.parse(raw);
    const content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    const analysis = JSON.parse(cleanJson(content));
    const result = { ok: true, analysis: analysis, urls: urls };
    await chrome.storage.session.set({ scamcheckAnalysis: result });
    return result;
  } catch {
    return { ok: false, error: 'Không thể kết nối API AI. Kiểm tra Vercel, GROQ_API_KEY và ALLOWED_EXTENSION_ORIGIN.' };
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
    analyzeText(message.text).then(sendResponse);
    return true;
  }

  return undefined;
});
