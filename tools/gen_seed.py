"""Generate ksante-shop/seed.sql (deterministic). Run: python3 gen_seed.py <out>"""
import hashlib, json, random, sys, uuid

OUT = sys.argv[1]
rnd = random.Random(20261019)

def U(i, w=900):
    return f"https://images.unsplash.com/{i}?auto=format&fit=crop&w={w}&q=80"

P = dict(
  capCobalt='photo-1517941823-815bea90d291', capOnyx='photo-1620327467532-6ebaca6273ed',
  capChalk='photo-1588850561407-ed78c282e89b', capSand='photo-1720534490358-bc2ad29d51d5',
  capMustard='photo-1645266729222-17cd32e06fd0', capTangerine='photo-1466992133056-ae8de8e22809',
  capOlive='photo-1560774358-d727658f457c',
  bucketCobalt='photo-1627691541764-85b6e9003bec', bucketGreen='photo-1627681828965-048a32cdf16f',
  bucketSand='photo-1627683566270-bf7e75dfec0a', bucketBrown='photo-1617916918894-7bc1ea780bb2',
  bucketOnyx='photo-1600074178688-c7a0a748a3e1', bucketChalk='photo-1622445275576-721325763afe',
  bucketModel='photo-1648422204972-4278784a9863',
  beanieOnyx='photo-1618354691792-d1d42acfd860', beanieTangerine='photo-1511500118080-275313ec90a1',
  beanieCobalt='photo-1648483092137-6e63796c8b06', beanieSage='photo-1510598969022-c4c6c5d05769',
  beanieMustard='photo-1576529598261-96e376f6aabb', beanieChalk='photo-1630691650107-53dd500d2907',
  beretRed='photo-1778865575946-4d26642a0323', beretModel='photo-1775203329269-10933645cac3',
  beretMustard='photo-1758887249062-9a544a74aa29', beretOnyx='photo-1642795752867-37df82428008',
  beretChalk='photo-1713952704614-76630700a4b4', beretStreet='photo-1645622879475-f60d3a331c99',
)
COLORS = dict(cobalt=('Cobalt', '#1D4ED8'), tangerine=('Tangerine', '#F97316'), sage=('Sage', '#10B981'),
              mustard=('Mustard', '#F59E0B'), onyx=('Onyx', '#1F2937'), olive=('Olive', '#5E6B34'),
              sand=('Sand', '#D8C7A3'), chalk=('Chalk', '#ECEAE2'))
SIZES = ['S', 'M', 'L', 'XL']
CATS = [(1, 'Caps', 'caps', 'CAP'), (2, 'Bucket Hats', 'bucket-hats', 'BKT'), (3, 'Beanies', 'beanies', 'BNE'), (4, 'Berets', 'berets', 'BRT')]
CODE = {c[0]: c[3] for c in CATS}

# (id, cat, name, material, price, colors {key: photo}, description)
PRODUCTS = [
 (1, 1, 'Everyday Twill Cap', 'Heavyweight cotton twill 380g', 1290, dict(cobalt='capCobalt', onyx='capOnyx', sand='capSand'),
  'หมวกแก๊ป 6 แผงรุ่นซิกเนเจอร์ ผ้าทวิลคอตตอนหนา 380 แกรม ทรง Unstructured ปีกโค้งพร้อมใส่ สายปรับหัวเข็มขัดสแตนเลส ยิ่งใส่ยิ่งนุ่ม'),
 (2, 1, 'Cord Six-Panel Cap', 'Wide-wale corduroy', 1390, dict(tangerine='capTangerine', olive='capOlive', onyx='capOnyx'),
  'หมวกแก๊ปผ้าลูกฟูกร่องใหญ่ ทรงโปรไฟล์ต่ำแบบ Structured ปักโลโก้โทนเดียวกันด้านหลัง แถบซับเหงื่อคอตตอนคงรูปทรง'),
 (3, 1, 'Nylon Runner Cap', 'Recycled nylon', 1190, dict(mustard='capMustard', cobalt='capCobalt', chalk='capChalk'),
  'หมวกวิ่งผ้าไนลอนรีไซเคิล น้ำหนักเพียง 48 กรัม เจาะรูระบายอากาศด้วยเลเซอร์ ปีกพับได้ แห้งไวภายในไม่กี่นาที'),
 (4, 2, 'Tactile Ripstop Bucket', 'Technical ripstop', 1490, dict(tangerine='bucketBrown', olive='bucketGreen', onyx='bucketOnyx'),
  'หมวกบักเก็ตผ้า Ripstop กันละอองน้ำ ปีกเย็บเสริมหลายแนวคงทรงสวย ตาไก่ทองเหลืองระบายอากาศ 2 จุด พร้อมช่องซ่อนกุญแจ'),
 (5, 2, 'Corduroy Bucket', 'Wide-wale corduroy', 1590, dict(sage='bucketGreen', sand='bucketSand', cobalt='bucketCobalt'),
  'หมวกบักเก็ตผ้าลูกฟูกเนื้อนุ่ม ทรงลึก ปีกลาดเล็กน้อยแบบวินเทจ ซับในผ้าป็อปลินคอตตอนพิมพ์ลาย'),
 (6, 2, 'Reversible Terry Bucket', 'Cotton terry / twill', 1690, dict(chalk='bucketChalk', mustard='bucketModel'),
  'หมวกบักเก็ตใส่ได้ 2 ด้าน ด้านหนึ่งผ้าขนหนู Terry อีกด้านผ้าทวิลเรียบ เหมาะกับทะเล ซักเครื่องได้ที่ 30 องศา'),
 (7, 3, 'Heavy Rib Beanie', 'Extra-fine merino wool', 890, dict(onyx='beanieOnyx', tangerine='beanieTangerine', cobalt='beanieCobalt'),
  'บีนนี่ถักลาย Rib 2x2 แน่นหนา ขนแกะเมอริโนเกรดพิเศษ พับขอบ 2 ชั้น ระบายอากาศดี ไม่คัน อุ่นโดยไม่หนาเทอะทะ'),
 (8, 3, 'Fisherman Beanie', 'Ribbed merino wool', 790, dict(sage='beanieSage', mustard='beanieMustard', chalk='beanieChalk'),
  'บีนนี่ทรงสั้นแบบชาวประมง ใส่แล้วอยู่เหนือหู ถักลาย Rib ผ้าเมอริโน พร้อมป้ายทอ K\'Sante'),
 (9, 3, 'Mohair Fuzz Beanie', 'Mohair blend', 1090, dict(cobalt='beanieCobalt', chalk='beanieChalk'),
  'บีนนี่ไหมพรมผสมโมแฮร์ ผิวฟูนุ่มเหมือนก้อนเมฆ ทรงหลวมสบาย พับขอบ น้ำหนักเบามาก'),
 (10, 4, 'Atelier Wool Beret', 'Boiled wool felt', 1290, dict(onyx='beretOnyx', tangerine='beretRed', cobalt='beretStreet'),
  'เบเร่ต์ผ้าสักหลาดขนแกะแบบคลาสสิก ขอบหุ้มหนังแท้ มีจุกด้านบนแบบฝรั่งเศส ใส่ไปสักสัปดาห์จะเข้ารูปศีรษะเอง'),
 (11, 4, 'Knit Beret', 'Soft merino knit', 990, dict(mustard='beretMustard', sage='beretModel'),
  'เบเร่ต์ถักไหมพรมเมอริโนนุ่ม ถักแบนแล้วขึ้นรูปด้วยมือ ใส่เอียงข้างหรือดึงไปด้านหลังก็สวย'),
 (12, 4, 'Leather Trim Beret', 'Wool felt with leather trim', 1890, dict(sand='beretChalk', onyx='beretOnyx'),
  'เบเร่ต์สักหลาดรุ่นพรีเมียม ขอบหนังวัวแท้ เย็บมือ ผลิตจำนวนจำกัด'),
]

def slug(s):
    import re
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def q(v):
    if v is None: return 'NULL'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def pbkdf2(pw, salt_hex):
    return hashlib.pbkdf2_hmac('sha256', pw.encode(), bytes.fromhex(salt_hex), 100000, 32).hex()

out = ["-- ============================================================================",
       "-- K'Sante Headwear : ข้อมูลเริ่มต้น (สร้างอัตโนมัติจาก tools/gen_seed.py)",
       "-- รันหลัง schema.sql:  npx wrangler d1 execute ksante-db --remote --file=./seed.sql",
       "-- บัญชีทดสอบ:",
       "--   Admin    : admin@ksante.com       / Admin@1234",
       "--   Customer : alex.chen@example.com  / Customer@1234",
       "-- ============================================================================", ""]

# users
users = [(1, 'admin@ksante.com', 'Admin@1234', "K'Sante Admin", '020000000', 'admin', None),
         (2, 'alex.chen@example.com', 'Customer@1234', 'Alex Chen', '0812345678', 'customer',
          dict(address_line='88/12 ซอยสุขุมวิท 31 แขวงคลองเตยเหนือ', district='วัฒนา', province='กรุงเทพมหานคร', postal_code='10110'))]
out.append('-- ผู้ใช้ (รหัสผ่านถูก hash ด้วย PBKDF2-SHA256 100,000 รอบ)')
for uid, email, pw, name, phone, role, addr in users:
    salt = hashlib.sha256(f'ksante-salt-{email}'.encode()).hexdigest()[:32]
    out.append(f"INSERT INTO users (id, email, password_hash, salt, full_name, phone, role, default_address, created_at) VALUES "
               f"({uid}, {q(email)}, {q(pbkdf2(pw, salt))}, {q(salt)}, {q(name)}, {q(phone)}, {q(role)}, {q(json.dumps(addr, ensure_ascii=False) if addr else None)}, datetime('now', '-60 days'));")
out.append('')
out.append('-- หมวดหมู่')
for cid, name, s, _ in CATS:
    out.append(f"INSERT INTO categories (id, name, slug) VALUES ({cid}, {q(name)}, {q(s)});")
out.append('')

variants = []  # (id, pid, ckey, size, stock)
out.append('-- สินค้า 12 รายการ (stock_quantity ของสินค้าจะถูกคำนวณจาก variant โดย trigger)')
for pid, cid, name, mat, price, cols, desc in PRODUCTS:
    first = next(iter(cols.values()))
    out.append(f"INSERT INTO products (id, category_id, name, slug, description, material, base_price, stock_quantity, image_url, is_active, created_at) VALUES "
               f"({pid}, {cid}, {q(name)}, {q(slug(name))}, {q(desc)}, {q(mat)}, {price}, 0, {q(U(P[first]))}, 1, datetime('now', '-{90 - pid * 5} days'));")
out.append('')
out.append('-- ตัวเลือกสี x ขนาด พร้อมสต็อก (บางรายการตั้งใจให้ใกล้หมดหรือหมด เพื่อสาธิตแถบเตือน)')
vid = 0
for pid, cid, name, mat, price, cols, desc in PRODUCTS:
    for ckey, photo in cols.items():
        for size in SIZES:
            vid += 1
            r = rnd.random()
            stock = 0 if r < 0.05 else rnd.randint(1, 5) if r < 0.16 else rnd.randint(8, 40)
            cname, chex = COLORS[ckey]
            sku = f"{CODE[cid]}-P{pid:02d}-{cname[:3].upper()}-{size}"
            variants.append((vid, pid, ckey, size, stock, price, name, cname))
            out.append(f"INSERT INTO product_variants (id, product_id, color_name, color_hex, size, sku, stock_quantity, image_url) VALUES "
                       f"({vid}, {pid}, {q(cname)}, {q(chex)}, {q(size)}, {q(sku)}, {stock}, {q(U(P[photo]))});")
out.append('')

# ตัวอย่างออเดอร์
addr_alex = users[1][6]
guests = [('Pim Suwan', 'pim.s@example.com', '0891112222', dict(address_line='19 ถนนนิมมานเหมินท์ ซอย 7', district='เมืองเชียงใหม่', province='เชียงใหม่', postal_code='50200')),
          ('Krit Thana', 'krit.t@example.com', '0865554444', dict(address_line='240 ถนนมิตรภาพ', district='เมืองขอนแก่น', province='ขอนแก่น', postal_code='40000')),
          ('Nina Park', 'nina.p@example.com', '0957778888', dict(address_line='5/9 หมู่ 3 ถนนเทพกระษัตรี', district='ถลาง', province='ภูเก็ต', postal_code='83110'))]
FLOW = ['Pending', 'Confirmed', 'Packing', 'Shipped', 'Completed']
plan = [  # (days_ago, user?, guest_idx, status, payment)
  (21, True, None, 'Completed', 'promptpay'), (16, False, 0, 'Completed', 'bank_transfer'), (12, True, None, 'Shipped', 'cod'),
  (9, False, 1, 'Cancelled', 'promptpay'), (6, False, 2, 'Packing', 'bank_transfer'), (4, True, None, 'Confirmed', 'promptpay'),
  (2, False, 0, 'Pending', 'cod'), (1, True, None, 'Pending', 'bank_transfer')]
out.append('-- ตัวอย่างคำสั่งซื้อ (วันที่อ้างอิงจากวันที่รัน seed) และตัวนับเลขรันรายวัน')
for oid, (days, is_user, gi, status, pay) in enumerate(plan, start=1):
    # วันที่ของออเดอร์ตามเวลาไทย (+7 ชม.) ใช้ประกอบเลขคำสั่งซื้อ
    day_expr = f"strftime('%Y%m%d', datetime('now', '-{days} days', '+7 hours'))"
    if is_user:
        name, email, phone, addr, uid = 'Alex Chen', 'alex.chen@example.com', '0812345678', addr_alex, 2
    else:
        name, email, phone, addr = guests[gi]; uid = None
    picks = rnd.sample([v for v in variants if v[4] > 0], rnd.randint(1, 3))
    items = [(v, rnd.randint(1, 2)) for v in picks]
    subtotal = sum(v[5] * n for v, n in items)
    fee = 0 if subtotal >= 2500 else 60
    tracking = f"TH{rnd.randint(10**10, 10**11 - 1)}" if status in ('Shipped', 'Completed') else None
    ref = str(uuid.UUID(int=rnd.getrandbits(128)))
    out.append(f"INSERT INTO order_counters (day_key, last_seq) VALUES ({day_expr}, 1) ON CONFLICT(day_key) DO UPDATE SET last_seq = last_seq + 1;")
    out.append(f"INSERT INTO orders (id, order_number, public_ref, user_id, customer_name, customer_email, phone, shipping_address, subtotal, shipping_fee, total_amount, payment_method, status, tracking_number, created_at, updated_at) VALUES "
               f"({oid}, 'KS' || {day_expr} || printf('%04d', (SELECT last_seq FROM order_counters WHERE day_key = {day_expr})), {q(ref)}, {q(uid)}, {q(name)}, {q(email)}, {q(phone)}, "
               f"{q(json.dumps(addr, ensure_ascii=False))}, {subtotal}, {fee}, {subtotal + fee}, {q(pay)}, {q(status)}, {q(tracking)}, datetime('now', '-{days} days'), datetime('now', '-{days} days', '+{6 if status != 'Pending' else 0} hours'));")
    for v, n in items:
        out.append(f"INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, price, quantity) VALUES "
                   f"({oid}, {v[1]}, {v[0]}, {q(v[6])}, {q(v[7] + ' / ' + v[3])}, {v[5]}, {n});")
    steps = ['Pending', 'Cancelled'] if status == 'Cancelled' else FLOW[:FLOW.index(status) + 1]
    for i, st in enumerate(steps):
        note = {'Pending': 'รับคำสั่งซื้อแล้ว', 'Confirmed': 'ยืนยันการชำระเงินแล้ว', 'Packing': 'กำลังแพ็กสินค้า',
                'Shipped': f'ส่งพัสดุแล้ว เลขพัสดุ {tracking}', 'Completed': 'ลูกค้าได้รับสินค้าแล้ว', 'Cancelled': 'ยกเลิกตามคำขอของลูกค้า คืนสต็อกแล้ว'}[st]
        out.append(f"INSERT INTO order_status_history (order_id, status, note, created_at) VALUES ({oid}, {q(st)}, {q(note)}, datetime('now', '-{days} days', '+{i * 20} hours'));")
out.append('')
open(OUT, 'w').write('\n'.join(out) + '\n')
print('variants', vid, 'orders', len(plan))
