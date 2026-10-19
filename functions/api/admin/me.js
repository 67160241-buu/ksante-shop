// GET /api/admin/me : ข้อมูลแอดมินที่ล็อกอินอยู่ (middleware ตรวจสิทธิ์ให้แล้ว)
import { json } from '../../_lib/http.js';
import { publicUser } from '../../_lib/auth.js';

export async function onRequestGet({ env, data }) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(data.admin.id).first();
  return json({ ok: true, user: publicUser(user) });
}
