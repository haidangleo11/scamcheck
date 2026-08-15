async function recognizeLocally(imageDataUrl) {
  if (!self.Tesseract) {
    throw new Error('Thiếu thư viện OCR. Hãy chạy bước chuẩn bị thư viện của extension.');
  }

  const worker = await self.Tesseract.createWorker('vie+eng', 1, {
    workerPath: chrome.runtime.getURL('vendor/tesseract/worker.min.js'),
    corePath: chrome.runtime.getURL('vendor/tesseract-core'),
    langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
    logger: function () {}
  });

  try {
    const result = await worker.recognize(imageDataUrl, {}, { text: true });
    return String(result && result.data && result.data.text || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    await worker.terminate();
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.target !== 'SCAMCHECK_OCR_DOCUMENT' || message.type !== 'SCAMCHECK_RECOGNIZE') {
    return undefined;
  }

  recognizeLocally(message.imageDataUrl)
    .then(function (text) { sendResponse({ ok: true, text: text }); })
    .catch(function (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : 'OCR không thành công.' });
    });
  return true;
});
