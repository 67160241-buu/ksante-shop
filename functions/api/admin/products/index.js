// GET  /api/admin/products : สินค้าทั้งหมด (รวมที่ปิดขาย) ?q=&category_id=
// POST /api/admin/products : เพิ่มสินค้าใหม่พร้อม variant ทั้งหมด ในคำสั่งเดียว (Atomic)
import { json, readJson } from '../../../_lib/http.js';
import { PRODUCT_SELECT, shapeProduct, variantsFor } from '../../../_lib/catalog.js';
import { cleanProduct, friendlyDbError } from '../../../_lib/admin-products.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const where = ['1 = 1'];
  const binds = [];
  const q = (url.searchParams.get('q') || '').trim();
  if (q) { where.push('(p.name LIKE ? OR p.slug LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
  const cat = Number(url.searchParams.get('category_id'));
  if (cat) { where.push('p.category_id = ?'); binds.push(cat); }
  const { results } = await env.DB.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.id DESC`).bind(...binds).all();
  const vmap = await variantsFor(env.DB, results.map(p => p.id));
  return json({ ok: true, products: results.map(p => shapeProduct(p, vmap.get(p.id))) });
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const p = await cleanProduct(db, await readJson(request));
  const pid = '(SELECT id FROM products WHERE slug = ?)';
  const stmts = [
    db.prepare(`INSERT INTO products (category_id, name, slug, description, material, base_price, image_url, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(p.category_id, p.name, p.slug, p.description, p.material, p.base_price, p.image_url, p.is_active),
    ...p.variants.map(v => db.prepare(
      `INSERT INTO product_variants (product_id, color_name, color_hex, size, sku, stock_quantity, image_url)
       VALUES (${pid}, ?, ?, ?, ?, ?, ?)`).bind(p.slug, v.color_name, v.color_hex, v.size, v.sku, v.stock_quantity, v.image_url)),
  ];
  try {
    await db.batch(stmts);
  } catch (err) {
    throw friendlyDbError(err);
  }
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`).bind(p.slug).first();
  const vmap = await variantsFor(db, [row.id]);
  return json({ ok: true, product: shapeProduct(row, vmap.get(row.id)) }, 201);
}
