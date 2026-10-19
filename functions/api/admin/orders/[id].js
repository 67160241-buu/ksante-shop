// GET   /api/admin/orders/:id : รายละเอียดออเดอร์ + รายการสินค้า + ประวัติสถานะ
// PATCH /api/admin/orders/:id : อัปเดตสถานะ/เลขพัสดุ { status, tracking_number, note }
import { json, readJson, text, HttpError } from '../../../_lib/http.js';
import { changeStatus, loadOrder } from '../../../_lib/orders.js';

export async function onRequestGet({ env, params }) {
  const order = await loadOrder(env.DB, 'o.id = ?', Number(params.id));
  if (!order) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  return json({ ok: true, order });
}

export async function onRequestPatch({ request, env, params }) {
  const id = Number(params.id);
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  const tracking = body.tracking_number === undefined ? undefined : text(body.tracking_number, 'เลขพัสดุ', { required: false, max: 40 }).toUpperCase();
  await changeStatus(env.DB, row, body.status || row.status, {
    tracking,
    note: text(body.note, 'หมายเหตุ', { required: false, max: 200 }) || undefined,
  });
  return json({ ok: true, order: await loadOrder(env.DB, 'o.id = ?', id) });
}
