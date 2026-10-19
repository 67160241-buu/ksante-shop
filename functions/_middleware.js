// ============================================================================
// Middleware หลัก (ทำงานกับทุก request ทั้ง API และไฟล์หน้าเว็บ)
//  1) กันการยิง API ข้ามโดเมน (CSRF) สำหรับคำสั่งที่แก้ไขข้อมูล
//  2) แปลง error ทุกชนิดให้เป็น JSON รูปแบบเดียวกัน
//  3) ใส่ Security Headers พื้นฐาน
// ============================================================================
import { HttpError, json } from './_lib/http.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  try {
    if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'ไม่อนุญาตให้เรียก API จากเว็บไซต์อื่น');
    }
    const res = await next();
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    return out;
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ ok: false, error: err.message, ...(err.details || {}) }, err.status);
    }
    console.error('Unhandled error:', err?.stack || err);
    return json({ ok: false, error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' }, 500);
  }
}
