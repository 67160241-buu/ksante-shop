// POST /api/orders/:number/cancel : ลูกค้ายกเลิกออเดอร์ของตัวเองได้ เฉพาะตอนสถานะยังเป็น Pending (คืนสต็อกอัตโนมัติ)
import { json, HttpError } from '../../../_lib/http.js';
import { requireCustomer } from '../../../_lib/auth.js';
import { changeStatus, loadOrder } from '../../../_lib/orders.js';

export async function onRequestPost({ request, env, params }) {
  const s = await requireCustomer(request, env);
  const number = String(params.number).toUpperCase();
  const row = await env.DB.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?').bind(number, s.id).first();
  if (!row) throw new HttpError(404, 'ไม่พบคำสั่งซื้อนี้ในบัญชีของคุณ');
  if (row.status !== 'Pending') throw new HttpError(409, 'ยกเลิกเองได้เฉพาะออเดอร์ที่ยังรอตรวจสอบ (Pending) กรุณาติดต่อร้าน');
  await changeStatus(env.DB, row, 'Cancelled', { note: 'ลูกค้ายกเลิกคำสั่งซื้อเอง คืนสต็อกแล้ว' });
  return json({ ok: true, order: await loadOrder(env.DB, 'o.id = ?', row.id) });
}
