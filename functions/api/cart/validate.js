// POST /api/cart/validate : ตรวจตะกร้ากับสต็อกและราคาจริงในฐานข้อมูล (ตะกร้าเก็บในเครื่องลูกค้า)
// body: { items: [{ variant_id, quantity }] }
import { json, readJson } from '../../_lib/http.js';
import { priceCart, shippingFor } from '../../_lib/orders.js';

export async function onRequestPost({ request, env }) {
  const { items } = await readJson(request);
  if (!Array.isArray(items) || !items.length) {
    return json({ ok: true, lines: [], subtotal: 0, shipping_fee: 0, total: 0, problems: [], free_shipping_threshold: Number(env.FREE_SHIPPING_THRESHOLD ?? 2500) });
  }
  const { lines, subtotal, problems } = await priceCart(env.DB, items);
  const shipping_fee = shippingFor(env, subtotal);
  return json({
    ok: true, lines, subtotal, shipping_fee, total: subtotal + shipping_fee, problems,
    free_shipping_threshold: Number(env.FREE_SHIPPING_THRESHOLD ?? 2500), cod_fee: 30,
  });
}
