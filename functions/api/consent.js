// POST /api/consent : บันทึกหลักฐานการให้/ถอนความยินยอมคุกกี้ลงตาราง cookie_consents (ตาม PDPA)
// body: { visitor_id, consent: { analytics, preferences, marketing }, version }
import { json, readJson, HttpError } from '../_lib/http.js';
import { getSession } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const visitor = String(body.visitor_id || '');
  if (!/^[a-f0-9]{32}$/.test(visitor)) throw new HttpError(422, 'visitor_id ไม่ถูกต้อง');
  const c = body.consent || {};
  const consent = {
    necessary: true,                         // คุกกี้จำเป็นเปิดเสมอ
    analytics: c.analytics === true,
    preferences: c.preferences === true,
    marketing: c.marketing === true,
    version: String(body.version || '1').slice(0, 10),
  };
  const session = await getSession(request, env, 'customer').catch(() => null);
  const identifier = session ? `user:${session.id}|visitor:${visitor}` : `visitor:${visitor}`;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
  await env.DB.prepare('INSERT INTO cookie_consents (user_identifier, consent_data, ip_address) VALUES (?, ?, ?)')
    .bind(identifier, JSON.stringify(consent), ip).run();
  return json({ ok: true, consent });
}
