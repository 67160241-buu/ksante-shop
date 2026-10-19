// GET /api/products/:slug : รายละเอียดสินค้า 1 รายการ + สินค้าแนะนำในหมวดเดียวกัน
import { json, HttpError } from '../../_lib/http.js';
import { PRODUCT_SELECT, shapeProduct, variantsFor } from '../../_lib/catalog.js';

export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || '');
  const p = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.is_active = 1`).bind(slug).first();
  if (!p) throw new HttpError(404, 'ไม่พบสินค้านี้ หรือสินค้าถูกปิดการขายแล้ว');
  const { results: related } = await env.DB.prepare(
    `${PRODUCT_SELECT} WHERE p.category_id = ? AND p.id <> ? AND p.is_active = 1 ORDER BY p.id LIMIT 4`,
  ).bind(p.category_id, p.id).all();
  const vmap = await variantsFor(env.DB, [p.id, ...related.map(r => r.id)]);
  return json({
    ok: true,
    product: shapeProduct(p, vmap.get(p.id)),
    related: related.map(r => shapeProduct(r, vmap.get(r.id))),
  });
}
