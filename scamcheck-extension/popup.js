var messageText = document.getElementById('messageText');
var captureButton = document.getElementById('captureButton');
var analyzeButton = document.getElementById('analyzeButton');
var statusNode = document.getElementById('status');
var resultNode = document.getElementById('result');

function setStatus(message, isError) {
  statusNode.textContent = message || '';
  statusNode.style.color = isError ? '#b91c1c' : '#475569';
}

function updateAnalyzeState() {
  analyzeButton.disabled = !messageText.value.trim();
}

function setList(id, values) {
  var node = document.getElementById(id);
  node.replaceChildren();
  (Array.isArray(values) ? values : []).slice(0, 5).forEach(function (value) {
    var item = document.createElement('li');
    item.textContent = String(value);
    node.appendChild(item);
  });
}

function renderResult(analysis) {
  document.getElementById('risk').textContent = 'Mức rủi ro: ' + String(analysis.risk || 'UNKNOWN');
  document.getElementById('summary').textContent = String(analysis.summary || 'AI chưa có đủ dữ kiện để kết luận.');
  setList('redFlags', analysis.redFlags);
  setList('safeActions', analysis.safeActions);

  var links = document.getElementById('links');
  links.replaceChildren();
  var assessments = Array.isArray(analysis.linkAssessments) ? analysis.linkAssessments : [];
  assessments.slice(0, 10).forEach(function (assessment) {
    var item = document.createElement('li');
    var reasons = Array.isArray(assessment.reasons) ? assessment.reasons.join('; ') : '';
    item.textContent = String(assessment.url || 'Link') + ' — ' + String(assessment.risk || 'UNKNOWN') + (reasons ? ': ' + reasons : '');
    links.appendChild(item);
  });
  document.getElementById('linksBlock').hidden = assessments.length === 0;
  resultNode.hidden = false;
}

captureButton.addEventListener('click', function () {
  chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_START_SELECTION' })
    .then(function (response) {
      if (!response || !response.ok) {
        setStatus(response && response.error ? response.error : 'Không thể bắt đầu khoanh vùng.', true);
        return;
      }
      window.close();
    })
    .catch(function () {
      setStatus('Không thể bắt đầu khoanh vùng ở trang này.', true);
    });
});

messageText.addEventListener('input', updateAnalyzeState);

analyzeButton.addEventListener('click', function () {
  analyzeButton.disabled = true;
  setStatus('Đang gửi phần chữ và các link tới AI để phân tích…');
  chrome.runtime.sendMessage({ target: 'SCAMCHECK_BACKGROUND', type: 'SCAMCHECK_ANALYZE_TEXT', text: messageText.value })
    .then(function (response) {
      if (!response || !response.ok) {
        setStatus(response && response.error ? response.error : 'AI chưa phản hồi.', true);
        return;
      }
      renderResult(response.analysis || {});
      setStatus('Đã nhận kết quả AI.');
    })
    .catch(function () {
      setStatus('Không thể kết nối API AI.', true);
    })
    .finally(updateAnalyzeState);
});

chrome.storage.session.get(['scamcheckLatest', 'scamcheckAnalysis'])
  .then(function (stored) {
    if (stored.scamcheckLatest && stored.scamcheckLatest.text) {
      messageText.value = stored.scamcheckLatest.text;
      setStatus('Đã nạp nội dung OCR gần nhất. Bạn có thể sửa trước khi phân tích.');
    }
    if (stored.scamcheckAnalysis && stored.scamcheckAnalysis.ok) {
      renderResult(stored.scamcheckAnalysis.analysis || {});
    }
    updateAnalyzeState();
  });
