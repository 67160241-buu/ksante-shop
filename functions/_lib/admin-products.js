// ============================================================================
// ตรวจข้อมูลฟอร์มสินค้าจากแอดมิน และสร้างคำสั่ง SQL สำหรับ variant
// ============================================================================
import { HttpError, text, int, money } from './http.js';
import { slugify } from './catalog.js';

const CAT_CODE = { caps: 'CAP', 'bucket-hats': 'BKT', beanies: 'BNE', berets: 'BRT' };
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const URL_RE = /^https:\/\/[^\s"'<>]+$/;

/** ตรวจและทำความสะอาดข้อมูลสินค้า + variant ที่ส่งมาจากฟอร์ม */
export async function cleanProduct(db, body) {
  const category_id = int(body.category_id, 'หมวดหมู่', { min: 1 });
  const cat = await db.prepare('SELECT id, slug FROM categories WHERE id = ?').bind(category_id).first();
  if (!cat) throw new HttpError(422, 'ไม่พบหมวดหมู่ที่เลือก');
  const name = text(body.name, 'ชื่อสินค้า', { max: 120 });
  const slug = slugify(text(body.slug, 'slug', { required: false, max: 120 }) || name);
  const image_url = text(body.image_url, 'URL รูปภาพหลัก', { max: 500 });
  if (!URL_RE.test(image_url)) throw new HttpError(422, 'URL รูปภาพต้องขึ้นต้นด้วย https://');

  if (!Array.isArray(body.variants) || !body.variants.length) throw new HttpError(422, 'ต้องมีตัวเลือกสี/ขนาดอย่างน้อย 1 รายการ');
  if (body.variants.length > 80) throw new HttpError(422, 'ตัวเลือกสี/ขนาดมากเกินไป (สูงสุด 80)');
  const seen = new Set();
  const variants = body.variants.map((v, i) => {
    const n = `แถวที่ ${i + 1}: `;
    const color_name = text(v.color_name, `${n}ชื่อสี`, { max: 40 });
    const color_hex = text(v.color_hex, `${n}รหัสสี`, { max: 7 });
    if (!HEX_RE.test(color_hex)) throw new HttpError(422, `${n}รหัสสีต้องเป็นรูปแบบ #RRGGBB`);
    const size = text(v.size, `${n}ขนาด`, { max: 10 }).toUpperCase();
    const key = `${color_name.toLowerCase()}|${size}`;
    if (seen.has(key)) throw new HttpError(422, `${n}สี ${color_name} ขนาด ${size} ซ้ำกับแถวอื่น`);
    seen.add(key);
    const image = text(v.image_url, `${n}URL รูป`, { required: false, max: 500 });
    if (image && !URL_RE.test(image)) throw new HttpError(422, `${n}URL รูปต้องขึ้นต้นด้วย https://`);
    const autoSku = `${CAT_CODE[cat.slug] || 'HAT'}-${slug.slice(0, 12).toUpperCase()}-${color_name.slice(0, 3).toUpperCase()}-${size}`;
    return {
      id: v.id ? int(v.id, `${n}id`, { min: 1, max: 1e9 }) : null,
      color_name, color_hex: color_hex.toUpperCase(), size,
      sku: (text(v.sku, `${n}SKU`, { required: false, max: 40 }) || autoSku).toUpperCase().replace(/\s+/g, '-'),
      stock_quantity: int(v.stock_quantity ?? 0, `${n}จำนวนสต็อก`, { min: 0, max: 100000 }),
      image_url: image || null,
    };
  });
  return {
    category_id, name, slug, image_url, variants,
    description: text(body.description, 'รายละเอียดสินค้า', { required: false, max: 3000 }),
    material: text(body.material, 'วัสดุ', { required: false, max: 120 }),
    base_price: money(body.base_price, 'ราคา'),
    is_active: body.is_active === false || body.is_active === 0 ? 0 : 1,
  };
}

/** แปลง error ของ SQLite เป็นข้อความที่แอดมินเข้าใจ */
export function friendlyDbError(err) {
  const m = String(err?.message || err);
  if (/UNIQUE constraint failed: products\.slug/i.test(m)) return new HttpError(409, 'slug นี้ถูกใช้กับสินค้าอื่นแล้ว');
  if (/UNIQUE constraint failed: product_variants\.sku/i.test(m)) return new HttpError(409, 'มี SKU ซ้ำกับสินค้าอื่น กรุณาแก้ SKU');
  if (/UNIQUE constraint failed: product_variants/i.test(m)) return new HttpError(409, 'มีสีและขนาดซ้ำกัน');
  return err;
}
