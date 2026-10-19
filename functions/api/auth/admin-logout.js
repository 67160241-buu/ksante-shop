// POST /api/auth/admin-logout : ออกจากระบบผู้ดูแล
import { json } from '../../_lib/http.js';
import { clearSession } from '../../_lib/auth.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSession('admin') });
}
