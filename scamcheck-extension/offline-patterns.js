(function (scope) {
  const VERSION = '2026-08-17';
  const PATTERNS = [
    { id: 'bank-login-phishing', title: 'Giả mạo ngân hàng và link xác thực', risk: 'HIGH', terms: ['ngân hàng', 'tài khoản bị khóa', 'xác minh', 'đăng nhập', 'mã otp', 'vcb', 'mbbank', 'bidv'] },
    { id: 'authority-temporary-account', title: 'Giả mạo cơ quan yêu cầu chuyển vào tài khoản tạm giữ', risk: 'CRITICAL', terms: ['công an', 'tòa án', 'viện kiểm sát', 'tài khoản tạm giữ', 'rửa tiền', 'điều tra'] },
    { id: 'remote-support-app', title: 'Mạo danh hỗ trợ và dụ cài ứng dụng điều khiển máy', risk: 'CRITICAL', terms: ['cài app', 'hỗ trợ từ xa', 'điều khiển điện thoại', 'chia sẻ màn hình', 'cấp quyền trợ năng', 'apk'] },
    { id: 'job-task-advance-fee', title: 'Việc làm/nhiệm vụ online yêu cầu nộp tiền trước', risk: 'HIGH', terms: ['việc làm online', 'làm nhiệm vụ', 'hoa hồng', 'nạp tiền', 'đóng phí', 'rút tiền'] },
    { id: 'delivery-fee-link', title: 'Giả mạo giao hàng yêu cầu thanh toán qua link', risk: 'HIGH', terms: ['giao hàng', 'bưu kiện', 'shipper', 'phí giao', 'giao thất bại', 'xác nhận địa chỉ'] },
    { id: 'prize-tax-refund', title: 'Trúng thưởng/hoàn tiền yêu cầu đóng phí', risk: 'HIGH', terms: ['trúng thưởng', 'nhận quà', 'hoàn tiền', 'phí nhận quà', 'đóng thuế'] },
    { id: 'investment-impersonation', title: 'Mời đầu tư hoặc lợi nhuận cam kết', risk: 'HIGH', terms: ['đầu tư', 'lợi nhuận', 'sàn giao dịch', 'tiền điện tử', 'lãi cam kết'] }
  ];

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function find(text) {
    const query = normalise(text);
    if (!query) return [];
    return PATTERNS.map(function (pattern) {
      const matchedSignals = pattern.terms.filter(function (term) { return query.includes(normalise(term)); });
      return { pattern: pattern, matchedSignals: matchedSignals, score: matchedSignals.length };
    })
      .filter(function (match) { return match.score > 0; })
      .sort(function (left, right) { return right.score - left.score; })
      .slice(0, 3)
      .map(function (match) {
        return {
          id: match.pattern.id,
          title: match.pattern.title,
          risk: match.pattern.risk,
          matchedSignals: match.matchedSignals
        };
      });
  }

  scope.ScamCheckOfflineRag = Object.freeze({ version: VERSION, find: find });
}(self));
