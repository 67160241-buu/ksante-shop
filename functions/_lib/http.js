// ============================================================================
// ตัวช่วยด้าน HTTP: ส่ง JSON, อ่าน body, และจัดการ error ให้เป็นรูปแบบเดียวกันทั้งระบบ
// ============================================================================

/** Error ที่รู้สถานะ HTTP: โยนจากที่ไหนก็ได้ แล้ว middleware จะแปลงเป็น JSON ให้ */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** ส่งข้อมูลกลับเป็น JSON (ห้าม cache เพราะเป็นข้อมูลสด) */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** อ่าน body ที่เป็น JSON ถ้าไม่ใช่ JSON ที่ถูกต้องจะตอบ 400 */
export async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'กรุณาส่งข้อมูลแบบ application/json');
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError(400, 'รูปแบบข้อมูล JSON ไม่ถูกต้อง');
  }
}

/** ตัด/ตรวจข้อความ: required = ห้ามว่าง, max = ความยาวสูงสุด */
export function text(value, label, { required = true, max = 255, min = 0 } = {}) {
  const v = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !v) throw new HttpError(422, `กรุณากรอก${label}`);
  if (v.length > max) throw new HttpError(422, `${label}ยาวเกิน ${max} ตัวอักษร`);
  if (v && v.length < min) throw new HttpError(422, `${label}ต้องมีอย่างน้อย ${min} ตัวอักษร`);
  return v;
}

/** แปลงเป็นจำนวนเต็มและตรวจช่วงค่า */
export function int(value, label, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(422, `${label}ต้องเป็นจำนวนเต็มระหว่าง ${min} ถึง ${max}`);
  return n;
}

/** แปลงเป็นตัวเลขทศนิยม (เช่นราคา) */
export function money(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(422, `${label}ไม่ถูกต้อง`);
  return Math.round(n * 100) / 100;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^0\d{8,9}$/;          // เบอร์ไทย 9-10 หลัก ขึ้นต้นด้วย 0

/** ตรวจที่อยู่จัดส่งและคืนค่าเป็น object ที่สะอาด */
export function address(a) {
  const src = a && typeof a === 'object' ? a : {};
  const out = {
    address_line: text(src.address_line, 'ที่อยู่', { max: 300 }),
    district: text(src.district, 'เขต/อำเภอ', { max: 100 }),
    province: text(src.province, 'จังหวัด', { max: 100 }),
    postal_code: text(src.postal_code, 'รหัสไปรษณีย์', { max: 5 }),
  };
  if (!/^\d{5}$/.test(out.postal_code)) throw new HttpError(422, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
  return out;
}

/** แปลง JSON string ในฐานข้อมูลกลับเป็น object แบบไม่พัง */
export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
