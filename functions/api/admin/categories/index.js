// GET  /api/admin/categories : หมวดหมู่ทั้งหมด (รวมจำนวนสินค้า)
// POST /api/admin/categories : เพิ่มหมวดหมู่ { name, slug? }
import { json, readJson, text, HttpError } from '../../../_lib/http.js';
import { slugify } from '../../../_lib/catalog.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, COUNT(p.id) AS product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.id`,
  ).all();
  return json({ ok: true, categories: results });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const name = text(body.name, 'ชื่อหมวดหมู่', { max: 60 });
  const slug = slugify(text(body.slug, 'slug', { required: false, max: 60 }) || name);
  try {
    const row = await env.DB.prepare('INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING *').bind(name, slug).first();
    return json({ ok: true, category: row }, 201);
  } catch (err) {
    if (/UNIQUE/i.test(String(err.message))) throw new HttpError(409, 'slug หมวดหมู่นี้มีอยู่แล้ว');
    throw err;
  }
}
