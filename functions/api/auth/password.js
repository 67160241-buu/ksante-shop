// PUT /api/auth/password : เปลี่ยนรหัสผ่าน (ต้องยืนยันรหัสเดิม)
import { json, readJson, HttpError } from '../../_lib/http.js';
import { hashPassword, verifyPassword } from '../../_lib/crypto.js';
import { requireCustomer } from '../../_lib/auth.js';

export async function onRequestPut({ request, env }) {
  const s = await requireCustomer(request, env);
  const { current_password = '', new_password = '' } = await readJson(request);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.id).first();
  if (!user || !(await verifyPassword(String(current_password), user.password_hash, user.salt))) {
    throw new HttpError(401, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  const pw = String(new_password);
  if (pw.length < 8 || pw.length > 128 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw new HttpError(422, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข');
  }
  const { hash, salt } = await hashPassword(pw);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, s.id).run();
  return json({ ok: true });
}
