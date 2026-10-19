// ============================================================================
// GET /api/images/:id : ส่งไฟล์รูปที่อัปโหลดไว้ใน D1 ให้เบราว์เซอร์ (ทุกคนดูได้)
// รูปแต่ละ id ไม่มีวันถูกแก้ไข (แก้รูป = อัปโหลดเป็น id ใหม่) จึง cache ได้นานแบบ immutable
// ============================================================================
import { HttpError } from '../../_lib/http.js';

export async function onRequestGet({ env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'ไม่พบรูปภาพ');
  const row = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'ไม่พบรูปภาพ');
  // D1 คืนค่า BLOB เป็น array ของตัวเลข จึงแปลงกลับเป็นไบต์ก่อนส่ง
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(body, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",   // กันไม่ให้ไฟล์ถูกเปิดเป็นหน้าเว็บ
    },
  });
}
