// GET /api/auth/me : ข้อมูลผู้ใช้ที่ล็อกอินอยู่ (ไม่ได้ล็อกอินจะได้ user: null)
// PUT /api/auth/me : แก้ไขโปรไฟล์ และที่อยู่จัดส่งเริ่มต้น
import { json, readJson, text, address, HttpError, PHONE_RE } from '../../_lib/http.js';
import { getSession, requireCustomer, publicUser, clearSession } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env, 'customer');
  if (!s) return json({ ok: true, user: null });
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.id).first();
  if (!user) return json({ ok: true, user: null }, 200, { 'Set-Cookie': clearSession('customer') });
  return json({ ok: true, user: publicUser(user) });
}

export async function onRequestPut({ request, env }) {
  const s = await requireCustomer(request, env);
  const body = await readJson(request);
  const full_name = text(body.full_name, 'ชื่อ-นามสกุล', { max: 100 });
  const phone = text(body.phone, 'เบอร์โทรศัพท์', { required: false, max: 10 }).replace(/\D/g, '');
  if (phone && !PHONE_RE.test(phone)) throw new HttpError(422, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0');
  // ที่อยู่เริ่มต้นเป็นตัวเลือก: ส่ง null มา = ลบที่อยู่
  const addr = body.default_address ? address(body.default_address) : null;
  const user = await env.DB.prepare(
    'UPDATE users SET full_name = ?, phone = ?, default_address = ? WHERE id = ? RETURNING *',
  ).bind(full_name, phone || null, addr ? JSON.stringify(addr) : null, s.id).first();
  return json({ ok: true, user: publicUser(user) });
}
