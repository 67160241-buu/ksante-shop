// GET /api/orders/ref/:ref : ดูออเดอร์ด้วยรหัสอ้างอิงแบบสุ่ม (ใช้ในหน้า order-success ไม่ต้องล็อกอิน)
import { json, HttpError } from '../../../_lib/http.js';
import { loadOrder } from '../../../_lib/orders.js';

export async function onRequestGet({ env, params }) {
  const ref = String(params.ref || '');
  if (!/^[0-9a-f-]{36}$/.test(ref)) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  const order = await loadOrder(env.DB, 'o.public_ref = ?', ref);
  if (!order) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  return json({ ok: true, order });
}
