// ============================================================================
// ทดสอบ API แบบ end-to-end (รันขณะเปิด npx wrangler pages dev อยู่)
//   node tests/api-smoke.mjs http://127.0.0.1:8788
// ควรรันกับฐานข้อมูลที่เพิ่ง seed ใหม่ (สคริปต์นี้สร้างออเดอร์และแก้สต็อกจริง)
// ============================================================================
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};

/** client ง่าย ๆ ที่จำ cookie ไว้ เหมือนเบราว์เซอร์ */
function client() {
  const jar = new Map();
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';'); const [k, ...v] = kv.split('=');
      if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v.join('='));
    }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text(), jar };
  };
}

const guest = client();
const cust = client();
const admin = client();

console.log('Catalog');
let r = await guest('GET', '/api/products');
check('list 12 products', r.data.products?.length === 12, r.status);
r = await guest('GET', '/api/products?category=beanies');
check('filter by category', r.data.products.length === 3 && r.data.products.every(p => p.category.slug === 'beanies'));
r = await guest('GET', '/api/products?color=Cobalt&size=XL');
check('filter by color+size', r.data.products.length > 0 && r.data.products.every(p => p.colors.some(c => c.name === 'Cobalt')));
r = await guest('GET', '/api/products?q=beret');
check('search by name', r.data.products.length === 3, r.data.products.map(p => p.name));
r = await guest('GET', '/api/products?sort=price-desc');
check('sort price desc', r.data.products[0].price >= r.data.products[11].price);
r = await guest('GET', '/api/products/everyday-twill-cap');
check('product detail', r.data.product?.variants?.length === 12 && r.data.related.length === 2);
const cap = r.data.product;
r = await guest('GET', '/api/products/does-not-exist');
check('404 unknown product', r.status === 404);

console.log('Auth');
const email = `test${Date.now()}@example.com`;
r = await cust('POST', '/api/auth/register', { full_name: 'Test User', email, phone: '0899999999', password: 'short' });
check('weak password rejected', r.status === 422);
r = await cust('POST', '/api/auth/register', { full_name: 'Test User', email, phone: '0899999999', password: 'Passw0rd!' });
check('register', r.status === 201 && r.jar.has('ks_session'), JSON.stringify(r.data));
check('cookie HttpOnly+Secure', /HttpOnly/.test(r.headers.get('set-cookie')) && /Secure/.test(r.headers.get('set-cookie')));
r = await cust('POST', '/api/auth/register', { full_name: 'Again', email, password: 'Passw0rd!' });
check('duplicate email 409', r.status === 409);
r = await cust('GET', '/api/auth/me');
check('me returns user', r.data.user?.email === email && !('password_hash' in r.data.user));
r = await cust('PUT', '/api/auth/me', { full_name: 'Test Updated', phone: '0811111111', default_address: { address_line: '1 ถนนสีลม', district: 'บางรัก', province: 'กรุงเทพมหานคร', postal_code: '10500' } });
check('update profile + address', r.data.user?.default_address?.postal_code === '10500');
r = await guest('POST', '/api/auth/login', { email: 'admin@ksante.com', password: 'Admin@1234' });
check('admin cannot use customer login', r.status === 403);
r = await guest('POST', '/api/auth/login', { email, password: 'wrong-pass1' });
check('wrong password 401', r.status === 401);

console.log('Cart & orders');
const v = cap.variants.find(x => x.stock > 2);
r = await guest('POST', '/api/cart/validate', { items: [{ variant_id: v.id, quantity: v.stock + 5 }] });
check('cart validate flags overstock', r.data.problems?.length === 1 && r.data.problems[0].available === v.stock);
const addr = { address_line: '99 ถนนพระราม 9', district: 'ห้วยขวาง', province: 'กรุงเทพมหานคร', postal_code: '10310' };
const orderBody = q => ({ items: [{ variant_id: v.id, quantity: q }], customer_name: 'Test User', customer_email: email, phone: '0899999999', shipping_address: addr, payment_method: 'promptpay' });
r = await cust('POST', '/api/orders', orderBody(v.stock + 1));
check('overstock order rejected 409', r.status === 409);
r = await cust('POST', '/api/orders', orderBody(2));
check('order created', r.status === 201 && /^KS\d{12}$/.test(r.data.order?.order_number), JSON.stringify(r.data).slice(0, 300));
const order = r.data.order;
r = await guest('GET', '/api/products/everyday-twill-cap');
check('stock deducted', r.data.product.variants.find(x => x.id === v.id).stock === v.stock - 2);
r = await guest('POST', '/api/orders', { ...orderBody(1), payment_method: 'cod', customer_email: 'guest@example.com' });
check('guest order + COD fee', r.status === 201 && r.data.order.user_id === null && r.data.order.shipping_fee >= 30);
const seq = [order.order_number, r.data.order.order_number].map(n => Number(n.slice(-4)));
check('running number increments', seq[1] === seq[0] + 1, seq);
r = await cust('GET', '/api/orders');
check('order history', r.data.orders?.length === 1 && r.data.orders[0].items.length === 1);
r = await guest('GET', `/api/orders/ref/${order.public_ref}`);
check('order by ref', r.data.order?.order_number === order.order_number);
r = await guest('GET', `/api/orders/track?number=${order.order_number}&contact=0899999999`);
check('track by phone', r.data.order?.history?.length === 1 && !r.data.order.shipping_address.address_line);
r = await guest('GET', `/api/orders/track?number=${order.order_number}&contact=nobody@example.com`);
check('track wrong contact 404', r.status === 404);
r = await guest('GET', `/api/orders/${order.order_number}`);
check('history needs login', r.status === 401);

console.log('Admin');
r = await cust('GET', '/api/admin/metrics');
check('customer blocked from admin API', r.status === 401);
r = await cust('GET', '/admin/');
check('customer redirected from /admin/', r.status === 302 && /\/admin\/login/.test(r.headers.get('location')));
r = await admin('POST', '/api/auth/admin-login', { email, password: 'Passw0rd!' });
check('customer cannot admin-login', r.status === 401);
r = await admin('POST', '/api/auth/admin-login', { email: 'admin@ksante.com', password: 'Admin@1234' });
check('admin login', r.status === 200 && r.jar.has('ks_admin'));
r = await admin('GET', '/admin/');
check('admin page served', r.status === 200);
r = await admin('GET', '/api/admin/metrics');
check('metrics', r.data.orders >= 10 && typeof r.data.revenue === 'number' && r.data.low_stock_threshold === 5, JSON.stringify(r.data).slice(0, 200));
r = await admin('PATCH', `/api/admin/orders/${order.id}`, { status: 'Shipped' });
check('Shipped needs tracking', r.status === 422);
r = await admin('PATCH', `/api/admin/orders/${order.id}`, { status: 'Shipped', tracking_number: 'th1234567890' });
check('status -> Shipped', r.data.order?.status === 'Shipped' && r.data.order.tracking_number === 'TH1234567890');
r = await admin('PATCH', `/api/admin/orders/${order.id}`, { status: 'Pending' });
check('cannot go backwards', r.status === 409);
r = await admin('PATCH', `/api/admin/orders/${order.id}`, { status: 'Cancelled' });
check('cannot cancel after shipping', r.status === 409);
r = await admin('GET', '/api/admin/orders?status=Shipped');
check('filter orders by status', r.data.orders.every(o => o.status === 'Shipped') && r.data.orders.length >= 1);

// ลูกค้ายกเลิก -> คืนสต็อก
const before = (await guest('GET', '/api/products/everyday-twill-cap')).data.product.variants.find(x => x.id === v.id).stock;
r = await cust('POST', '/api/orders', orderBody(1));
const o2 = r.data.order;
r = await cust('POST', `/api/orders/${o2.order_number}/cancel`);
check('customer cancel pending', r.data.order?.status === 'Cancelled');
const after = (await guest('GET', '/api/products/everyday-twill-cap')).data.product.variants.find(x => x.id === v.id).stock;
check('cancel restores stock', after === before, `${before} -> ${after}`);

// Product CRUD
const newProduct = {
  category_id: 1, name: 'Test Studio Cap', description: 'ทดสอบ', material: 'Cotton', base_price: 999,
  image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900', is_active: true,
  variants: [{ color_name: 'Cobalt', color_hex: '#1d4ed8', size: 'M', stock_quantity: 4 }, { color_name: 'Cobalt', color_hex: '#1d4ed8', size: 'L', stock_quantity: 10 }],
};
r = await admin('POST', '/api/admin/products', newProduct);
check('create product', r.status === 201 && r.data.product.stock === 14, JSON.stringify(r.data).slice(0, 300));
const np = r.data.product;
r = await admin('POST', '/api/admin/products', newProduct);
check('duplicate slug 409', r.status === 409);
r = await admin('PUT', `/api/admin/products/${np.id}`, { ...newProduct, base_price: 1099, variants: [{ ...np.variants[0], stock_quantity: 3 }, { color_name: 'Sage', color_hex: '#10B981', size: 'S', stock_quantity: 7 }] });
check('update product + variants', r.data.product?.price === 1099 && r.data.product.variants.length === 2 && r.data.product.stock === 10, JSON.stringify(r.data).slice(0, 300));
r = await admin('PATCH', `/api/admin/variants/${r.data.product.variants[0].id}`, { adjust: -10 });
check('negative stock blocked', r.status === 422);
r = await admin('PATCH', '/api/admin/inventory', { updates: [{ id: np.variants[0].id, stock_quantity: 25 }] });
check('bulk inventory update', r.data.updated === 1);
r = await admin('GET', '/api/admin/inventory?filter=low');
check('inventory low filter', r.data.variants.every(x => x.stock_quantity >= 1 && x.stock_quantity <= 5));
r = await admin('DELETE', `/api/admin/products/${np.id}`);
check('delete product', r.status === 200);
r = await admin('DELETE', '/api/admin/categories/1');
check('category with products protected', r.status === 409);

console.log('Consent & analytics');
const vid = 'a'.repeat(32);
r = await guest('POST', '/api/events', { visitor_id: vid, path: '/' });
check('analytics ignored without consent', r.data.recorded === false);
r = await guest('POST', '/api/events', { visitor_id: vid, path: '/' }, { Cookie: 'ks_consent=v1.a1.p0.m0' });
check('analytics recorded with consent', r.data.recorded === true);
r = await guest('POST', '/api/consent', { visitor_id: vid, consent: { analytics: true, marketing: false }, version: '1' });
check('consent recorded', r.data.consent?.necessary === true && r.data.consent.marketing === false);
r = await guest('POST', '/api/consent', { visitor_id: vid, consent: {} }, { Origin: 'https://evil.example' });
check('cross-origin POST blocked', r.status === 403);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
