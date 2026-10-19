// ============================================================================
// ป้องกันหน้า /admin/* : ต้องมี cookie ks_admin ที่ถูกต้องและ role = admin เท่านั้น
// ลูกค้าที่ล็อกอินอยู่ (มีแค่ ks_session) จะถูกส่งไปหน้าเข้าสู่ระบบผู้ดูแล
// หน้า /admin/login เปิดได้เสมอ
// ============================================================================
import { getSession } from '../_lib/auth.js';

const PUBLIC = new Set(['/admin/login', '/admin/login.html']);

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (PUBLIC.has(url.pathname)) return next();
  const admin = await getSession(request, env, 'admin');
  if (!admin) {
    const back = encodeURIComponent(url.pathname + url.search);
    return Response.redirect(`${url.origin}/admin/login?next=${back}`, 302);
  }
  const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(admin.id).first();
  if (!user || user.role !== 'admin') return Response.redirect(`${url.origin}/admin/login?denied=1`, 302);
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');   // ห้าม cache หน้าแอดมิน
  return out;
}
