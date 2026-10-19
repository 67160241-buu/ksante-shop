// ============================================================================
// แปลงข้อมูลสินค้าจากฐานข้อมูลให้เป็นรูปแบบที่หน้าเว็บใช้ได้ทันที
// ============================================================================

export const LOW_STOCK = 5;   // สต็อก <= 5 ถือว่า "ใกล้หมด"
export const SIZE_ORDER = ['S', 'M', 'L', 'XL'];

/** ดึง variant ของสินค้าหลายตัวในครั้งเดียว แล้วจัดกลุ่มตาม product_id */
export async function variantsFor(db, productIds) {
  const map = new Map(productIds.map(id => [id, []]));
  if (!productIds.length) return map;
  const marks = productIds.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT id, product_id, color_name, color_hex, size, sku, stock_quantity, image_url
       FROM product_variants WHERE product_id IN (${marks}) ORDER BY id`,
  ).bind(...productIds).all();
  for (const v of results) map.get(v.product_id)?.push(v);
  return map;
}

/** รวมข้อมูลสินค้า + variant เป็น object เดียว พร้อมรายการสีและขนาดที่มี */
export function shapeProduct(p, variants = []) {
  const colors = [];
  for (const v of variants) {
    let c = colors.find(x => x.name === v.color_name);
    if (!c) colors.push(c = { name: v.color_name, hex: v.color_hex, image_url: v.image_url || p.image_url, stock: 0 });
    c.stock += v.stock_quantity;
  }
  const sizes = [...new Set(variants.map(v => v.size))]
    .sort((a, b) => (SIZE_ORDER.indexOf(a) + 99) % 99 - (SIZE_ORDER.indexOf(b) + 99) % 99);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    material: p.material,
    price: p.base_price,
    stock: p.stock_quantity,
    image_url: p.image_url,
    is_active: !!p.is_active,
    created_at: p.created_at,
    category: { id: p.category_id, name: p.category_name, slug: p.category_slug },
    colors,
    sizes,
    variants: variants.map(v => ({
      id: v.id, color_name: v.color_name, color_hex: v.color_hex, size: v.size,
      sku: v.sku, stock: v.stock_quantity, image_url: v.image_url || p.image_url,
    })),
  };
}

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON c.id = p.category_id`;

/** ทำ slug จากชื่อสินค้า เช่น "Everyday Twill Cap" -> "everyday-twill-cap" */
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}
