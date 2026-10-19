# คู่มือติดตั้งและ Deploy : K'Sante บน Cloudflare Pages + D1

คู่มือนี้พาทำทีละขั้น ตั้งแต่เครื่องเปล่าจนเว็บออนไลน์บนโดเมนของตัวเองพร้อม HTTPS

| ขั้น | เรื่อง | ใช้เวลาโดยประมาณ |
|---|---|---|
| 1 | เตรียมเครื่อง (Node.js) | 5 นาที |
| 2 | ติดตั้ง Wrangler CLI และล็อกอิน Cloudflare | 5 นาที |
| 3 | ทดสอบในเครื่อง | 5 นาที |
| 4 | สร้างและเชื่อม Cloudflare D1 | 5 นาที |
| 5 | สร้างตารางและข้อมูลบน D1 จริง | 2 นาที |
| 6 | Deploy (เลือกวิธี A: CLI หรือ B: Git + Dashboard) | 10 นาที |
| 7 | ตั้งค่า JWT_SECRET | 2 นาที |
| 8 | ผูก Custom Domain + SSL | 10 นาที ถึงหลายชั่วโมง (รอ DNS) |
| 9 | สิ่งที่ต้องทำก่อนเปิดร้านจริง | 10 นาที |

---

## ขั้นที่ 1 : เตรียมเครื่อง

1. ติดตั้ง **Node.js เวอร์ชัน 20 ขึ้นไป** (แนะนำรุ่น LTS) จาก https://nodejs.org
2. เปิด Terminal (Windows ใช้ PowerShell หรือ Command Prompt) แล้วตรวจสอบ:
   ```bash
   node --version     # ต้องได้ v20.x ขึ้นไป
   npm --version
   ```
3. สมัครบัญชี Cloudflare ฟรีที่ https://dash.cloudflare.com/sign-up
4. แตกไฟล์ `ksante-shop.zip` แล้วเข้าไปในโฟลเดอร์:
   ```bash
   cd ksante-shop
   ```

## ขั้นที่ 2 : ติดตั้ง Wrangler CLI และล็อกอิน

Wrangler คือเครื่องมือ command line ของ Cloudflare ในโปรเจกต์นี้ติดตั้งไว้ใน `package.json` แล้ว

```bash
npm install                 # ติดตั้ง wrangler ลงในโฟลเดอร์ node_modules
npx wrangler --version      # ตรวจว่าติดตั้งสำเร็จ (ได้เลขเวอร์ชัน 4.x)
npx wrangler login          # เปิดเบราว์เซอร์ให้กด "Allow" เพื่ออนุญาต
npx wrangler whoami         # ตรวจว่าล็อกอินแล้ว จะแสดงอีเมลและ Account ID
```

> ถ้า `npx wrangler login` เปิดเบราว์เซอร์ไม่ได้ (เช่นใช้เครื่องเซิร์ฟเวอร์) ให้คัดลอก URL ที่แสดงใน Terminal ไปเปิดเอง

## ขั้นที่ 3 : ทดสอบในเครื่อง (แนะนำให้ทำก่อน)

```bash
cp .dev.vars.example .dev.vars        # Windows: copy .dev.vars.example .dev.vars
```

เปิดไฟล์ `.dev.vars` แล้วเปลี่ยน `JWT_SECRET` เป็นค่าสุ่ม สร้างได้ด้วย:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

จากนั้น:

```bash
npm run db:reset:local    # สร้างตาราง + ข้อมูลตัวอย่างใน D1 จำลองบนเครื่อง (.wrangler/)
npm run dev               # เปิดเว็บที่ http://127.0.0.1:8788
```

- หน้าร้าน: http://127.0.0.1:8788
- หน้าแอดมิน: http://127.0.0.1:8788/admin/login (admin@ksante.com / Admin@1234)
- ทดสอบ API อัตโนมัติ (เปิดอีกหน้าต่างขณะ `npm run dev` ทำงาน): `npm run test:api` ควรได้ `51 passed, 0 failed`
  (สคริปต์นี้สร้างออเดอร์จริงในฐานข้อมูล ทดสอบเสร็จให้รัน `npm run db:reset:local` อีกครั้ง)

## ขั้นที่ 4 : สร้างและเชื่อม Cloudflare D1 Database

1. สร้างฐานข้อมูลบน Cloudflare:
   ```bash
   npx wrangler d1 create ksante-db
   ```
2. Terminal จะแสดงข้อมูลประมาณนี้:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "ksante-db"
   database_id = "a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```
   (Wrangler รุ่นใหม่อาจถามว่าจะเพิ่มลงไฟล์ config ให้เลยไหม ตอบได้ทั้งสองแบบ แต่ต้องตรวจข้อ 3 เสมอ)
3. เปิด `wrangler.toml` แล้วแก้ `database_id` ให้เป็นค่าที่ได้ และต้องมีบล็อก `[[d1_databases]]` **เพียงบล็อกเดียว** ที่ `binding = "DB"`
   ```toml
   [[d1_databases]]
   binding = "DB"                 # ชื่อนี้ต้องเป็น DB เพราะโค้ดเรียกใช้ env.DB
   database_name = "ksante-db"
   database_id = "a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

> `binding` คือชื่อตัวแปรที่โค้ดใน `functions/` ใช้เรียกฐานข้อมูล ส่วน `database_id` คือฐานข้อมูลตัวจริงบน Cloudflare

## ขั้นที่ 5 : สร้างตารางและข้อมูลบน D1 จริง

```bash
npm run db:init:remote    # = npx wrangler d1 execute ksante-db --remote --file=./schema.sql
npm run db:seed:remote    # = npx wrangler d1 execute ksante-db --remote --file=./seed.sql
```

ถ้า Wrangler ถามยืนยัน ให้ตอบ `y` แล้วตรวจผล:

```bash
npx wrangler d1 execute ksante-db --remote --command "SELECT COUNT(*) AS products FROM products"
# ควรได้ products = 12
```

> **คำเตือน:** `schema.sql` จะลบตารางเดิมทิ้งก่อนสร้างใหม่ ห้ามรันซ้ำบนระบบจริงหลังเปิดร้านแล้ว ข้อมูลออเดอร์จะหายทั้งหมด
>
> ดูข้อมูลผ่านหน้าเว็บได้ที่ Dashboard → **Storage & Databases → D1 SQL Database → ksante-db → Console**

## ขั้นที่ 6 : Deploy

เลือก **วิธีใดวิธีหนึ่ง**

> **สำคัญ:** อย่าใช้วิธีลากไฟล์ขึ้นหน้า Dashboard (Upload assets / drag & drop) เพราะวิธีนั้นไม่รวมโฟลเดอร์ `functions/`
> ทำให้ API, การล็อกอิน และการสั่งซื้อใช้ไม่ได้ ให้ใช้วิธี A หรือ B ด้านล่างเท่านั้น

### วิธี A : Deploy ด้วย Wrangler CLI (เร็วที่สุด)

```bash
npx wrangler pages project create ksante-shop --production-branch main
npm run deploy            # = npx wrangler pages deploy
```

- Wrangler อ่านค่าจาก `wrangler.toml` เอง (อัปโหลดโฟลเดอร์ `public/` + คอมไพล์ `functions/` + ผูก D1)
- เสร็จแล้วจะได้ URL เช่น `https://ksante-shop.pages.dev`
- ถ้าชื่อ `ksante-shop` ถูกใช้แล้ว ให้เปลี่ยน `name` ใน `wrangler.toml` และในคำสั่งด้านบนเป็นชื่ออื่น
- ครั้งต่อไปที่แก้โค้ด รัน `npm run deploy` ซ้ำได้เลย

ไปขั้นที่ 7 ต่อ

### วิธี B : Deploy ผ่าน Git + Cloudflare Dashboard (อัปเดตอัตโนมัติทุกครั้งที่ push)

1. สร้าง repository บน GitHub (หรือ GitLab) แล้ว push โค้ดขึ้นไป:
   ```bash
   git init
   git add .
   git commit -m "K'Sante shop"
   git branch -M main
   git remote add origin https://github.com/<ชื่อผู้ใช้>/ksante-shop.git
   git push -u origin main
   ```
   ไฟล์ `.gitignore` กันไม่ให้ `.dev.vars` (ค่าลับ), `.wrangler/` และ `node_modules/` ขึ้น Git อยู่แล้ว
   ก่อน push ให้ตรวจว่า `wrangler.toml` มี `database_id` จริงจากขั้นที่ 4 แล้ว
2. เข้า https://dash.cloudflare.com → **Workers & Pages** → **Create application**
3. เลือกแท็บ **Pages** → **Import an existing Git repository** (หรือ Connect to Git)
   (ถ้าหน้าจอแสดงแต่ Workers ให้มองหาลิงก์ "Looking to deploy Pages? Get started")
4. เชื่อมบัญชี GitHub แล้วเลือก repository `ksante-shop` → **Begin setup**
5. ตั้งค่า Build:
   | ช่อง | ค่า |
   |---|---|
   | Project name | `ksante-shop` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | (เว้นว่าง) |
   | Build output directory | `public` |
6. กด **Save and Deploy** รอจนขึ้น Success จะได้ URL `https://ksante-shop.pages.dev`
7. ตรวจ D1 binding: เข้าโปรเจกต์ → **Settings → Bindings** ต้องเห็น `DB → ksante-db`
   - เพราะมี `wrangler.toml` ในโปรเจกต์ Cloudflare จะใช้ไฟล์นี้เป็นตัวกำหนด binding (Dashboard จะแสดงว่าจัดการโดยไฟล์ config)
   - ถ้าไม่เห็น binding ให้ตรวจ `database_id` ใน `wrangler.toml` แล้ว push ใหม่
   - ถ้าเลือกลบบล็อก `[[d1_databases]]` ออกจากไฟล์ ก็เพิ่มเองได้ที่ **Settings → Bindings → Add → D1 database**
     ตั้ง Variable name = `DB` เลือก `ksante-db` แล้ว deploy ใหม่

หลังจากนี้ทุกครั้งที่ `git push` ไป branch `main` Cloudflare จะ deploy ให้อัตโนมัติ
(push ไป branch อื่นจะได้ Preview URL แยก)

## ขั้นที่ 7 : ตั้งค่า JWT_SECRET (บังคับ)

ระบบใช้ค่านี้เซ็น cookie ล็อกอิน ถ้าไม่ตั้ง การสมัคร/ล็อกอินจะแจ้งว่า "ระบบยังไม่ได้ตั้งค่า JWT_SECRET"

สร้างค่าสุ่มใหม่ (อย่าใช้ค่าเดียวกับ `.dev.vars`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**ผ่าน CLI:**

```bash
npx wrangler pages secret put JWT_SECRET --project-name ksante-shop
# วางค่าที่สุ่มได้ แล้วกด Enter
```

**หรือผ่าน Dashboard:** โปรเจกต์ → **Settings → Variables and Secrets → Add** → Type = **Secret**,
Name = `JWT_SECRET`, Value = ค่าที่สุ่มได้ → **Save** (ตั้งให้ Production และ Preview ถ้าใช้ทั้งคู่)

จากนั้น **deploy ใหม่หนึ่งครั้ง** เพื่อให้ค่ามีผล: วิธี A รัน `npm run deploy` อีกครั้ง /
วิธี B ไปที่ **Deployments** → เมนู ⋯ ของ deployment ล่าสุด → **Retry deployment**

**ทดสอบ:** เปิด `https://ksante-shop.pages.dev/admin/login` ล็อกอินด้วย admin@ksante.com / Admin@1234 ต้องเข้า Dashboard ได้

## ขั้นที่ 8 : ผูก Custom Domain พร้อม SSL

### 8.1 นำโดเมนเข้า Cloudflare (ถ้ายังไม่ได้ทำ)

1. Dashboard → **Add a domain** (หรือ Add a site) → ใส่โดเมน เช่น `ksante.shop` → เลือกแผน **Free**
2. Cloudflare จะสแกน DNS เดิมให้ ตรวจรายการแล้วกด Continue
3. Cloudflare แสดง **Nameserver 2 ตัว** (เช่น `xxx.ns.cloudflare.com`) ให้นำไปเปลี่ยนที่ผู้ให้บริการที่ซื้อโดเมน
   (GoDaddy, Namecheap, ผู้ให้บริการโดเมน .th ฯลฯ) แทนที่ nameserver เดิมทั้งหมด
4. รอจนสถานะโดเมนใน Cloudflare เป็น **Active** (ส่วนใหญ่ไม่เกิน 1 ชั่วโมง แต่อาจถึง 24 ชั่วโมง) Cloudflare จะส่งอีเมลแจ้ง

> ถ้าจะใช้แค่ subdomain (เช่น `shop.example.com`) และไม่ย้าย nameserver ก็ทำได้: เพิ่มโดเมนในขั้น 8.2 ก่อน
> แล้วไปสร้าง CNAME `shop` → `ksante-shop.pages.dev` ที่ผู้ให้บริการ DNS เดิม
> แต่ **โดเมนหลัก (apex เช่น `ksante.shop`) ต้องย้าย nameserver มา Cloudflare เท่านั้น**

### 8.2 ผูกโดเมนกับโปรเจกต์ Pages

1. **Workers & Pages** → เลือก `ksante-shop` → แท็บ **Custom domains** → **Set up a custom domain**
2. ใส่ `ksante.shop` (หรือ `www.ksante.shop` / `shop.ksante.shop`) → **Continue**
3. กด **Activate domain** Cloudflare จะสร้าง DNS record (CNAME) ให้อัตโนมัติ
   อย่าสร้าง CNAME เองล่วงหน้าก่อนขั้นนี้ ถ้ามี record ชื่อเดียวกันอยู่แล้วให้ลบก่อน
4. รอสถานะเป็น **Active** ระหว่างนี้ Cloudflare ออกใบรับรอง SSL ให้ฟรีอัตโนมัติ (มักไม่กี่นาที)
5. ต้องการทั้ง `ksante.shop` และ `www.ksante.shop` ให้ทำซ้ำข้อ 1-4 กับอีกชื่อ

### 8.3 ตั้งค่า SSL/TLS ให้ปลอดภัย

เข้าโดเมนใน Dashboard แล้วตั้งค่าดังนี้:

| เมนู | ตั้งค่า |
|---|---|
| **SSL/TLS → Overview** | Encryption mode = **Full (strict)** |
| **SSL/TLS → Edge Certificates** | **Always Use HTTPS** = On |
| | **Automatic HTTPS Rewrites** = On |
| | **Minimum TLS Version** = TLS 1.2 |
| | HSTS (ไม่บังคับ) เปิดเมื่อมั่นใจว่าใช้ HTTPS ทุก subdomain แล้วเท่านั้น |

> cookie ล็อกอินของระบบตั้ง `Secure` ไว้ จึงทำงานบน HTTPS เท่านั้น (ทั้ง `*.pages.dev` และโดเมนของคุณเป็น HTTPS อยู่แล้ว)

**ทดสอบ:** เปิด `https://ksante.shop` ต้องเห็นรูปแม่กุญแจ และลองเปิด `http://ksante.shop` ต้องถูกพาไป `https://` เอง

## ขั้นที่ 9 : ก่อนเปิดร้านจริง

### 9.1 เปลี่ยนรหัสผ่านแอดมิน (สำคัญมาก)

รหัส `Admin@1234` อยู่ในไฟล์ที่เปิดเผย ต้องเปลี่ยนทันที:

```bash
node tools/set-admin-password.mjs admin@ksante.com "รหัสใหม่ที่ยาวและเดายาก2026"
npx wrangler d1 execute ksante-db --remote --file=./admin-password.sql
```

แล้วลบไฟล์ `admin-password.sql` ทิ้ง (ไฟล์นี้อยู่ใน `.gitignore` แล้ว)

ต้องการเปลี่ยนอีเมลแอดมินด้วย:

```bash
npx wrangler d1 execute ksante-db --remote --command "UPDATE users SET email = 'owner@ksante.shop' WHERE email = 'admin@ksante.com'"
```

### 9.2 ใส่ข้อมูลร้าน บัญชีธนาคาร และ PromptPay

แก้ไฟล์ `public/js/config.js`:

```js
email: 'hello@ksante.com', phone: '02-000-0000', address: '...',   // ข้อมูลติดต่อที่แสดงใน footer
bank: { name: 'ธนาคาร...', accountName: 'ชื่อบัญชีจริง', accountNo: 'xxx-x-xxxxx-x' },
promptpayId: '0812345678',   // เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก
```

- ถ้า `promptpayId` ว่าง หน้าชำระเงินจะแสดง **QR สาธิต** ที่มีป้ายบอกชัดเจนว่าใช้จ่ายจริงไม่ได้
- ใส่ค่าแล้ว ระบบสร้าง QR PromptPay ตามมาตรฐาน EMVCo พร้อมยอดเงินของออเดอร์นั้น
- ระบบไม่ได้เชื่อมธนาคารอัตโนมัติ แอดมินต้องตรวจยอดเงินเข้าเองแล้วเปลี่ยนสถานะเป็น Confirmed

ค่าส่งและยอดส่งฟรี: แก้ `SHIPPING_FEE` และ `FREE_SHIPPING_THRESHOLD` ใน `wrangler.toml`
และ `shippingFee` / `freeShippingThreshold` ใน `config.js` ให้ตรงกัน (ฝั่งเซิร์ฟเวอร์เป็นตัวคิดเงินจริง)

แก้เสร็จแล้ว deploy ใหม่ (`npm run deploy` หรือ `git push`)

### 9.3 ลบข้อมูลตัวอย่าง (ไม่บังคับ)

seed.sql มีลูกค้าตัวอย่างและออเดอร์ตัวอย่าง 8 รายการไว้สาธิต ถ้าจะเปิดร้านจริงให้ลบ:

```bash
npx wrangler d1 execute ksante-db --remote --command "DELETE FROM orders; DELETE FROM order_counters; DELETE FROM users WHERE role = 'customer'; DELETE FROM analytics_events; DELETE FROM cookie_consents;"
```

(`order_items` และ `order_status_history` ถูกลบตามอัตโนมัติ)

### 9.4 ข้อความนโยบาย

ตรวจและแก้ชื่อบริษัท ที่อยู่ และช่องทางติดต่อ (อีเมล @ksante.com ในไฟล์เป็นตัวอย่าง) ใน `public/privacy-policy.html` และ `public/cookie-policy.html`
ให้ตรงกับร้านจริงก่อนเปิดให้บริการ

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ล็อกอินแล้วขึ้น "ระบบยังไม่ได้ตั้งค่า JWT_SECRET" | ยังไม่ได้ทำขั้นที่ 7 หรือตั้งแล้วแต่ยังไม่ deploy ใหม่ |
| API ตอบ `no such table: products` | ยังไม่ได้รัน `npm run db:init:remote` และ `db:seed:remote` (ขั้นที่ 5) หรือลืมใส่ `--remote` |
| API ตอบ error เกี่ยวกับ `DB` / `undefined` | ไม่มี D1 binding ตรวจ `wrangler.toml` และ Settings → Bindings (ขั้นที่ 4 / 6B ข้อ 7) |
| หน้าเว็บขึ้นแต่ API 404 ทั้งหมด | deploy ด้วยการลากไฟล์ขึ้น Dashboard ให้ใช้วิธี A หรือ B แทน |
| ล็อกอินสำเร็จแต่รีเฟรชแล้วหลุด | เปิดเว็บผ่าน `http://` cookie แบบ Secure ใช้ไม่ได้ เปิด Always Use HTTPS (ขั้น 8.3) |
| เรียก API จากเว็บอื่นได้ 403 | ตั้งใจไว้: ระบบกันคำขอแบบ POST/PUT/DELETE ที่มาจากโดเมนอื่น (ป้องกัน CSRF) |
| Custom domain ค้างที่ Pending / Verifying | ตรวจว่าโดเมนเป็น Active ใน Cloudflare แล้ว และไม่มี DNS record ชื่อซ้ำ รอ DNS อัปเดต |
| รูปสินค้าไม่ขึ้น | รูปมาจาก images.unsplash.com ถ้าเครือข่ายบล็อก ระบบจะแสดงรูปหมวกสำรองแทน เปลี่ยน URL รูปได้ในหน้าแอดมิน → สินค้า |

ดู log ของ Functions แบบสด: `npx wrangler pages deployment tail --project-name ksante-shop`

## สคริปต์ลัด (package.json)

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บในเครื่องที่ http://127.0.0.1:8788 |
| `npm run db:reset:local` | ล้างและสร้างฐานข้อมูลจำลองในเครื่องใหม่ |
| `npm run db:init:remote` / `db:seed:remote` | สร้างตาราง / ใส่ข้อมูลตัวอย่าง บน D1 จริง |
| `npm run test:api` | ทดสอบ API 51 ข้อ (ขณะรัน `npm run dev`) |
| `npm run deploy` | deploy ขึ้น Cloudflare Pages |
