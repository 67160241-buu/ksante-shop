// ============================================================================
// สร้างข้อมูล QR PromptPay ตามมาตรฐาน EMVCo (Thai QR Payment) พร้อมยอดเงิน
// ถ้ายังไม่ได้ตั้ง promptpayId ใน config.js จะสร้าง "QR จำลอง" ที่สแกนจ่ายจริงไม่ได้
// ============================================================================
(function () {
  const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

  // CRC-16/CCITT-FALSE ตามที่มาตรฐาน EMVCo กำหนด
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }

  /** id = เบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก, amount = ยอดเงิน (บาท) */
  function payload(id, amount) {
    const digits = String(id).replace(/\D/g, '');
    let target;
    if (digits.length === 10) target = tlv('01', '0066' + digits.slice(1));      // เบอร์มือถือ -> 0066xxxxxxxxx
    else if (digits.length === 13) target = tlv('02', digits);                   // เลขบัตรประชาชน / เลขผู้เสียภาษี
    else throw new Error('promptpayId ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลข 13 หลัก');
    const merchant = tlv('00', 'A000000677010111') + target;
    const body = tlv('00', '01') + tlv('01', '12') + tlv('29', merchant) + tlv('53', '764') + tlv('54', Number(amount).toFixed(2)) + tlv('58', 'TH');
    const withCrcTag = body + '6304';
    return withCrcTag + crc16(withCrcTag);
  }

  /** วาด QR ลงใน element คืน true ถ้าเป็น QR จริง, false ถ้าเป็น QR จำลอง */
  window.KS_PROMPTPAY = function render(el, amount, orderNumber) {
    const id = (window.KS_CONFIG.promptpayId || '').trim();
    const real = !!id;
    const data = real ? payload(id, amount) : `KSANTE-DEMO-QR|${orderNumber}|THB ${Number(amount).toFixed(2)}|NOT A REAL PAYMENT`;
    const qr = window.qrcode(0, 'M');
    qr.addData(data);
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    el.querySelector('svg')?.setAttribute('aria-label', real ? 'QR PromptPay สำหรับชำระเงิน' : 'QR จำลองสำหรับสาธิต');
    return real;
  };
})();
