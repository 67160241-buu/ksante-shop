// GET /api/categories : หมวดหมู่ทั้งหมด พร้อมจำนวนสินค้าที่เปิดขาย
import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id ORDER BY c.id`,
  ).all();
  return json({ ok: true, categories: results });
}
