// POST /api/orders : สร้างคำสั่งซื้อ (ลูกค้าทั่วไปหรือสมาชิก) -> ตัดสต็อกแบบ Atomic
// GET  /api/orders : ประวัติคำสั่งซื้อของสมาชิกที่ล็อกอินอยู่
import { json, readJson, text, address, HttpError, EMAIL_RE, PHONE_RE } from '../../_lib/http.js';
import { getSession, requireCustomer } from '../../_lib/auth.js';
import { createOrder, shapeOrder } from '../../_lib/orders.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const session = await getSession(request, env, 'customer');
  const customer = {
    name: text(body.customer_name, 'ชื่อผู้รับ', { max: 100 }),
    email: text(body.customer_email, 'อีเมล', { max: 120 }).toLowerCase(),
    phone: text(body.phone, 'เบอร์โทรศัพท์', { max: 12 }).replace(/\D/g, ''),
  };
  if (!EMAIL_RE.test(customer.email)) throw new HttpError(422, 'รูปแบบอีเมลไม่ถูกต้อง');
  if (!PHONE_RE.test(customer.phone)) throw new HttpError(422, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0');
  const shipping = address(body.shipping_address);
  const note = text(body.note, 'หมายเหตุ', { required: false, max: 300 });

  const order = await createOrder(env, {
    items: body.items, customer, address: shipping, payment_method: body.payment_method, note, user_id: session?.id,
  });

  // สมาชิกที่ติ๊ก "บันทึกเป็นที่อยู่เริ่มต้น" จะอัปเดตที่อยู่ในโปรไฟล์ด้วย
  if (session && body.save_address) {
    await env.DB.prepare('UPDATE users SET default_address = ?, phone = COALESCE(phone, ?) WHERE id = ?')
      .bind(JSON.stringify(shipping), customer.phone, session.id).run();
  }
  return json({ ok: true, order }, 201);
}

export async function onRequestGet({ request, env }) {
  const s = await requireCustomer(request, env);
  const { results: orders } = await env.DB.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100').bind(s.id).all();
  if (!orders.length) return json({ ok: true, orders: [] });
  const ids = orders.map(o => o.id);
  const marks = ids.map(() => '?').join(',');
  const [items, hist] = await env.DB.batch([
    env.DB.prepare(`SELECT i.*, COALESCE(v.image_url, p.image_url) AS image_url, p.slug FROM order_items i
                     LEFT JOIN product_variants v ON v.id = i.variant_id LEFT JOIN products p ON p.id = i.product_id
                    WHERE i.order_id IN (${marks}) ORDER BY i.id`).bind(...ids),
    env.DB.prepare(`SELECT order_id, status, note, created_at FROM order_status_history WHERE order_id IN (${marks}) ORDER BY id`).bind(...ids),
  ]);
  return json({
    ok: true,
    orders: orders.map(o => shapeOrder(o, items.results.filter(i => i.order_id === o.id), hist.results.filter(h => h.order_id === o.id))),
  });
}
