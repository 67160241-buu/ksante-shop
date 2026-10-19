// ============================================================================
// ระบบ Session: เก็บ JWT ไว้ใน HTTP-Only Cookie (JavaScript ฝั่งหน้าเว็บอ่านไม่ได้ ป้องกัน XSS ขโมย token)
// แยก cookie ของลูกค้า (ks_session) กับผู้ดูแล (ks_admin) ออกจากกันชัดเจน
// ============================================================================
import { HttpError } from './http.js';
import { signJwt, verifyJwt } from './crypto.js';

export const SESSIONS = {
  customer: { cookie: 'ks_session', ttl: 60 * 60 * 24 * 7 },   // ลูกค้า: 7 วัน
  admin: { cookie: 'ks_admin', ttl: 60 * 60 * 8 },             // แอดมิน: 8 ชั่วโมง
};

/** ดึงค่า JWT_SECRET (ต้องตั้งเป็น Secret บน Cloudflare หรือในไฟล์ .dev.vars ตอนทดสอบ) */
function secretOf(env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new HttpError(500, 'ระบบยังไม่ได้ตั้งค่า JWT_SECRET (ต้องยาวอย่างน้อย 32 ตัวอักษร) ดูวิธีตั้งค่าใน DEPLOYMENT.md');
  }
  return env.JWT_SECRET;
}

/** อ่านค่า cookie ตามชื่อจาก request */
export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** สร้าง header Set-Cookie แบบปลอดภัย (HttpOnly + Secure + SameSite=Lax) */
export function cookieHeader(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** ออก session ใหม่หลังล็อกอินสำเร็จ คืนค่า header Set-Cookie */
export async function issueSession(env, kind, user) {
  const conf = SESSIONS[kind];
  const token = await signJwt({ sub: user.id, role: user.role, aud: kind, name: user.full_name }, secretOf(env), conf.ttl);
  return cookieHeader(conf.cookie, token, conf.ttl);
}

/** ลบ session (ตั้ง Max-Age=0) */
export function clearSession(kind) {
  return cookieHeader(SESSIONS[kind].cookie, '', 0);
}

/** อ่าน session จาก cookie คืน {id, role, name} หรือ null */
export async function getSession(request, env, kind) {
  const token = readCookie(request, SESSIONS[kind].cookie);
  if (!token) return null;
  const payload = await verifyJwt(token, secretOf(env));
  if (!payload || payload.aud !== kind) return null;
  if (kind === 'admin' && payload.role !== 'admin') return null;
  return { id: payload.sub, role: payload.role, name: payload.name };
}

/** บังคับว่าต้องล็อกอินเป็นลูกค้า ไม่งั้นตอบ 401 */
export async function requireCustomer(request, env) {
  const s = await getSession(request, env, 'customer');
  if (!s) throw new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน');
  return s;
}

/** บังคับว่าต้องเป็นแอดมิน และบัญชียังมีสิทธิ์ admin อยู่จริงในฐานข้อมูล */
export async function requireAdmin(request, env) {
  const s = await getSession(request, env, 'admin');
  if (!s) throw new HttpError(401, 'กรุณาเข้าสู่ระบบผู้ดูแลระบบ');
  const row = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(s.id).first();
  if (!row || row.role !== 'admin') throw new HttpError(403, 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');
  return s;
}

/** ข้อมูลผู้ใช้ที่ส่งให้หน้าเว็บได้ (ไม่มี password_hash / salt) */
export function publicUser(u) {
  let addr = null;
  try { addr = u.default_address ? JSON.parse(u.default_address) : null; } catch { addr = null; }
  return { id: u.id, email: u.email, full_name: u.full_name, phone: u.phone || '', role: u.role, default_address: addr, created_at: u.created_at };
}
