// POST /api/events : เก็บสถิติการเข้าชมหน้าเว็บ (Analytics)
// ฝั่ง API ตรวจซ้ำจาก cookie ks_consent ว่าผู้ใช้ยอมรับ Analytics แล้ว ถ้ายังไม่ยอมรับจะไม่บันทึกอะไรเลย
import { json, readJson } from '../_lib/http.js';
import { readCookie } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const consent = readCookie(request, 'ks_consent') || '';
  if (!/(^|\.)a1(\.|$)/.test(consent)) return json({ ok: true, recorded: false, reason: 'no-analytics-consent' });
  const body = await readJson(request);
  const visitor = String(body.visitor_id || '');
  const event = String(body.event || 'page_view').slice(0, 40);
  const path = String(body.path || '/').slice(0, 200);
  if (!/^[a-f0-9]{32}$/.test(visitor)) return json({ ok: true, recorded: false, reason: 'bad-visitor' });
  await env.DB.prepare('INSERT INTO analytics_events (visitor_id, event, path) VALUES (?, ?, ?)').bind(visitor, event, path).run();
  return json({ ok: true, recorded: true });
}
