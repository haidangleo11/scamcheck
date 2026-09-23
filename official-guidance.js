/* Curated safety guidance, independent of model output. No user data or network calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScamCheckGuidance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2026-09-22.1';
  const REVIEWED_ON = '2026-09-22';
  const sources = {
    mps: {
      publisher: { vi: 'Bộ Công an', en: 'Vietnam Ministry of Public Security' },
      title: 'Cảnh báo lừa đảo từ sự cố an ninh mạng tại CIC',
      url: 'https://www.bocongan.gov.vn/bai-viet/canh-bao-lua-dao-chiem-doat-tai-san-tu-su-co-an-ninh-mang-tai-trung-tam-thong-tin-tin-dung-quoc-gia-cic-1757991790',
      published: '2025-09-16', scope: 'VN'
    },
    police: {
      publisher: { vi: 'Trường Cao đẳng CSND I · Bộ Công an', en: 'People’s Police College I · Vietnam MPS' },
      title: 'Cảnh báo các chiêu trò lừa đảo trực tuyến dịp Tết Nguyên đán 2024',
      url: 'https://cdcsnd1.bocongan.gov.vn/home/tin-tuc-su-kien/canh-bao-cac-chieu-tro-lua-dao-truc-tuyen-dip-tet-nguyen-dan-2024-11913',
      published: '2024-01-31', scope: 'VN'
    },
    vcb: {
      publisher: { vi: 'Vietcombank · hướng dẫn cho khách hàng VCB', en: 'Vietcombank · VCB customer guidance' },
      title: 'Hướng dẫn giao dịch an toàn trên VCB Digibank và VCB Digibiz',
      url: 'https://www.vietcombank.com.vn/KHCN/Truy-cap-nhanh/Tin-noi-bat/Articles/2024/04/08/CANH-BAO-GIAO-DICH-AN-TOAN',
      published: '2024-04-05', scope: 'VCB'
    },
    ftc: {
      publisher: { vi: 'FTC (Hoa Kỳ) · bảo vệ tài khoản, thiết bị', en: 'US FTC · account and device protection' },
      title: 'What To Do if You Were Scammed',
      url: 'https://consumer.ftc.gov/articles/what-do-if-you-were-scammed',
      published: '2026-06', scope: 'US-technical-reference'
    },
    phishing: {
      publisher: { vi: 'FTC (Hoa Kỳ) · phòng tránh phishing', en: 'US FTC · phishing prevention' },
      title: 'How To Recognize and Avoid Phishing Scams',
      url: 'https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams',
      published: '2022-09', scope: 'US-technical-reference'
    }
  };
  // Summaries/translations by ScamCheck; not verbatim quotations or agency endorsement.
  // Only explicitly selected exposure states select recovery steps. Never infer that
  // the user paid/disclosed credentials from the scam message being analysed.
  const steps = {
    secrets: { sources: ['mps'], vi: 'Không cung cấp mật khẩu, OTP hoặc thông tin bảo mật cho người liên hệ.', en: 'Do not share passwords, OTPs or security details with the person contacting you.' },
    verify: { sources: ['phishing', 'mps'], vi: 'Tự mở ứng dụng, website chính thức hoặc dùng số liên hệ đã biết để xác minh; không dùng link hay số trong tin nhắn đáng ngờ.', en: 'Verify through an official app, website or known contact number, not a link or number in a suspicious message.' },
    payment: { sources: ['mps'], vi: 'Chưa xác minh được người nhận thì không chuyển tiền, dù họ tự xưng là cơ quan chức năng.', en: 'Do not transfer money to an unverified recipient, even if they claim official authority.' },
    bank: { sources: ['ftc'], vi: 'Báo ngay cho ngân hàng hoặc dịch vụ thanh toán và hỏi khả năng thu hồi giao dịch. Không bảo đảm lấy lại được tiền.', en: 'Immediately notify your bank or payment service and ask about reversing the payment. Recovery is not guaranteed.' },
    recoveryFees: { sources: ['police'], vi: 'Không trả thêm phí cho người hứa lấy lại tiền bị lừa.', en: 'Do not pay anyone who promises to recover lost money for an upfront fee.' },
    report: { sources: ['police'], vi: 'Lưu số liên hệ, nội dung trao đổi; nếu bị lừa, trình báo Công an gần nhất.', en: 'Keep contact details and messages; if scammed, report to your nearest police station in Vietnam.' },
    password: { sources: ['ftc'], vi: 'Nếu lộ mật khẩu, đổi sang mật khẩu riêng, mạnh; đổi cả nơi dùng lại mật khẩu đó và bật xác thực hai bước.', en: 'If a password was exposed, replace it with a strong, unique one, change reused passwords and enable two-factor authentication.' },
    accountRecovery: { sources: ['ftc'], vi: 'Nếu không đăng nhập được, dùng quy trình khôi phục chính thức của nền tảng.', en: 'If locked out, use the platform’s official account-recovery process.' },
    vcbProtect: { sources: ['vcb'], vi: 'Khách hàng VCB: khóa dịch vụ hoặc đổi mật khẩu ngay và liên hệ VCB theo hướng dẫn nguồn. Ngân hàng khác: xem hướng dẫn bảo mật riêng của ngân hàng đó.', en: 'VCB customers: lock the service or change the password immediately and contact VCB as instructed in the source. Other banks: consult your own bank’s security guidance.' },
    malware: { sources: ['ftc', 'phishing'], vi: 'Cập nhật phần mềm bảo mật, quét và xử lý mối đe dọa phát hiện được.', en: 'Update security software, run a scan and remove detected threats.' },
    deviceHelp: { sources: ['ftc'], vi: 'Nếu cần hỗ trợ xử lý mã độc, liên hệ nhà sản xuất hoặc đơn vị kỹ thuật tin cậy.', en: 'For malware-removal help, contact the manufacturer or trusted technical support.' }
  };
  const playbooks = {
    prevention: { title: { vi: 'Các bước xác minh an toàn', en: 'Safe verification steps' }, intro: { vi: 'Hướng dẫn phòng ngừa chung, không phải kết luận tin nhắn là lừa đảo. Nếu đã làm theo yêu cầu, chọn tình huống ứng cứu bên dưới.', en: 'General precautions, not a conclusion that this message is a scam. If you already acted, select a recovery situation below.' }, steps: ['secrets', 'verify', 'payment'] },
    contacted: { title: { vi: 'Tôi mới trao đổi, chưa làm theo', en: 'I only exchanged messages or calls' }, intro: { vi: 'Xác minh độc lập trước khi cung cấp thông tin hoặc thanh toán.', en: 'Verify independently before sharing information or paying.' }, steps: ['secrets', 'verify', 'payment'] },
    transferred: { title: { vi: 'Tôi đã chuyển tiền', en: 'I already sent money' }, intro: { vi: 'Ưu tiên báo ngân hàng; việc thu hồi phụ thuộc từng giao dịch.', en: 'Notify your bank promptly; recovery depends on the transaction.' }, steps: ['bank', 'recoveryFees', 'report'] },
    otp: { title: { vi: 'Tôi đã lộ OTP, mật khẩu hoặc thông tin thẻ', en: 'I disclosed an OTP, password or card details' }, intro: { vi: 'Chọn các bước phù hợp với tài khoản đã bị lộ thông tin.', en: 'Use the steps relevant to the account whose information was exposed.' }, steps: ['vcbProtect', 'password', 'accountRecovery', 'secrets'] },
    app: { title: { vi: 'Tôi đã cài ứng dụng lạ hoặc cho điều khiển thiết bị', en: 'I installed an unknown app or allowed device control' }, intro: { vi: 'Xử lý thiết bị và bảo vệ tài khoản; nếu đã mất tiền, chọn thêm tình huống chuyển tiền.', en: 'Secure the device and affected accounts. If money was lost, also use the payment situation.' }, steps: ['deviceHelp', 'malware', 'password', 'vcbProtect'] },
    link: { title: { vi: 'Tôi đã mở liên kết lạ', en: 'I opened an unfamiliar link' }, intro: { vi: 'Nếu đã nhập thông tin bảo mật hoặc cài ứng dụng, chọn thêm đúng tình huống đó. Mở link không tự chứng minh thiết bị đã bị xâm nhập.', en: 'If you entered credentials or installed an app, also select that situation. Opening a link alone does not prove compromise.' }, steps: ['verify', 'secrets', 'malware'] }
  };
  function getPlaybook(id = 'prevention', language = 'vi') {
    const lang = language === 'en' ? 'en' : 'vi';
    const key = Object.prototype.hasOwnProperty.call(playbooks, id) ? id : 'prevention';
    const book = playbooks[key];
    return {
      id: key, version: VERSION, reviewedOn: REVIEWED_ON, language: lang,
      title: book.title[lang], intro: book.intro[lang],
      steps: book.steps.map(stepId => ({ id: stepId, text: steps[stepId][lang], sources: [...steps[stepId].sources] }))
    };
  }
  function getSource(id, language = 'vi') {
    if (!Object.prototype.hasOwnProperty.call(sources, id)) return null;
    return { ...sources[id], id, publisher: sources[id].publisher[language === 'en' ? 'en' : 'vi'], reviewedOn: REVIEWED_ON };
  }
  return Object.freeze({ VERSION, REVIEWED_ON, getPlaybook, getSource, scenarioIds: Object.freeze(Object.keys(playbooks)) });
});
