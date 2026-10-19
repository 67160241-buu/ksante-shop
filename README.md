# K'Sante Headwear : ร้านขายหมวกออนไลน์บน Cloudflare

เว็บขายหมวก 4 หมวดหมู่ (Caps, Bucket Hats, Beanies, Berets) ทำงานจริงทั้งระบบบน
**Cloudflare Pages + Pages Functions + D1** ไม่มีเซิร์ฟเวอร์ PHP/Apache/XAMPP

- หน้าเว็บ: HTML + Tailwind CSS (CDN) + JavaScript ล้วน (ไม่ต้อง build)
- API: Cloudflare Pages Functions (JavaScript รันบน Edge)
- ฐานข้อมูล: Cloudflare D1 (SQLite)
- ความปลอดภัย: รหัสผ่าน PBKDF2-SHA256 100,000 รอบ + salt, JWT (HS256) เก็บใน HTTP-only cookie
- PDPA: แบนเนอร์ขอความยินยอมคุกกี้ 3 ปุ่ม, ตั้งค่าแยกหมวด, ถอนความยินยอมได้ทุกเมื่อ

วิธีติดตั้งและขึ้นระบบจริงอยู่ใน **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## 1. บัญชีทดสอบ (จาก seed.sql)

| บทบาท | อีเมล | รหัสผ่าน | เข้าที่ |
|---|---|---|---|
| แอดมิน | admin@ksante.com | Admin@1234 | `/admin/login` |
| ลูกค้า | alex.chen@example.com | Customer@1234 | `/login` |

> เปลี่ยนรหัสผ่านแอดมินทันทีหลังขึ้นระบบจริง (ดู DEPLOYMENT.md ขั้นตอนที่ 9)

---

## 2. Database Design (Cloudflare D1)

```
users ─────────────┐ 1
  │ 1               │
  │                 ▼ n
  │              orders ──1──n── order_items ──n──1── product_variants ──n──1── products ──n──1── categories
  │                 │ 1                                      (สี x ไซซ์ + สต็อก)
  │                 └──n── order_status_history (Timeline)
  │
  └─(user:<id>)── cookie_consents        order_counters (เลขรันรายวัน)     analytics_events
```

| ตาราง | หน้าที่ | คอลัมน์สำคัญ |
|---|---|---|
| `users` | ลูกค้าและแอดมิน | email (unique), password_hash, salt, full_name, phone, **role** (`customer`/`admin`), default_address (JSON) |
| `categories` | หมวดหมู่หมวก | name, slug (unique) |
| `products` | สินค้าหลัก | category_id, name, slug, description, material, base_price, stock_quantity (ผลรวมอัตโนมัติ), image_url, is_active |
| `product_variants` | ตัวเลือกสี x ไซซ์ | product_id, color_name, color_hex, size (S/M/L/XL), sku (unique), stock_quantity **CHECK >= 0**, image_url |
| `orders` | หัวคำสั่งซื้อ | order_number (KS+วันที่+4 หลัก), public_ref, user_id (NULL = ไม่สมัครสมาชิก), customer_name/email, phone, shipping_address (JSON), subtotal, shipping_fee, total_amount, payment_method, status, tracking_number |
| `order_items` | สินค้าในออเดอร์ | order_id, product_id, variant_id, product_name, variant_label, price (ราคา ณ วันสั่ง), quantity |
| `order_status_history` | ประวัติสถานะ | order_id, status, note, created_at |
| `order_counters` | ตัวนับเลขออเดอร์ต่อวัน | day_key (YYYYMMDD ตามเวลาไทย), last_seq |
| `cookie_consents` | หลักฐานความยินยอม PDPA | user_identifier, consent_data (JSON), ip_address, created_at |
| `analytics_events` | สถิติการเข้าชม | บันทึก **เฉพาะ** เมื่อผู้ใช้ยอมรับคุกกี้ Analytics |

จุดที่ควรอธิบายตอนพรีเซนต์:

1. **กันขายเกินสต็อก (Atomic):** การสั่งซื้อทั้งหมด (ตัดสต็อก + สร้างออเดอร์ + รายการสินค้า + ประวัติ)
   ส่งเป็น `db.batch()` ซึ่ง D1 รันเป็น transaction เดียว ถ้าสต็อกตัวไหนติดลบ `CHECK (stock_quantity >= 0)`
   จะทำให้ทั้งชุด rollback ไม่มีออเดอร์ครึ่ง ๆ กลาง ๆ (ดู `functions/_lib/orders.js`)
2. **เลขคำสั่งซื้อ:** `order_counters` เพิ่มเลขด้วย UPSERT ใน batch เดียวกัน ได้ `KS202610190001`, `KS202610190002`, ...
3. **Trigger:** แก้สต็อก variant เมื่อไร `products.stock_quantity` จะคำนวณผลรวมใหม่ให้เอง
4. **ราคาในออเดอร์:** `order_items` เก็บชื่อและราคา ณ วันที่สั่ง ถึงสินค้าจะถูกแก้หรือลบภายหลังก็ไม่กระทบประวัติ

สถานะคำสั่งซื้อ: `Pending → Confirmed → Packing → Shipped → Completed` และ `Cancelled`
(เดินหน้าอย่างเดียว, Shipped ต้องมีเลขพัสดุ, ยกเลิกได้ก่อนส่งของและระบบคืนสต็อกให้อัตโนมัติ)

---

## 3. Project Structure

```
ksante-shop/
├── public/                       ← ไฟล์หน้าเว็บทั้งหมด (Cloudflare Pages อัปโหลดโฟลเดอร์นี้)
│   ├── index.html                หน้าแรก (Hero, หมวดหมู่, สินค้าใหม่)
│   ├── shop.html                 แคตตาล็อก + ค้นหา + ตัวกรอง หมวดหมู่/ไซซ์/สี/ราคา
│   ├── product-detail.html       รายละเอียด + Size Guide (ซม./นิ้ว) + ตารางสี + สต็อก
│   ├── cart.html                 ตะกร้า (มี Cart Drawer เลื่อนจากขวาทุกหน้าด้วย)
│   ├── checkout.html             ชำระเงิน: โอนธนาคาร / PromptPay QR / ปลายทาง
│   ├── order-success.html        ยืนยันคำสั่งซื้อ + QR PromptPay
│   ├── track-order.html          ติดตามพัสดุด้วยเลขออเดอร์ + อีเมลหรือเบอร์โทร
│   ├── login.html / register.html / profile.html
│   ├── privacy-policy.html / cookie-policy.html / 404.html
│   ├── admin/                    ← Admin Portal (ป้องกันด้วย functions/admin/_middleware.js)
│   │   ├── login.html  index.html (Dashboard)  products.html  product-form.html
│   │   ├── orders.html  inventory.html
│   ├── css/styles.css            micro-interactions (hover การ์ด, swatch, drawer, toast)
│   ├── img/                      favicon + รูปสำรองเมื่อโหลดรูปไม่ได้
│   └── js/
│       ├── config.js             ★ ข้อมูลร้าน บัญชีธนาคาร PromptPay ID (แก้ที่นี่)
│       ├── theme.js              สีแบรนด์ + ฟอนต์ + คลาส Tailwind ที่ใช้ร่วมกัน
│       ├── icons.js              ไอคอน Lucide แบบ inline
│       ├── app.js                ส่วนกลาง: header/footer, เรียก API, format เงิน/วันที่
│       ├── cart.js               ตะกร้า (localStorage) + Cart Drawer
│       ├── cookie.js             PDPA Cookie Consent
│       ├── promptpay.js          สร้าง QR PromptPay (EMVCo + CRC16)
│       ├── vendor/qrcode.js      ไลบรารีวาด QR (MIT)
│       ├── pages/                สคริปต์ของแต่ละหน้าร้าน
│       └── admin/                สคริปต์ของแต่ละหน้าแอดมิน
├── functions/                    ← Cloudflare Pages Functions (API บน Edge)
│   ├── _middleware.js            ทุกคำขอ: กัน cross-origin POST, แปลง error เป็น JSON, security headers
│   ├── _lib/                     โค้ดที่ใช้ร่วมกัน (ไม่ถูกเปิดเป็น URL)
│   │   ├── crypto.js             PBKDF2 + JWT
│   │   ├── auth.js               cookie session, requireCustomer, requireAdmin
│   │   ├── orders.js             คำนวณราคา, สร้างออเดอร์แบบ atomic, เปลี่ยนสถานะ
│   │   └── catalog.js  http.js  admin-products.js
│   ├── admin/_middleware.js      กันคนที่ไม่ใช่แอดมินเข้าหน้า /admin/*
│   └── api/
│       ├── auth/  products/  orders/  cart/  categories.js  consent.js  events.js
│       └── admin/                (มี _middleware.js ตรวจสิทธิ์แอดมินทุกเส้น)
├── schema.sql                    โครงสร้างตาราง D1
├── seed.sql                      ข้อมูลเริ่มต้น: 12 สินค้า, 128 ตัวเลือก, 8 ออเดอร์ตัวอย่าง, แอดมิน
├── wrangler.toml                 ตั้งค่า Pages + D1 binding
├── package.json                  คำสั่งลัด npm run ...
├── .dev.vars.example             ตัวอย่างค่าลับสำหรับรันในเครื่อง
├── tests/api-smoke.mjs           ทดสอบ API 51 ข้อ
└── tools/
    ├── gen_seed.py               สคริปต์ที่ใช้สร้าง seed.sql
    └── set-admin-password.mjs    เปลี่ยนรหัสผ่านแอดมิน
```

> ทำไม `admin/` อยู่ใน `public/admin/`? Cloudflare Pages เสิร์ฟไฟล์จากโฟลเดอร์ output (`public`) เท่านั้น
> จึงต้องวางหน้าแอดมินไว้ในนั้น แล้วใช้ `functions/admin/_middleware.js` ตรวจ cookie แอดมินก่อนส่งหน้าให้
> ลูกค้าหรือคนทั่วไปที่เปิด `/admin/...` จะถูกพาไปหน้า `/admin/login` ส่วน API `/api/admin/*` จะตอบ 401/403

---

## 4. User Flow

**ลูกค้า**

```
หน้าแรก → Shop (ค้นหา/กรอง) → รายละเอียดสินค้า (เลือกสี + ไซซ์, ดู Size Guide)
  → ใส่ตะกร้า (Drawer เลื่อนออกมา, ปรับ +/- ได้ไม่เกินสต็อก, แถบส่งฟรีเมื่อครบ ฿2,500)
  → Checkout (ชื่อ, เบอร์, ที่อยู่, วิธีชำระ) → [ระบบตัดสต็อกแบบ atomic + ออกเลข KS...]
  → Order Success (แสดง QR PromptPay / เลขบัญชี) → Track Order หรือ Profile > ประวัติคำสั่งซื้อ
```

- สั่งซื้อได้ทั้งแบบสมาชิกและไม่สมัครสมาชิก (สมาชิกเลือกบันทึกที่อยู่เป็นค่าเริ่มต้นได้)
- ยกเลิกเองได้จากหน้า Profile ขณะสถานะยังเป็น Pending

**แอดมิน**

```
/admin/login → Dashboard (ยอดขาย, จำนวนออเดอร์, สินค้า, สต็อกต่ำ ≤ 5, กราฟ 14 วัน)
  ├─ คำสั่งซื้อ: กรองตามสถานะ → เปิดรายละเอียด → เปลี่ยนสถานะ + ใส่เลขพัสดุ
  ├─ สินค้า: เพิ่ม/แก้/ลบ สินค้าและหมวดหมู่, สร้างตัวเลือกสี x ไซซ์
  └─ สต็อก: แก้หลายแถวพร้อมกัน, แถบสีเตือน (แดง = หมด, เหลือง = ใกล้หมด, เขียว = ปกติ)
```

**PDPA Cookie Consent**

```
เข้าเว็บครั้งแรก → แบนเนอร์ [ยอมรับทั้งหมด] [ปฏิเสธที่ไม่จำเป็น] [ตั้งค่าคุกกี้]
  → บันทึกตัวเลือก (localStorage + cookie ks_consent + บันทึกหลักฐานในตาราง cookie_consents)
  → ครั้งต่อไปไม่ถามซ้ำ → เปลี่ยนใจได้จากปุ่ม "ตั้งค่าคุกกี้" ที่ footer ทุกหน้า
```

| หมวด | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| Necessary | เปิดเสมอ | session ล็อกอิน, ตะกร้า, การตั้งค่าคุกกี้ |
| Analytics | ปิด | สถิติการเข้าชมหน้า (`ks_aid`) ฝั่ง API ตรวจ cookie ซ้ำก่อนบันทึก |
| Preferences | ปิด | จำตัวกรองล่าสุดและสินค้าที่ดูล่าสุด |
| Marketing | ปิด | จำแหล่งที่มา UTM ของแคมเปญ (`ks_utm`) |

เมื่อถอนความยินยอม ระบบลบข้อมูลของหมวดนั้นทิ้งทันที

---

## 5. API

| Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| POST | `/api/auth/register` | ทุกคน | สมัครสมาชิก (ล็อกอินให้ทันที) |
| POST | `/api/auth/login` · `/api/auth/logout` | ทุกคน | เข้า/ออกระบบลูกค้า |
| GET / PUT | `/api/auth/me` | ลูกค้า | ดู/แก้โปรไฟล์และที่อยู่เริ่มต้น |
| PUT | `/api/auth/password` | ลูกค้า | เปลี่ยนรหัสผ่าน |
| POST | `/api/auth/admin-login` · `/api/auth/admin-logout` | ทุกคน | เข้า/ออกระบบแอดมิน |
| GET | `/api/categories` | ทุกคน | หมวดหมู่ + จำนวนสินค้า |
| GET | `/api/products?q=&category=&size=&color=&min=&max=&in_stock=&sort=` | ทุกคน | ค้นหา/กรองสินค้า |
| GET | `/api/products/:slug` | ทุกคน | รายละเอียด + ตัวเลือก + สินค้าที่เกี่ยวข้อง |
| POST | `/api/cart/validate` | ทุกคน | ตรวจราคา/สต็อกตะกร้ากับฐานข้อมูล |
| POST | `/api/orders` | ทุกคน | สร้างคำสั่งซื้อ (ตัดสต็อกแบบ atomic) |
| GET | `/api/orders` | ลูกค้า | ประวัติคำสั่งซื้อของฉัน |
| GET | `/api/orders/:number` · POST `/api/orders/:number/cancel` | ลูกค้า | ดู/ยกเลิกออเดอร์ (เฉพาะ Pending) |
| GET | `/api/orders/ref/:ref` | ผู้มีลิงก์ | หน้า order-success |
| GET | `/api/orders/track?number=&contact=` | ทุกคน | ติดตามด้วยเลขออเดอร์ + อีเมล/เบอร์โทร |
| POST | `/api/consent` · `/api/events` | ทุกคน | บันทึกความยินยอม / สถิติ (ถ้ายินยอม) |
| GET | `/api/admin/me` · `/api/admin/metrics` | แอดมิน | ข้อมูลแอดมิน / ตัวเลข Dashboard |
| GET POST / PUT DELETE | `/api/admin/categories` · `/:id` | แอดมิน | CRUD หมวดหมู่ |
| GET POST / GET PUT DELETE | `/api/admin/products` · `/:id` | แอดมิน | CRUD สินค้า + ตัวเลือก |
| GET / PATCH | `/api/admin/inventory` | แอดมิน | ดู/แก้สต็อกหลายรายการ |
| PATCH | `/api/admin/variants/:id` | แอดมิน | ตั้งหรือปรับสต็อกตัวเลือกเดียว |
| GET | `/api/admin/orders?status=&q=&page=` | แอดมิน | รายการคำสั่งซื้อ |
| GET / PATCH | `/api/admin/orders/:id` | แอดมิน | รายละเอียด / เปลี่ยนสถานะ + เลขพัสดุ |

---

## 6. รันในเครื่องแบบเร็ว

```bash
npm install
cp .dev.vars.example .dev.vars        # แล้วแก้ JWT_SECRET เป็นค่าสุ่มยาว 32 ตัวขึ้นไป
npm run db:reset:local                 # สร้างตาราง + ใส่ข้อมูลตัวอย่างใน D1 จำลอง
npm run dev                            # เปิด http://127.0.0.1:8788
npm run test:api                       # (อีกหน้าต่าง) ทดสอบ API 51 ข้อ แล้วรัน db:reset:local ใหม่
```
