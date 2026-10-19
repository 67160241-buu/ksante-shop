// POST /api/auth/admin-login : เข้าสู่ระบบผู้ดูแล (รับเฉพาะ role = admin) ออก cookie ks_admin แยกจากลูกค้า
import { json, readJson, HttpError } from '../../_lib/http.js';
import { verifyPassword } from '../../_lib/crypto.js';
import { issueSession, publicUser } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(422, 'กรุณากรอกอีเมลและรหัสผ่าน');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const valid = user && (await verifyPassword(password, user.password_hash, user.salt));
  if (!valid || user.role !== 'admin') throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');
  return json({ ok: true, user: publicUser(user) }, 200, { 'Set-Cookie': await issueSession(env, 'admin', user) });
}
