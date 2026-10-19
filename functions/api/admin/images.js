// ============================================================================
// POST /api/admin/images : แอดมินอัปโหลดรูปสินค้า (เฉพาะแอดมิน ตรวจโดย _middleware.js)
//  - หน้าเว็บส่งไฟล์รูปมาเป็น body ตรง ๆ (ไม่ใช่ JSON) พร้อม Content-Type ของรูป
//  - ส่งความกว้าง/สูงมาทาง header X-Image-Width / X-Image-Height (ไม่บังคับ)
//  - ตอบกลับ { ok, id, url } โดย url = /api/images/<id> นำไปใส่ช่องรูปของสินค้าได้ทันที
// ============================================================================
import { json, HttpError } from '../../_lib/http.js';

const MAX_BYTES = 1_500_000;   // D1 เก็บค่าได้ไม่เกิน ~2MB ต่อแถว จึงจำกัดไว้ที่ 1.5MB
const TYPES = ['image/webp', 'image/jpeg', 'image/png'];

/** ตรวจ "ลายเซ็น" ไบต์แรกของไฟล์ว่าเป็นรูปจริง ไม่ใช่ไฟล์อื่นที่แอบตั้งชื่อเป็นรูป */
function sniff(b) {
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

function dim(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 10000 ? n : null;
}

export async function onRequestPost({ request, env, data }) {
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TYPES.includes(type)) throw new HttpError(415, 'รองรับเฉพาะไฟล์ WebP, JPEG หรือ PNG');
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BYTES) throw new HttpError(413, 'ไฟล์รูปใหญ่เกิน 1.5MB');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) throw new HttpError(422, 'ไม่พบข้อมูลรูปภาพ');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'ไฟล์รูปใหญ่เกิน 1.5MB');
  const real = sniff(bytes);
  if (!real) throw new HttpError(422, 'ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ');

  const db = env.DB;
  // เก็บกวาด: ลบรูปที่อัปโหลดไว้นานกว่า 1 วันแต่ไม่มีสินค้าใดใช้ (เช่น อัปแล้วไม่ได้กดบันทึก)
  await db.prepare(`DELETE FROM images
    WHERE created_at < datetime('now', '-1 day')
      AND '/api/images/' || id NOT IN (
        SELECT image_url FROM products WHERE image_url IS NOT NULL
        UNION SELECT image_url FROM product_variants WHERE image_url IS NOT NULL)`).run();

  const row = await db.prepare(`INSERT INTO images (mime, data, size_bytes, width, height, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(real, bytes, bytes.length, dim(request.headers.get('X-Image-Width')), dim(request.headers.get('X-Image-Height')), data.admin?.id ?? null)
    .first();
  return json({ ok: true, id: row.id, url: `/api/images/${row.id}`, size: bytes.length, mime: real }, 201);
}
