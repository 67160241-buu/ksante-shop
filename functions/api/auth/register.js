// POST /api/auth/register : สมัครสมาชิกลูกค้าใหม่ แล้วล็อกอินให้ทันที
import { json, readJson, text, HttpError, EMAIL_RE, PHONE_RE } from '../../_lib/http.js';
import { hashPassword } from '../../_lib/crypto.js';
import { issueSession, publicUser } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const full_name = text(body.full_name, 'ชื่อ-นามสกุล', { max: 100 });
  const email = text(body.email, 'อีเมล', { max: 120 }).toLowerCase();
  const phone = text(body.phone, 'เบอร์โทรศัพท์', { required: false, max: 10 }).replace(/\D/g, '');
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) throw new HttpError(422, 'รูปแบบอีเมลไม่ถูกต้อง');
  if (phone && !PHONE_RE.test(phone)) throw new HttpError(422, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(422, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข');
  }
  if (password.length > 128) throw new HttpError(422, 'รหัสผ่านยาวเกินไป');

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'อีเมลนี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบ');

  const { hash, salt } = await hashPassword(password);
  const user = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, salt, full_name, phone, role) VALUES (?, ?, ?, ?, ?, 'customer') RETURNING *`,
  ).bind(email, hash, salt, full_name, phone || null).first();

  return json({ ok: true, user: publicUser(user) }, 201, { 'Set-Cookie': await issueSession(env, 'customer', user) });
}
