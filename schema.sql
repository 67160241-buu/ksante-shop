-- ============================================================================
-- K'Sante Headwear : โครงสร้างฐานข้อมูล Cloudflare D1 (SQLite)
-- รันด้วย:  npx wrangler d1 execute ksante-db --remote --file=./schema.sql
--   (ทดสอบในเครื่องใช้ --local แทน --remote)
-- ไฟล์นี้ลบตารางเดิมทิ้งก่อนสร้างใหม่ จึงรันซ้ำได้ (ข้อมูลเดิมจะหายทั้งหมด)
-- ============================================================================

-- หมายเหตุ: D1 บังคับใช้ Foreign Key ให้อัตโนมัติ (เทียบเท่า PRAGMA foreign_keys = ON)

DROP TRIGGER IF EXISTS trg_variant_insert_sync;
DROP TRIGGER IF EXISTS trg_variant_update_sync;
DROP TRIGGER IF EXISTS trg_variant_delete_sync;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS cookie_consents;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_counters;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------------
-- users : ลูกค้าและผู้ดูแลระบบ แยกสิทธิ์ด้วยคอลัมน์ role
-- password_hash = PBKDF2-SHA256 (100,000 รอบ) ของรหัสผ่าน + salt (เก็บเป็น hex)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  salt            TEXT    NOT NULL,
  full_name       TEXT    NOT NULL,
  phone           TEXT,
  role            TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  default_address TEXT,                                   -- JSON: {address_line, district, province, postal_code}
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- categories : หมวดหมู่หมวก (Caps, Bucket Hats, Beanies, Berets)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- products : ข้อมูลหลักของสินค้า
-- stock_quantity = ผลรวมสต็อกของทุก variant (อัปเดตอัตโนมัติด้วย trigger ด้านล่าง)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name           TEXT    NOT NULL,
  slug           TEXT    NOT NULL UNIQUE,
  description    TEXT    NOT NULL DEFAULT '',
  material       TEXT    NOT NULL DEFAULT '',
  base_price     REAL    NOT NULL CHECK (base_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url      TEXT    NOT NULL DEFAULT '',
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_category ON products(category_id);

-- ---------------------------------------------------------------------------
-- product_variants : ตัวเลือกสี x ขนาด ของแต่ละสินค้า (สต็อกจริงเก็บที่นี่)
-- CHECK (stock_quantity >= 0) คือด่านสุดท้ายกันขายเกินสต็อก:
--   ถ้าคำสั่ง UPDATE ทำให้สต็อกติดลบ ฐานข้อมูลจะปฏิเสธ และ batch ทั้งชุดจะ rollback
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name     TEXT    NOT NULL,
  color_hex      TEXT    NOT NULL,
  size           TEXT    NOT NULL,
  sku            TEXT    NOT NULL UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url      TEXT,                                    -- รูปเฉพาะสีนี้ (ใช้ตอนกด swatch เปลี่ยนสี)
  UNIQUE (product_id, color_name, size)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

-- Trigger: ทุกครั้งที่ variant เปลี่ยน ให้คำนวณสต็อกรวมของ products ใหม่
CREATE TRIGGER trg_variant_insert_sync AFTER INSERT ON product_variants
BEGIN
  UPDATE products SET stock_quantity =
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = NEW.product_id)
  WHERE id = NEW.product_id;
END;

CREATE TRIGGER trg_variant_update_sync AFTER UPDATE OF stock_quantity, product_id ON product_variants
BEGIN
  UPDATE products SET stock_quantity =
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = NEW.product_id)
  WHERE id = NEW.product_id;
END;

CREATE TRIGGER trg_variant_delete_sync AFTER DELETE ON product_variants
BEGIN
  UPDATE products SET stock_quantity =
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = OLD.product_id)
  WHERE id = OLD.product_id;
END;

-- ---------------------------------------------------------------------------
-- order_counters : ตัวนับเลขรันรายวัน ใช้สร้างเลขคำสั่งซื้อ KS + YYYYMMDD + 4 หลัก
-- เช่น KS202610010001 = ออเดอร์แรกของวันที่ 1 ต.ค. 2026
-- ---------------------------------------------------------------------------
CREATE TABLE order_counters (
  day_key  TEXT    PRIMARY KEY,                          -- 'YYYYMMDD' (เวลาไทย)
  last_seq INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- orders : หัวคำสั่งซื้อ (user_id เป็น NULL ได้ กรณีสั่งแบบไม่สมัครสมาชิก)
-- public_ref = รหัสสุ่มยาว ใช้เปิดหน้า order-success โดยไม่ต้องล็อกอิน
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT    NOT NULL UNIQUE,
  public_ref       TEXT    NOT NULL UNIQUE,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name    TEXT    NOT NULL,
  customer_email   TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  shipping_address TEXT    NOT NULL,                      -- JSON: {address_line, district, province, postal_code}
  subtotal         REAL    NOT NULL DEFAULT 0,
  shipping_fee     REAL    NOT NULL DEFAULT 0,
  total_amount     REAL    NOT NULL,
  payment_method   TEXT    NOT NULL CHECK (payment_method IN ('bank_transfer', 'promptpay', 'cod')),
  status           TEXT    NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Confirmed', 'Packing', 'Shipped', 'Completed', 'Cancelled')),
  tracking_number  TEXT,
  note             TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ---------------------------------------------------------------------------
-- order_items : รายการสินค้าในออเดอร์
-- เก็บ product_name และ price ณ วันที่สั่งไว้เสมอ ถึงแม้สินค้าจะถูกลบหรือเปลี่ยนราคาภายหลัง
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id   INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT    NOT NULL,
  variant_label TEXT   NOT NULL DEFAULT '',                -- เช่น 'Cobalt / M'
  price        REAL    NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_items_order ON order_items(order_id);

-- ---------------------------------------------------------------------------
-- order_status_history : ประวัติการเปลี่ยนสถานะ ใช้แสดง Timeline ติดตามพัสดุ
-- ---------------------------------------------------------------------------
CREATE TABLE order_status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL,
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_history_order ON order_status_history(order_id);

-- ---------------------------------------------------------------------------
-- cookie_consents : บันทึกการให้ความยินยอมคุกกี้ (หลักฐานตาม PDPA)
-- user_identifier = รหัสผู้เยี่ยมชมแบบสุ่ม (หรือ user:<id> ถ้าล็อกอินอยู่)
-- ---------------------------------------------------------------------------
CREATE TABLE cookie_consents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_identifier TEXT NOT NULL,
  consent_data    TEXT NOT NULL,                          -- JSON: {necessary, analytics, preferences, marketing, version}
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_consents_user ON cookie_consents(user_identifier);

-- ---------------------------------------------------------------------------
-- analytics_events : สถิติการเข้าชมหน้าเว็บ
-- บันทึกเฉพาะเมื่อผู้ใช้ "ยอมรับคุกกี้ Analytics" แล้วเท่านั้น (ตรวจทั้งฝั่งหน้าเว็บและฝั่ง API)
-- ---------------------------------------------------------------------------
CREATE TABLE analytics_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id   TEXT NOT NULL,
  event        TEXT NOT NULL,
  path         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- images : รูปสินค้าที่แอดมินอัปโหลดจากหน้าเว็บ (เก็บไฟล์เป็น BLOB ใน D1 เลย ไม่ต้องใช้ R2)
-- หน้าเว็บย่อรูปให้ด้านยาวไม่เกิน 1200px และบีบเป็น WebP/JPEG ก่อนส่ง จึงมีขนาดไม่เกิน 1.5MB
-- เรียกดูรูปผ่าน URL  /api/images/<id>  (เก็บ URL นี้ไว้ใน products.image_url / product_variants.image_url)
-- ---------------------------------------------------------------------------
CREATE TABLE images (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mime         TEXT    NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
  data         BLOB    NOT NULL,
  size_bytes   INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
