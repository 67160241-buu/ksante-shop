// ============================================================================
// ความปลอดภัย: Hash รหัสผ่านด้วย PBKDF2 และสร้าง/ตรวจ JWT ด้วย HMAC-SHA256
// ใช้ Web Crypto API ที่มีอยู่ใน Cloudflare Workers โดยไม่ต้องติดตั้งไลบรารีเพิ่ม
// ============================================================================

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;   // 100,000 รอบ คือค่าสูงสุดที่ Cloudflare Workers รองรับ

const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = hex => new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));

/** สุ่มค่าแบบปลอดภัยทางการเข้ารหัส แล้วคืนเป็น hex */
export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Hash รหัสผ่าน: PBKDF2-SHA256 + salt สุ่ม 16 ไบต์ ได้ผลลัพธ์ 32 ไบต์ */
export async function hashPassword(password, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key, 256,
  );
  return { hash: toHex(bits), salt: saltHex };
}

/** เทียบ string แบบใช้เวลาคงที่ ป้องกันการเดารหัสจากเวลาตอบกลับ (timing attack) */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ตรวจรหัสผ่านกับ hash และ salt ที่เก็บในฐานข้อมูล */
export async function verifyPassword(password, hashHex, saltHex) {
  const { hash } = await hashPassword(password, saltHex);
  return safeEqual(hash, hashHex);
}

// ---------------------------------------------------------------------------
// JWT (HS256) แบบเขียนเอง: header.payload.signature (base64url)
// ---------------------------------------------------------------------------
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = obj => b64url(enc.encode(JSON.stringify(obj)));
function fromB64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** สร้าง JWT ที่หมดอายุใน ttlSeconds วินาที */
export async function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const data = `${b64urlJson({ alg: 'HS256', typ: 'JWT' })}.${b64urlJson(body)}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

/** ตรวจลายเซ็นและวันหมดอายุของ JWT คืน payload หรือ null ถ้าไม่ผ่าน */
export async function verifyJwt(token, secret) {
  if (!token || token.split('.').length !== 3) return null;
  const [h, p, s] = token.split('.');
  try {
    const header = JSON.parse(new TextDecoder().decode(fromB64url(h)));
    if (header.alg !== 'HS256') return null;                      // ไม่ยอมรับ alg อื่น (เช่น "none")
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(s), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
