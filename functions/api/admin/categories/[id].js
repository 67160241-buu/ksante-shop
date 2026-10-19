// PUT    /api/admin/categories/:id : แก้ชื่อ/slug หมวดหมู่
// DELETE /api/admin/categories/:id : ลบหมวดหมู่ (ลบได้เฉพาะหมวดที่ไม่มีสินค้า)
import { json, readJson, text, HttpError } from '../../../_lib/http.js';
import { slugify } from '../../../_lib/catalog.js';

export async function onRequestPut({ request, env, params }) {
  const body = await readJson(request);
  const name = text(body.name, 'ชื่อหมวดหมู่', { max: 60 });
  const slug = slugify(text(body.slug, 'slug', { required: false, max: 60 }) || name);
  try {
    const row = await env.DB.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ? RETURNING *').bind(name, slug, Number(params.id)).first();
    if (!row) throw new HttpError(404, 'ไม่พบหมวดหมู่');
    return json({ ok: true, category: row });
  } catch (err) {
    if (/UNIQUE/i.test(String(err.message))) throw new HttpError(409, 'slug หมวดหมู่นี้มีอยู่แล้ว');
    throw err;
  }
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').bind(id).first();
  if (used.n > 0) throw new HttpError(409, `ลบไม่ได้ เพราะยังมีสินค้า ${used.n} รายการในหมวดนี้`);
  const res = await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  if (!res.meta.changes) throw new HttpError(404, 'ไม่พบหมวดหมู่');
  return json({ ok: true });
}
