// GET    /api/admin/products/:id : ข้อมูลสินค้าสำหรับฟอร์มแก้ไข
// PUT    /api/admin/products/:id : แก้ไขสินค้า + variant (แถวที่ไม่ส่งมาจะถูกลบ แถวที่ไม่มี id จะถูกเพิ่ม)
// DELETE /api/admin/products/:id : ลบสินค้า (ประวัติออเดอร์ยังอยู่ เพราะเก็บชื่อ/ราคาไว้ใน order_items)
import { json, readJson, HttpError } from '../../../_lib/http.js';
import { PRODUCT_SELECT, shapeProduct, variantsFor } from '../../../_lib/catalog.js';
import { cleanProduct, friendlyDbError } from '../../../_lib/admin-products.js';

async function loadOne(db, id) {
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'ไม่พบสินค้า');
  const vmap = await variantsFor(db, [id]);
  return shapeProduct(row, vmap.get(id));
}

export async function onRequestGet({ env, params }) {
  return json({ ok: true, product: await loadOne(env.DB, Number(params.id)) });
}

export async function onRequestPut({ request, env, params }) {
  const db = env.DB;
  const id = Number(params.id);
  const current = await loadOne(db, id);
  const p = await cleanProduct(db, await readJson(request));
  const keepIds = new Set(p.variants.filter(v => v.id).map(v => v.id));
  for (const v of p.variants) {
    if (v.id && !current.variants.some(cv => cv.id === v.id)) throw new HttpError(422, `variant id ${v.id} ไม่ใช่ของสินค้านี้`);
  }
  const stmts = [
    db.prepare(`UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, material = ?, base_price = ?, image_url = ?, is_active = ?
                WHERE id = ?`).bind(p.category_id, p.name, p.slug, p.description, p.material, p.base_price, p.image_url, p.is_active, id),
  ];
  // ลบ variant ที่ถูกเอาออกจากฟอร์ม
  for (const cv of current.variants) {
    if (!keepIds.has(cv.id)) stmts.push(db.prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?').bind(cv.id, id));
  }
  // ย้าย SKU เดิมออกชั่วคราวก่อน เพื่อให้สลับ SKU ระหว่างแถวได้โดยไม่ชน UNIQUE
  for (const v of p.variants.filter(v => v.id)) {
    stmts.push(db.prepare("UPDATE product_variants SET sku = 'TMP-' || id WHERE id = ?").bind(v.id));
  }
  for (const v of p.variants) {
    stmts.push(v.id
      ? db.prepare(`UPDATE product_variants SET color_name = ?, color_hex = ?, size = ?, sku = ?, stock_quantity = ?, image_url = ?
                    WHERE id = ? AND product_id = ?`).bind(v.color_name, v.color_hex, v.size, v.sku, v.stock_quantity, v.image_url, v.id, id)
      : db.prepare(`INSERT INTO product_variants (product_id, color_name, color_hex, size, sku, stock_quantity, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, v.color_name, v.color_hex, v.size, v.sku, v.stock_quantity, v.image_url));
  }
  try {
    await db.batch(stmts);
  } catch (err) {
    throw friendlyDbError(err);
  }
  return json({ ok: true, product: await loadOne(db, id) });
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  const res = await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  if (!res.meta.changes) throw new HttpError(404, 'ไม่พบสินค้า');
  return json({ ok: true });
}
