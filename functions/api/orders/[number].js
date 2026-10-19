// GET /api/orders/:number : รายละเอียดคำสั่งซื้อของสมาชิก (ดูได้เฉพาะออเดอร์ของตัวเอง)
import { json, HttpError } from '../../_lib/http.js';
import { requireCustomer } from '../../_lib/auth.js';
import { loadOrder } from '../../_lib/orders.js';

export async function onRequestGet({ request, env, params }) {
  const s = await requireCustomer(request, env);
  const order = await loadOrder(env.DB, 'o.order_number = ? AND o.user_id = ?', String(params.number).toUpperCase(), s.id);
  if (!order) throw new HttpError(404, 'ไม่พบคำสั่งซื้อนี้ในบัญชีของคุณ');
  return json({ ok: true, order });
}
