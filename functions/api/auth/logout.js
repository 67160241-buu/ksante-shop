// POST /api/auth/logout : ออกจากระบบลูกค้า (ลบ cookie)
import { json } from '../../_lib/http.js';
import { clearSession } from '../../_lib/auth.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSession('customer') });
}
