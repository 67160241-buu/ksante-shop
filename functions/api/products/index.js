// GET /api/products : รายการสินค้าที่เปิดขาย พร้อมค้นหา/กรอง/เรียงลำดับ
//   ?q=คำค้น  &category=caps  &size=M  &color=Cobalt  &min=500 &max=1500
//   &sort=newest|price-asc|price-desc|name  &in_stock=1  &limit=12
import { json } from '../../_lib/http.js';
import { PRODUCT_SELECT, shapeProduct, variantsFor } from '../../_lib/catalog.js';

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  'price-asc': 'p.base_price ASC, p.id',
  'price-desc': 'p.base_price DESC, p.id',
  name: 'p.name COLLATE NOCASE ASC',
  featured: 'p.id ASC',
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const qp = k => (url.searchParams.get(k) || '').trim();
  const where = ['p.is_active = 1'];
  const binds = [];

  const q = qp('q').slice(0, 60);
  if (q) {
    // ค้นจากชื่อ คำอธิบาย วัสดุ และชื่อหมวดหมู่ (LIKE ไม่สนตัวพิมพ์เล็ก-ใหญ่สำหรับภาษาอังกฤษ)
    const like = `%${q.replace(/[%_]/g, '')}%`;
    where.push('(p.name LIKE ? OR p.description LIKE ? OR p.material LIKE ? OR c.name LIKE ?)');
    binds.push(like, like, like, like);
  }
  // หมวดหมู่เลือกได้หลายค่า คั่นด้วยจุลภาค เช่น category=caps,berets
  const cats = qp('category').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  if (cats.length) { where.push(`c.slug IN (${cats.map(() => '?').join(',')})`); binds.push(...cats); }
  const sizes = qp('size').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 10);
  const colors = qp('color').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  const inStock = qp('in_stock') === '1';
  if (sizes.length || colors.length || inStock) {
    const cond = ['v.product_id = p.id'];
    if (sizes.length) { cond.push(`v.size IN (${sizes.map(() => '?').join(',')})`); binds.push(...sizes); }
    if (colors.length) { cond.push(`v.color_name COLLATE NOCASE IN (${colors.map(() => '?').join(',')})`); binds.push(...colors); }
    if (inStock) cond.push('v.stock_quantity > 0');
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE ${cond.join(' AND ')})`);
  }
  const min = Number(qp('min')); const max = Number(qp('max'));
  if (qp('min') && Number.isFinite(min)) { where.push('p.base_price >= ?'); binds.push(min); }
  if (qp('max') && Number.isFinite(max)) { where.push('p.base_price <= ?'); binds.push(max); }

  const order = SORTS[qp('sort')] || SORTS.featured;
  const limit = Math.min(Math.max(parseInt(qp('limit'), 10) || 100, 1), 100);
  const { results } = await env.DB.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit}`)
    .bind(...binds).all();
  const vmap = await variantsFor(env.DB, results.map(p => p.id));
  const products = results.map(p => shapeProduct(p, vmap.get(p.id)));

  // ตัวเลือกสำหรับแผงตัวกรอง (สีและขนาดทั้งหมดที่มีในร้าน)
  const facets = await env.DB.prepare(
    `SELECT DISTINCT v.color_name AS name, v.color_hex AS hex, v.size
       FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.is_active = 1`,
  ).all();
  const colorFacet = [...new Map(facets.results.map(f => [f.name, { name: f.name, hex: f.hex }])).values()];
  const sizeFacet = [...new Set(facets.results.map(f => f.size))].sort((a, b) => ['S', 'M', 'L', 'XL'].indexOf(a) - ['S', 'M', 'L', 'XL'].indexOf(b));

  return json({ ok: true, count: products.length, products, facets: { colors: colorFacet, sizes: sizeFacet } });
}
