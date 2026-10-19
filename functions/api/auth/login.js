// POST /api/auth/login : เข้าสู่ระบบสำหรับลูกค้า (บัญชีแอดมินต้องใช้ /admin/login)
import { json, readJson, HttpError } from '../../_lib/http.js';
import { verifyPassword } from '../../_lib/crypto.js';
import { issueSession, publicUser } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(422, 'กรุณากรอกอีเมลและรหัสผ่าน');

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // ตอบข้อความเดียวกันทั้งกรณีไม่มีอีเมลและรหัสผิด เพื่อไม่ให้เดาได้ว่าอีเมลไหนมีในระบบ
  if (!user || !(await verifyPassword(password, user.password_hash, user.salt))) {
    throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  if (user.role !== 'customer') throw new HttpError(403, 'บัญชีผู้ดูแลระบบ กรุณาเข้าสู่ระบบที่หน้า /admin/login');
  return json({ ok: true, user: publicUser(user) }, 200, { 'Set-Cookie': await issueSession(env, 'customer', user) });
}
