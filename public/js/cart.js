// ============================================================================
// ตะกร้าสินค้า (Slide-out Cart Drawer)
// - เก็บรายการในเครื่องผู้ใช้ (localStorage: ks_cart) จัดเป็น "คุกกี้ที่จำเป็น" ตามนโยบายคุกกี้
// - ทุกครั้งที่เปิดตะกร้า ระบบจะตรวจราคาและสต็อกจริงกับเซิร์ฟเวอร์ (/api/cart/validate)
// - ปุ่มเพิ่มจำนวนถูกจำกัดไม่ให้เกินสต็อกจริง
// ============================================================================
(function () {
  const KS = window.KS;
  const CFG = window.KS_CONFIG;
  const KEY = 'ks_cart';
  const MAX_PER_LINE = 20;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ */ }
    updateCount();
    document.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
  }

  const cart = (KS.cart = {
    items: load,
    count: () => load().reduce((s, i) => s + i.quantity, 0),
    subtotal: () => load().reduce((s, i) => s + i.price * i.quantity, 0),

    /** เพิ่มสินค้า: variant = ตัวเลือกสี/ขนาด, product = ข้อมูลสินค้า */
    add(product, variant, quantity = 1) {
      const items = load();
      const line = items.find(i => i.variant_id === variant.id);
      const max = Math.min(variant.stock, MAX_PER_LINE);
      const want = (line ? line.quantity : 0) + quantity;
      if (max <= 0) { KS.toast('สินค้าตัวเลือกนี้หมดแล้ว', 'error'); return false; }
      if (want > max) {
        KS.toast(`เพิ่มได้สูงสุด ${max} ชิ้น (ตามสต็อกที่มี)`, 'error');
        if (line) line.quantity = max; else items.push(makeLine(product, variant, max));
        save(items);
        return false;
      }
      if (line) { line.quantity = want; line.max = max; } else items.push(makeLine(product, variant, quantity));
      save(items);
      return true;
    },
    setQty(variantId, qty) {
      const items = load();
      const line = items.find(i => i.variant_id === variantId);
      if (!line) return;
      line.quantity = Math.max(1, Math.min(qty, line.max ?? MAX_PER_LINE));
      save(items);
    },
    remove(variantId) { save(load().filter(i => i.variant_id !== variantId)); },
    clear() { save([]); },

    /**
     * ตรวจกับเซิร์ฟเวอร์: อัปเดตราคา/สต็อกล่าสุด, ลบสินค้าที่เลิกขาย, คืน problems ให้หน้าเว็บแสดง
     */
    async validate() {
      const items = load();
      if (!items.length) return { lines: [], problems: [], subtotal: 0, shipping_fee: 0, total: 0 };
      const res = await KS.api('/api/cart/validate', { method: 'POST', body: { items: items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })) } });
      const gone = new Set(res.problems.filter(p => p.reason === 'unavailable').map(p => p.variant_id));
      const fresh = items.filter(i => !gone.has(i.variant_id)).map(i => {
        const l = res.lines.find(x => x.variant_id === i.variant_id);
        return l ? { ...i, price: l.price, name: l.name, image_url: l.image_url, max: Math.min(l.available, MAX_PER_LINE) } : i;
      });
      save(fresh);
      return res;
    },
  });

  function makeLine(p, v, quantity) {
    return {
      variant_id: v.id, product_id: p.id, slug: p.slug, name: p.name, color_name: v.color_name, color_hex: v.color_hex,
      size: v.size, price: p.price, image_url: v.image_url || p.image_url, quantity, max: Math.min(v.stock, MAX_PER_LINE),
      category: p.category?.slug || '',
    };
  }

  function updateCount() {
    const el = document.getElementById('cart-count');
    if (!el) return;
    const n = cart.count();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = false;           // ปุ่มตะกร้าแสดงจำนวนเสมอ (รวม 0)
  }

  /** แถบความคืบหน้าส่งฟรี */
  KS.freeShipBar = function (subtotal) {
    const goal = CFG.freeShippingThreshold;
    const pct = Math.min(100, Math.round((subtotal / goal) * 100));
    const left = goal - subtotal;
    return `<div class="rounded-2xl ${left <= 0 ? 'bg-sage-soft' : 'bg-mist'} p-3">
      <p class="text-xs font-bold flex items-center gap-1.5">${KS.icon('truck', 'w-4 h-4')}
        ${left <= 0 ? 'ยินดีด้วย! คุณได้รับสิทธิ์ส่งฟรี' : `ซื้อเพิ่มอีก ${KS.fmt.money(left)} เพื่อรับสิทธิ์ส่งฟรี`}</p>
      <div class="stock-bar mt-2 bg-white"><span style="width:${pct}%;background:${left <= 0 ? '#10B981' : '#F97316'}"></span></div></div>`;
  };

  /** แถวสินค้าในตะกร้า ใช้ทั้งใน Drawer และหน้า cart.html */
  KS.cartLine = function (i, problem) {
    const atMax = i.quantity >= (i.max ?? MAX_PER_LINE);
    return `<li class="flex gap-3 py-4 border-b border-line last:border-0" data-variant="${i.variant_id}">
      <a href="/product-detail?slug=${encodeURIComponent(i.slug)}" class="w-20 h-20 rounded-xl overflow-hidden bg-mist shrink-0">${KS.img(i.image_url, i.name, 'w-full h-full object-cover', { cat: i.category, hex: i.color_hex })}</a>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between gap-2"><a href="/product-detail?slug=${encodeURIComponent(i.slug)}" class="font-bold text-sm leading-tight hover:text-cobalt">${KS.esc(i.name)}</a>
          <button class="text-ink-soft hover:text-danger shrink-0" data-remove aria-label="ลบ ${KS.esc(i.name)} ออกจากตะกร้า">${KS.icon('trash2', 'w-4 h-4')}</button></div>
        <p class="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5"><span class="w-3 h-3 rounded-full border border-line" style="background:${KS.esc(i.color_hex)}"></span>${KS.esc(i.color_name)} · ไซซ์ ${KS.esc(i.size)}</p>
        ${problem ? `<p class="text-xs font-bold text-danger mt-1">${KS.esc(problem.message)}</p>` : ''}
        <div class="flex items-center justify-between mt-2">
          <div class="inline-flex items-center rounded-full border border-line bg-white">
            <button class="w-8 h-8 grid place-items-center disabled:opacity-30" data-dec ${i.quantity <= 1 ? 'disabled' : ''} aria-label="ลดจำนวน">${KS.icon('minus', 'w-3.5 h-3.5')}</button>
            <span class="w-7 text-center text-sm font-bold tabular" aria-live="polite">${i.quantity}</span>
            <button class="w-8 h-8 grid place-items-center disabled:opacity-30" data-inc ${atMax ? 'disabled' : ''} aria-label="เพิ่มจำนวน">${KS.icon('plus', 'w-3.5 h-3.5')}</button>
          </div>
          <p class="font-bold text-sm tabular">${KS.fmt.money(i.price * i.quantity)}</p>
        </div>
        ${atMax ? `<p class="text-[11px] text-ink-soft mt-1">สูงสุด ${i.max} ชิ้นตามสต็อก</p>` : ''}
      </div></li>`;
  };

  /** ผูกปุ่ม +/−/ลบ ในรายการตะกร้า */
  KS.bindCartList = function (root, after) {
    root.addEventListener('click', e => {
      const li = e.target.closest('[data-variant]');
      if (!li) return;
      const id = Number(li.dataset.variant);
      const line = cart.items().find(i => i.variant_id === id);
      if (!line) return;
      if (e.target.closest('[data-inc]')) cart.setQty(id, line.quantity + 1);
      else if (e.target.closest('[data-dec]')) cart.setQty(id, line.quantity - 1);
      else if (e.target.closest('[data-remove]')) cart.remove(id);
      else return;
      after?.();
    });
  };

  // ---------------------------------------------------------------------------
  // Drawer
  // ---------------------------------------------------------------------------
  let problems = [];
  function mountDrawer() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="cart-backdrop" class="backdrop fixed inset-0 z-[60] bg-ink/40"></div>
      <aside id="cart-drawer" class="drawer fixed z-[70] top-0 right-0 h-full w-full max-w-md bg-canvas flex flex-col border-l-2 border-ink" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">
        <div class="flex items-center justify-between px-5 h-16 border-b border-line bg-white">
          <h2 id="cart-title" class="font-display font-bold text-lg flex items-center gap-2">${KS.icon('shopping-bag')} ตะกร้าสินค้า</h2>
          <button class="icon-btn" id="cart-close" aria-label="ปิดตะกร้า">${KS.icon('x')}</button>
        </div>
        <div id="cart-body" class="flex-1 overflow-y-auto px-5"></div>
        <div id="cart-foot" class="border-t border-line bg-white p-5 space-y-3"></div>
      </aside>`;
    document.body.append(...wrap.children);
    KS.$('#cart-close').addEventListener('click', cart.close);
    KS.$('#cart-backdrop').addEventListener('click', cart.close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && KS.$('#cart-drawer').classList.contains('open')) cart.close(); });
    KS.bindCartList(KS.$('#cart-body'), renderDrawer);
    document.addEventListener('cart:change', () => { if (KS.$('#cart-drawer').classList.contains('open')) renderDrawer(); });
  }

  function renderDrawer() {
    const items = cart.items();
    const body = KS.$('#cart-body');
    const foot = KS.$('#cart-foot');
    if (!items.length) {
      body.innerHTML = `<div class="h-full grid place-items-center text-center py-16"><div>
        <div class="w-20 h-20 mx-auto rounded-full bg-mist grid place-items-center">${KS.icon('shopping-bag', 'w-8 h-8 text-ink-soft')}</div>
        <p class="font-bold mt-4">ตะกร้ายังว่างอยู่</p><p class="text-sm text-ink-soft mt-1">เลือกหมวกใบโปรดแล้วกลับมาที่นี่</p>
        <a href="/shop" class="btn btn-primary mt-5">เลือกซื้อสินค้า ${KS.icon('arrow-right', 'w-4 h-4')}</a></div></div>`;
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    body.innerHTML = `<ul>${items.map(i => KS.cartLine(i, problems.find(p => p.variant_id === i.variant_id))).join('')}</ul>`;
    const sub = cart.subtotal();
    const ship = sub >= CFG.freeShippingThreshold ? 0 : CFG.shippingFee;
    const blocked = problems.some(p => items.find(i => i.variant_id === p.variant_id && i.quantity > p.available));
    foot.innerHTML = `${KS.freeShipBar(sub)}
      <div class="text-sm space-y-1"><div class="flex justify-between"><span class="text-ink-soft">ยอดสินค้า</span><span class="font-bold tabular">${KS.fmt.money(sub)}</span></div>
        <div class="flex justify-between"><span class="text-ink-soft">ค่าจัดส่ง</span><span class="font-bold tabular">${ship ? KS.fmt.money(ship) : 'ฟรี'}</span></div>
        <div class="flex justify-between text-base pt-1"><span class="font-bold">รวมทั้งหมด</span><span class="font-display font-bold tabular">${KS.fmt.money(sub + ship)}</span></div></div>
      <a href="/checkout" class="btn btn-tangerine w-full h-12 ${blocked ? 'pointer-events-none opacity-40' : ''}" ${blocked ? 'aria-disabled="true"' : ''}>ชำระเงิน ${KS.icon('arrow-right', 'w-4 h-4')}</a>
      <a href="/cart" class="btn btn-ghost w-full">ดูตะกร้าแบบเต็มหน้า</a>`;
  }

  cart.open = async function () {
    KS.$('#cart-drawer').classList.add('open');
    KS.$('#cart-drawer').setAttribute('aria-hidden', 'false');
    KS.$('#cart-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderDrawer();
    KS.$('#cart-close').focus();
    try {
      const res = await cart.validate();
      problems = res.problems || [];
      renderDrawer();
    } catch (err) {
      KS.toast(err.message, 'error');
    }
  };
  cart.close = function () {
    KS.$('#cart-drawer').classList.remove('open');
    KS.$('#cart-drawer').setAttribute('aria-hidden', 'true');
    KS.$('#cart-backdrop').classList.remove('open');
    document.body.style.overflow = '';
  };

  mountDrawer();
  updateCount();
  document.getElementById('cart-open')?.addEventListener('click', cart.open);
  // ตะกร้าเปลี่ยนจากอีกแท็บ -> อัปเดตตัวเลข
  window.addEventListener('storage', e => { if (e.key === KEY) updateCount(); });
})();
