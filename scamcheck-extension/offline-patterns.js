(function (scope) {
  const VERSION = '2026-08-20-auto-guard-resilience';
  const PATTERNS = [
    {
      "id": "vneid-dichvucong-fakeapp",
      "title": "Giả mạo công an yêu cầu cài app VNeID/Dịch vụ công dỏm",
      "risk": "CRITICAL",
      "terms": ["vneid", "dịch vụ công", "cài app", "định danh", "mức 2", "đường link", "apk", "cập nhật", "cấp quyền trợ năng", "tải ngoài cửa hàng", "điều khiển màn hình", "tài khoản ngân hàng", "mất tiền"]
    },
    {
      "id": "tax-refund-fake",
      "title": "Giả mạo cơ quan thuế thông báo hoàn tiền / quyết toán thuế",
      "risk": "HIGH",
      "terms": ["cục thuế", "chi cục thuế", "quyết toán", "hoàn thuế", "tra cứu", "kê khai", "bấm link", "cài app thuế", "cung cấp tài khoản", "nộp phí"]
    },
    {
      "id": "bank-login-phishing",
      "title": "Giả mạo ngân hàng: Khóa tài khoản, nâng cấp, kiểm tra bảo mật",
      "risk": "HIGH",
      "terms": ["ngân hàng", "tài khoản bị khóa", "xác minh", "đăng nhập", "cập nhật", "sinh trắc học", "thẻ tín dụng", "link lạ", "thời hạn gấp", "mã OTP", "mật khẩu", "thông tin thẻ", "bank account", "account locked", "account will be locked", "verify immediately", "security alert", "log in", "suspicious link", "urgent deadline", "one-time code", "password"]
    },
    {
      "id": "authority-temporary-account",
      "title": "Giả mạo công an/tòa án yêu cầu chuyển tiền vào tài khoản tạm giữ",
      "risk": "CRITICAL",
      "terms": ["công an", "tòa án", "viện kiểm sát", "tài khoản tạm giữ", "vụ án", "rửa tiền", "ma túy", "lệnh bắt", "giữ bí mật", "chuyển tiền", "cung cấp thông tin", "đe dọa", "police", "money laundering", "temporary account", "arrest warrant", "prove your innocence", "transfer money", "keep it secret", "urgent transfer"]
    },
    {
      "id": "job-task-advance-fee",
      "title": "Làm nhiệm vụ online, thả tim TikTok, Shopee nhận hoa hồng",
      "risk": "HIGH",
      "terms": ["việc làm online", "làm nhiệm vụ", "hoa hồng", "đơn hàng", "chốt đơn", "thả tim", "xem video", "cộng tác viên", "nạp tiền", "đóng phí", "ứng tiền", "cam kết lợi nhuận", "lỗi hệ thống nạp thêm"]
    },
    {
      "id": "telegram-investment-group",
      "title": "Lùa gà vào nhóm Telegram/Zalo đọc lệnh, đầu tư tài chính",
      "risk": "HIGH",
      "terms": ["đầu tư", "chuyên gia", "đọc lệnh", "lợi nhuận", "sàn giao dịch", "tiền ảo", "chứng khoán", "lãi suất", "lãi cam kết", "nạp tiền", "rút tiền bị kẹt", "đóng thuế để rút", "nhóm kín"]
    },
    {
      "id": "delivery-fee-link",
      "title": "Shipper giao hàng gọi điện gửi link thanh toán, lừa nhận bưu phẩm",
      "risk": "HIGH",
      "terms": ["giao hàng", "bưu kiện", "shipper", "phí giao", "đơn hàng", "nhận hàng", "chuyển nhầm", "thanh toán phí", "bấm link", "xác nhận địa chỉ", "gửi mã OTP"]
    },
    {
      "id": "prize-tax-refund",
      "title": "Thông báo trúng thưởng, tặng quà tri ân khách hàng",
      "risk": "HIGH",
      "terms": ["trúng thưởng", "nhận quà", "tri ân", "quà tặng", "may mắn", "shopee", "điện máy xanh", "đóng phí", "thuế", "chuyển khoản trước", "cung cấp OTP", "link nhận quà"]
    },
    {
      "id": "sim-identity-takeover",
      "title": "Dọa khóa SIM, chuẩn hóa thuê bao để cướp SIM",
      "risk": "HIGH",
      "terms": ["khóa sim", "chuẩn hóa thuê bao", "căn cước", "cccd", "2 chiều", "bộ thông tin", "bấm phím", "bấm link xác minh", "mã xác nhận", "cú pháp", "khẩn cấp"]
    },
    {
      "id": "impersonation-friend-urgent-transfer",
      "title": "Hack Facebook/Zalo nhắn tin, gọi video deepfake mượn tiền",
      "risk": "HIGH",
      "terms": ["mượn tiền", "chuyển tiền gấp", "người thân", "bạn bè", "trả nợ", "tài khoản khác", "không gọi được", "gọi video bị mờ", "âm thanh lạ", "chuyển ngay", "tài khoản tên khác"]
    },
    {
      "id": "lawyer-scam-recovery",
      "title": "Giả danh luật sư, chuyên gia hỗ trợ lấy lại tiền bị lừa",
      "risk": "HIGH",
      "terms": ["lấy lại tiền", "thu hồi vốn", "luật sư", "cục an ninh mạng", "hỗ trợ lừa đảo", "treo hệ thống", "phí dịch vụ", "phí hồ sơ", "phần trăm", "nộp tiền để rút"]
    },
    {
      "id": "romance-scam-customs",
      "title": "Người nước ngoài gửi quà, kẹt hải quan yêu cầu đóng phí",
      "risk": "HIGH",
      "terms": ["gửi quà", "hải quan", "phí sân bay", "người nước ngoài", "kết bạn", "đô la", "chuyển khoản", "tài khoản cá nhân", "phạt tiền", "giữ hàng"]
    },
    {
      "id": "flight-tour-cheap",
      "title": "Bán vé máy bay, tour du lịch giá cực rẻ",
      "risk": "MEDIUM",
      "terms": ["vé máy bay", "tour du lịch", "giá rẻ", "thanh lý", "pass lại", "khách sạn", "chuyển khoản toàn bộ", "thúc giục thanh toán", "page mới lập"]
    },
    {
      "id": "child-hospital-emergency",
      "title": "Gọi điện báo con cấp cứu ở bệnh viện cần chuyển tiền mổ gấp",
      "risk": "CRITICAL",
      "terms": ["cấp cứu", "bệnh viện", "tai nạn", "chợ rẫy", "chuyển tiền mổ", "thầy cô giáo", "chuyển gấp", "tình trạng nguy kịch", "giáo viên chủ nhiệm"]
    },
    {
      "id": "generic-free-money-lure",
      "title": "Mồi nhận tiền/quà miễn phí qua đường link",
      "risk": "HIGH",
      "terms": ["click this link", "click here", "free money", "freemoney", "claim now", "claim your reward", "get rich quick", "nhận tiền miễn phí", "bấm link nhận tiền", "click để nhận tiền", "quà miễn phí", "nhận ngay", "đường link", "link lạ", "không cần làm gì", "nhận thưởng ngay", "limited time", "act now"]
    },
    {
      "id": "piracy-gambling-link-injection",
      "title": "Trang xem phim lậu chèn link cờ bạc/tài xỉu",
      "risk": "HIGH",
      "terms": ["tài xỉu", "tai xiu", "xóc đĩa", "xoc dia", "nổ hũ", "no hu", "casino online", "link nhà cái", "link tai xiu", "đăng ký nhận thưởng", "đặt cược", "cược ngay", "nạp tiền chơi", "nhận thưởng casino", "game bài đổi thưởng", "link cá cược"]
    },
    {
      "id": "fake-donation-grant-advance-fee",
      "title": "Email tặng tiền/viện trợ/di sản giả mạo",
      "risk": "HIGH",
      "terms": ["warren buffett", "charitable foundation", "personal donation", "grant fund", "donation of", "inheritance", "beneficiary", "payout bank", "millions of usd", "introducing yourself in detail", "full name", "your country", "processing fee", "bank details", "claim the money"]
    }
  ];

  // The automatic guard needs stronger evidence than a manual check. A page
  // mentioning only "bank" or "police" should not trigger a warning by itself.
  const AUTO_STRONG_TERMS = [
    'tài khoản bị khóa', 'account locked', 'account will be locked', 'verify immediately',
    'đăng nhập', 'log in', 'mã otp', 'one-time code', 'mật khẩu', 'password',
    'tài khoản tạm giữ', 'temporary account', 'rửa tiền', 'money laundering',
    'chuyển tiền', 'transfer money', 'cài app', 'apk', 'cấp quyền trợ năng',
    'nạp tiền', 'đóng phí', 'phí giao', 'payment fee', 'lãi cam kết',
    'khóa sim', 'sim lock', 'mượn tiền', 'borrow money', 'lấy lại tiền',
    'thu hồi vốn', 'hải quan', 'customs fee', 'trúng thưởng', 'prize',
    'cấp cứu', 'emergency', 'click this link', 'click here', 'free money',
    'freemoney', 'claim now', 'claim your reward', 'get rich quick',
    'nhận tiền miễn phí', 'bấm link nhận tiền', 'click để nhận tiền',
    'quà miễn phí', 'nhận ngay', 'nhận thưởng ngay', 'limited time', 'act now',
    'tài xỉu', 'tai xiu', 'xóc đĩa', 'xoc dia', 'nổ hũ', 'no hu',
    'casino online', 'đặt cược', 'cược ngay', 'nạp tiền chơi', 'link cá cược',
    'warren buffett', 'charitable foundation', 'personal donation', 'payout bank',
    'millions of usd', 'bank details', 'processing fee', 'claim the money'
  ].map(normalise);

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function scorePattern(pattern, query) {
    const matchedSignals = pattern.terms.filter(function (term) { return query.includes(normalise(term)); });
    const strongSignals = matchedSignals.filter(function (term) { return AUTO_STRONG_TERMS.includes(normalise(term)); });
    return {
      pattern: pattern,
      matchedSignals: matchedSignals,
      strongSignals: strongSignals,
      score: matchedSignals.length + strongSignals.length
    };
  }

  function toPublicMatch(match) {
    return {
      id: match.pattern.id,
      title: match.pattern.title,
      risk: match.pattern.risk,
      matchedSignals: match.matchedSignals,
      strongSignals: match.strongSignals
    };
  }

  function find(text) {
    const query = normalise(text);
    if (!query) return [];
    return PATTERNS.map(function (pattern) { return scorePattern(pattern, query); })
      .filter(function (match) { return match.score > 0; })
      .sort(function (left, right) { return right.score - left.score; })
      .slice(0, 3)
      .map(toPublicMatch);
  }

  function findForAutomaticScan(text) {
    const query = normalise(text);
    if (!query) return [];
    return PATTERNS.map(function (pattern) { return scorePattern(pattern, query); })
      .filter(function (match) {
        const hasRepeatedEvidence = match.matchedSignals.length >= 2 && match.strongSignals.length >= 1;
        const hasMultipleStrongSignals = match.strongSignals.length >= 2;
        const isCriticalAndStrong = match.pattern.risk === 'CRITICAL' && match.strongSignals.length >= 1 && match.matchedSignals.length >= 2;
        return hasRepeatedEvidence || hasMultipleStrongSignals || isCriticalAndStrong;
      })
      .sort(function (left, right) { return right.score - left.score; })
      .slice(0, 3)
      .map(toPublicMatch);
  }

  scope.ScamCheckOfflineRag = Object.freeze({
    version: VERSION,
    find: find,
    findForAutomaticScan: findForAutomaticScan
  });
}(self));
