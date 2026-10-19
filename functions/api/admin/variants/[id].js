// PATCH /api/admin/variants/:id : ตั้งค่าสต็อกใหม่ { stock_quantity } หรือปรับเพิ่ม/ลด { adjust: +10 / -2 }
import { json, readJson, int, HttpError } from '../../../_lib/http.js';

export async function onRequestPatch({ request, env, params }) {
  const id = Number(params.id);
  const body = await readJson(request);
  let row;
  try {
    row = body.adjust !== undefined
      ? await env.DB.prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? RETURNING *')
          .bind(int(body.adjust, 'จำนวนที่ปรับ', { min: -100000, max: 100000 }), id).first()
      : await env.DB.prepare('UPDATE product_variants SET stock_quantity = ? WHERE id = ? RETURNING *')
          .bind(int(body.stock_quantity, 'จำนวนสต็อก', { min: 0, max: 100000 }), id).first();
  } catch (err) {
    if (/CHECK constraint/i.test(String(err.message))) throw new HttpError(422, 'สต็อกติดลบไม่ได้');
    throw err;
  }
  if (!row) throw new HttpError(404, 'ไม่พบตัวเลือกสินค้านี้');
  return json({ ok: true, variant: row });
}
