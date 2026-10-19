// GET /api/orders/track?number=KS...&contact=อีเมลหรือเบอร์โทร : ติดตามพัสดุโดยไม่ต้องล็อกอิน
// ต้องรู้ทั้งเลขคำสั่งซื้อและอีเมล/เบอร์โทรที่ใช้สั่ง เพื่อไม่ให้คนอื่นสุ่มดูข้อมูลได้
import { json, HttpError } from '../../_lib/http.js';
import { loadOrder } from '../../_lib/orders.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const number = (url.searchParams.get('number') || '').trim().toUpperCase();
  const contact = (url.searchParams.get('contact') || '').trim().toLowerCase();
  if (!/^KS\d{12}$/.test(number)) throw new HttpError(422, 'เลขคำสั่งซื้อต้องอยู่ในรูปแบบ KS ตามด้วยตัวเลข 12 หลัก');
  if (!contact) throw new HttpError(422, 'กรุณากรอกอีเมลหรือเบอร์โทรศัพท์ที่ใช้สั่งซื้อ');
  const phone = contact.replace(/\D/g, '');
  const order = await loadOrder(env.DB, 'o.order_number = ? AND (lower(o.customer_email) = ? OR o.phone = ?)', number, contact, phone || '-');
  if (!order) throw new HttpError(404, 'ไม่พบคำสั่งซื้อที่ตรงกับข้อมูลนี้');
  // หน้าติดตามสาธารณะไม่ต้องแสดงที่อยู่เต็ม
  order.shipping_address = { province: order.shipping_address.province, postal_code: order.shipping_address.postal_code };
  delete order.public_ref;
  return json({ ok: true, order });
}
