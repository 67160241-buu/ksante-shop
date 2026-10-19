// GET   /api/admin/inventory : สต็อกทุก variant ?filter=low|out&q=
// PATCH /api/admin/inventory : อัปเดตสต็อกหลายรายการพร้อมกัน { updates: [{ id, stock_quantity }] }
import { json, readJson, int, HttpError } from '../../_lib/http.js';
import { LOW_STOCK } from '../../_lib/catalog.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const where = ['1 = 1'];
  const binds = [];
  const filter = url.searchParams.get('filter');
  if (filter === 'low') { where.push('v.stock_quantity BETWEEN 1 AND ?'); binds.push(LOW_STOCK); }
  if (filter === 'out') where.push('v.stock_quantity = 0');
  const q = (url.searchParams.get('q') || '').trim();
  if (q) { where.push('(p.name LIKE ? OR v.sku LIKE ? OR v.color_name LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const { results } = await env.DB.prepare(
    `SELECT v.*, p.name AS product_name, p.is_active, c.name AS category_name
       FROM product_variants v JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')} ORDER BY p.id, v.color_name, CASE v.size WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 WHEN 'XL' THEN 4 ELSE 5 END`,
  ).bind(...binds).all();
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS variants, SUM(stock_quantity) AS units,
            SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
            SUM(CASE WHEN stock_quantity BETWEEN 1 AND ? THEN 1 ELSE 0 END) AS low_stock
       FROM product_variants`,
  ).bind(LOW_STOCK).first();
  return json({ ok: true, low_stock_threshold: LOW_STOCK, summary, variants: results });
}

export async function onRequestPatch({ request, env }) {
  const { updates } = await readJson(request);
  if (!Array.isArray(updates) || !updates.length) throw new HttpError(422, 'ไม่มีรายการที่ต้องอัปเดต');
  if (updates.length > 200) throw new HttpError(422, 'อัปเดตได้ครั้งละไม่เกิน 200 รายการ');
  const stmts = updates.map((u, i) => env.DB.prepare('UPDATE product_variants SET stock_quantity = ? WHERE id = ?')
    .bind(int(u.stock_quantity, `แถวที่ ${i + 1}: จำนวน`, { min: 0, max: 100000 }), int(u.id, 'id', { min: 1, max: 1e9 })));
  const res = await env.DB.batch(stmts);
  // นับเฉพาะแถวที่เจอจริง (meta.changes รวมแถวที่ trigger แก้ด้วย จึงนับแบบ > 0 ต่อคำสั่ง)
  return json({ ok: true, updated: res.filter(r => r.meta.changes > 0).length });
}
