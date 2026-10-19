// ============================================================================
// หัวใจของระบบสั่งซื้อ: สร้างออเดอร์ + ตัดสต็อกแบบ Atomic, เปลี่ยนสถานะ, คืนสต็อกเมื่อยกเลิก
// ============================================================================
import { HttpError, parseJson } from './http.js';
import { randomHex } from './crypto.js';

export const STATUSES = ['Pending', 'Confirmed', 'Packing', 'Shipped', 'Completed', 'Cancelled'];
export const FLOW = ['Pending', 'Confirmed', 'Packing', 'Shipped', 'Completed'];
export const PAYMENT_METHODS = { bank_transfer: 'โอนเงินผ่านธนาคาร', promptpay: 'PromptPay QR', cod: 'เก็บเงินปลายทาง' };
const COD_FEE = 30;           // ค่าธรรมเนียมเก็บเงินปลายทาง
const MAX_LINES = 20;
const MAX_QTY = 20;

/** ค่าส่งตามยอดสั่งซื้อ (อ่านค่าจาก wrangler.toml [vars]) */
export function shippingFor(env, subtotal) {
  const fee = Number(env.SHIPPING_FEE ?? 60);
  const free = Number(env.FREE_SHIPPING_THRESHOLD ?? 2500);
  return subtotal >= free ? 0 : fee;
}

/** วันที่ตามเวลาประเทศไทย (UTC+7) รูปแบบ YYYYMMDD ใช้ทำเลขคำสั่งซื้อ */
export function thaiDayKey(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

/** สร้าง UUID v4 สำหรับ public_ref */
function uuid() {
  const h = randomHex(16).split('');
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * ตรวจตะกร้ากับสต็อกจริงในฐานข้อมูล (ใช้ทั้งตอนเช็กตะกร้าและตอนสั่งซื้อ)
 * คืน { lines, subtotal, problems } โดย problems คือรายการที่สต็อกไม่พอ/สินค้าไม่มีแล้ว
 */
export async function priceCart(db, rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new HttpError(422, 'ตะกร้าสินค้าว่างอยู่');
  // รวมรายการที่เป็น variant เดียวกันเข้าด้วยกัน
  const qty = new Map();
  for (const it of rawItems) {
    const id = Number(it?.variant_id);
    const n = Number(it?.quantity);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(n) || n <= 0) throw new HttpError(422, 'รายการในตะกร้าไม่ถูกต้อง');
    qty.set(id, (qty.get(id) || 0) + n);
  }
  if (qty.size > MAX_LINES) throw new HttpError(422, `สั่งได้สูงสุด ${MAX_LINES} รายการต่อออเดอร์`);

  const ids = [...qty.keys()];
  const { results } = await db.prepare(
    `SELECT v.id, v.product_id, v.color_name, v.size, v.stock_quantity, v.image_url,
            p.name, p.slug, p.base_price, p.is_active, p.image_url AS product_image
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE v.id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).all();
  const byId = new Map(results.map(r => [r.id, r]));

  const lines = [];
  const problems = [];
  for (const [id, n] of qty) {
    const v = byId.get(id);
    if (!v || !v.is_active) { problems.push({ variant_id: id, reason: 'unavailable', message: 'สินค้านี้ไม่มีจำหน่ายแล้ว', available: 0 }); continue; }
    const line = {
      variant_id: id, product_id: v.product_id, name: v.name, slug: v.slug, color_name: v.color_name, size: v.size,
      image_url: v.image_url || v.product_image, price: v.base_price, quantity: n, available: v.stock_quantity,
    };
    if (n > MAX_QTY) problems.push({ variant_id: id, reason: 'limit', message: `สั่งได้สูงสุด ${MAX_QTY} ชิ้นต่อรายการ`, available: Math.min(MAX_QTY, v.stock_quantity) });
    else if (n > v.stock_quantity) {
      problems.push({ variant_id: id, reason: 'stock', available: v.stock_quantity,
        message: v.stock_quantity === 0 ? `${v.name} (${v.color_name} / ${v.size}) หมดสต็อกแล้ว` : `${v.name} (${v.color_name} / ${v.size}) เหลือเพียง ${v.stock_quantity} ชิ้น` });
    }
    lines.push(line);
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  return { lines, subtotal, problems };
}

/**
 * สร้างคำสั่งซื้อ: ทุกคำสั่งอยู่ใน db.batch() ซึ่ง D1 รันเป็น Transaction เดียว
 * - ถ้าคำสั่งใดล้มเหลว (เช่นสต็อกติดลบชน CHECK constraint) ทุกอย่างจะถูก rollback
 * - จึงไม่มีทางเกิดออเดอร์ที่ตัดสต็อกไม่ครบ หรือสต็อกติดลบ แม้มีคนสั่งพร้อมกัน
 */
export async function createOrder(env, { items, customer, address, payment_method, note, user_id }) {
  const db = env.DB;
  if (!PAYMENT_METHODS[payment_method]) throw new HttpError(422, 'กรุณาเลือกวิธีชำระเงิน');
  const { lines, subtotal, problems } = await priceCart(db, items);
  if (problems.length) throw new HttpError(409, problems[0].message, { problems });

  const shipping = shippingFor(env, subtotal) + (payment_method === 'cod' ? COD_FEE : 0);
  const total = subtotal + shipping;
  const day = thaiDayKey();
  const ref = uuid();
  const orderId = `(SELECT id FROM orders WHERE public_ref = ?)`;

  const stmts = [
    // 1) เพิ่มตัวนับเลขรันของวันนี้ (ถ้ายังไม่มีให้เริ่มที่ 1)
    db.prepare(`INSERT INTO order_counters (day_key, last_seq) VALUES (?, 1)
                ON CONFLICT(day_key) DO UPDATE SET last_seq = last_seq + 1`).bind(day),
    // 2) สร้างหัวออเดอร์ เลขที่ = KS + YYYYMMDD + เลขรัน 4 หลัก
    db.prepare(`INSERT INTO orders (order_number, public_ref, user_id, customer_name, customer_email, phone, shipping_address,
                                    subtotal, shipping_fee, total_amount, payment_method, status, note)
                VALUES ('KS' || ?1 || printf('%04d', (SELECT last_seq FROM order_counters WHERE day_key = ?1)),
                        ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'Pending', ?12)`)
      .bind(day, ref, user_id ?? null, customer.name, customer.email, customer.phone, JSON.stringify(address),
            subtotal, shipping, total, payment_method, note || null),
  ];
  for (const l of lines) {
    // 3) ตัดสต็อก: ถ้าสต็อกไม่พอ ค่าจะติดลบ -> ชน CHECK (stock_quantity >= 0) -> rollback ทั้งชุด
    stmts.push(db.prepare('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?').bind(l.quantity, l.variant_id));
    // 4) บันทึกรายการสินค้า พร้อมเก็บชื่อและราคา ณ ตอนสั่ง
    stmts.push(db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, price, quantity)
                           VALUES (${orderId}, ?, ?, ?, ?, ?, ?)`)
      .bind(ref, l.product_id, l.variant_id, l.name, `${l.color_name} / ${l.size}`, l.price, l.quantity));
  }
  // 5) ประวัติสถานะแรก
  stmts.push(db.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (${orderId}, 'Pending', ?)`)
    .bind(ref, 'รับคำสั่งซื้อแล้ว รอตรวจสอบการชำระเงิน'));

  try {
    await db.batch(stmts);
  } catch (err) {
    if (/CHECK constraint failed/i.test(String(err?.message || err))) {
      throw new HttpError(409, 'ขออภัย สินค้าบางรายการเพิ่งถูกสั่งซื้อไปจนสต็อกไม่พอ กรุณาตรวจสอบตะกร้าอีกครั้ง');
    }
    throw err;
  }
  return loadOrder(db, 'o.public_ref = ?', ref);
}

/** โหลดออเดอร์ 1 รายการ พร้อมรายการสินค้าและประวัติสถานะ */
export async function loadOrder(db, where, ...params) {
  const o = await db.prepare(`SELECT o.* FROM orders o WHERE ${where}`).bind(...params).first();
  if (!o) return null;
  const [items, history] = await db.batch([
    db.prepare(`SELECT i.*, COALESCE(v.image_url, p.image_url) AS image_url, p.slug
                  FROM order_items i
                  LEFT JOIN product_variants v ON v.id = i.variant_id
                  LEFT JOIN products p ON p.id = i.product_id
                 WHERE i.order_id = ? ORDER BY i.id`).bind(o.id),
    db.prepare('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id').bind(o.id),
  ]);
  return shapeOrder(o, items.results, history.results);
}

export function shapeOrder(o, items = [], history = []) {
  return {
    id: o.id,
    order_number: o.order_number,
    public_ref: o.public_ref,
    user_id: o.user_id,
    customer_name: o.customer_name,
    customer_email: o.customer_email,
    phone: o.phone,
    shipping_address: parseJson(o.shipping_address, {}),
    subtotal: o.subtotal,
    shipping_fee: o.shipping_fee,
    total_amount: o.total_amount,
    payment_method: o.payment_method,
    payment_label: PAYMENT_METHODS[o.payment_method],
    status: o.status,
    tracking_number: o.tracking_number,
    note: o.note,
    created_at: o.created_at,
    updated_at: o.updated_at,
    item_count: items.reduce((s, i) => s + i.quantity, 0),
    items: items.map(i => ({
      id: i.id, product_id: i.product_id, variant_id: i.variant_id, product_name: i.product_name,
      variant_label: i.variant_label, price: i.price, quantity: i.quantity, image_url: i.image_url || '', slug: i.slug || null,
    })),
    history,
  };
}

/**
 * เปลี่ยนสถานะออเดอร์ (ใช้ทั้งแอดมิน และลูกค้ายกเลิกออเดอร์ของตัวเอง)
 * - Completed และ Cancelled เป็นสถานะสุดท้าย เปลี่ยนต่อไม่ได้
 * - เดินหน้าได้อย่างเดียว (ข้ามขั้นได้) ย้อนกลับไม่ได้
 * - ยกเลิกได้ก่อนส่งของ (Pending / Confirmed / Packing) และระบบจะคืนสต็อกให้อัตโนมัติ
 */
export async function changeStatus(db, order, nextStatus, { tracking, note } = {}) {
  if (!STATUSES.includes(nextStatus)) throw new HttpError(422, 'สถานะไม่ถูกต้อง');
  const cur = order.status;
  const trackingValue = tracking !== undefined ? (String(tracking).trim() || null) : order.tracking_number;

  if (nextStatus === cur) {
    // เปลี่ยนเฉพาะเลขพัสดุ
    if (trackingValue === order.tracking_number) return;
    await db.batch([
      db.prepare("UPDATE orders SET tracking_number = ?, updated_at = datetime('now') WHERE id = ?").bind(trackingValue, order.id),
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)')
        .bind(order.id, cur, trackingValue ? `อัปเดตเลขพัสดุเป็น ${trackingValue}` : 'ลบเลขพัสดุ'),
    ]);
    return;
  }
  if (cur === 'Completed' || cur === 'Cancelled') throw new HttpError(409, `ออเดอร์ที่ ${cur === 'Completed' ? 'สำเร็จ' : 'ยกเลิก'} แล้ว เปลี่ยนสถานะไม่ได้`);
  if (nextStatus === 'Cancelled' && !['Pending', 'Confirmed', 'Packing'].includes(cur)) {
    throw new HttpError(409, 'ยกเลิกไม่ได้ เพราะส่งพัสดุออกไปแล้ว');
  }
  if (nextStatus !== 'Cancelled' && FLOW.indexOf(nextStatus) < FLOW.indexOf(cur)) {
    throw new HttpError(409, 'ไม่สามารถย้อนสถานะกลับได้');
  }
  if (nextStatus === 'Shipped' && !trackingValue) throw new HttpError(422, 'กรุณาใส่เลขพัสดุก่อนเปลี่ยนเป็น Shipped');

  const defaults = { Confirmed: 'ยืนยันคำสั่งซื้อแล้ว', Packing: 'กำลังแพ็กสินค้า', Shipped: `ส่งพัสดุแล้ว เลขพัสดุ ${trackingValue}`,
    Completed: 'จัดส่งสำเร็จ', Cancelled: 'ยกเลิกคำสั่งซื้อและคืนสต็อกแล้ว' };
  const stmts = [
    db.prepare("UPDATE orders SET status = ?, tracking_number = ?, updated_at = datetime('now') WHERE id = ? AND status = ?")
      .bind(nextStatus, trackingValue, order.id, cur),
    // ด่านกันชนกัน: ถ้า UPDATE ด้านบนไม่เจอแถว (มีคนเปลี่ยนสถานะไปก่อน) ให้ json() โยน error -> rollback ทั้ง batch
    db.prepare("SELECT CASE WHEN changes() = 0 THEN json('status-conflict') ELSE 1 END AS guard"),
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').bind(order.id, nextStatus, note || defaults[nextStatus]),
  ];
  if (nextStatus === 'Cancelled') {
    // คืนสต็อกทุกรายการในออเดอร์ (เฉพาะ variant ที่ยังมีอยู่)
    stmts.push(db.prepare(`UPDATE product_variants SET stock_quantity = stock_quantity +
                             (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = ? AND variant_id = product_variants.id)
                           WHERE id IN (SELECT variant_id FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL)`)
      .bind(order.id, order.id));
  }
  try {
    await db.batch(stmts);
  } catch (err) {
    if (/malformed JSON/i.test(String(err?.message || err))) throw new HttpError(409, 'สถานะออเดอร์ถูกเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า');
    throw err;
  }
}
