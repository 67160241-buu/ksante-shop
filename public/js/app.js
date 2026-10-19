// ============================================================================
// K'Sante : สคริปต์หลักที่ทุกหน้าใช้ร่วมกัน
//   - KS.api()      เรียก API ฝั่ง Cloudflare Functions
//   - KS.fmt        จัดรูปแบบราคา/วันที่
//   - KS.icon()     ไอคอน SVG
//   - KS.toast()    ข้อความแจ้งเตือน
//   - KS.me()       ข้อมูลผู้ใช้ที่ล็อกอินอยู่
//   - Header / Footer / เมนูมือถือ (วาดให้อัตโนมัติทุกหน้า)
//   - KS.productCard()  การ์ดสินค้าพร้อม swatch เปลี่ยนรูปตามสี
// ลำดับโหลด: config.js -> icons.js -> app.js -> cart.js -> cookie.js -> สคริปต์ของแต่ละหน้า
// ============================================================================
(function () {
  const KS = (window.KS = window.KS || {});
  const CFG = window.KS_CONFIG;

  // ---------------------------------------------------------------------------
  // ตัวช่วยทั่วไป
  // ---------------------------------------------------------------------------
  /** ป้องกัน XSS: แปลงอักขระพิเศษก่อนแทรกข้อความลง HTML ทุกครั้ง */
  KS.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  KS.$ = (sel, root = document) => root.querySelector(sel);
  KS.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  KS.param = name => new URLSearchParams(location.search).get(name);

  KS.fmt = {
    money: n => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    // วันที่ในฐานข้อมูลเป็น UTC รูปแบบ "YYYY-MM-DD HH:MM:SS" -> แปลงเป็นเวลาไทย
    date: s => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    datetime: s => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
  };

  KS.icon = (name, cls = 'w-5 h-5') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${(window.KS_ICONS || {})[name] || ''}</svg>`;

  /** รูปสินค้าที่มีภาพสำรองเมื่อโหลดรูปจาก Unsplash ไม่ได้ */
  KS.img = (src, alt, cls = '') =>
    `<img src="${KS.esc(src || '/img/hat-fallback.svg')}" alt="${KS.esc(alt)}" class="${cls}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/img/hat-fallback.svg'">`;

  // ---------------------------------------------------------------------------
  // เรียก API: ส่ง/รับ JSON, แนบ cookie อัตโนมัติ, ถ้า error จะโยน Error ที่มีข้อความภาษาไทยจาก server
  // ---------------------------------------------------------------------------
  KS.api = async function (path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'), { status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || !data || data.ok === false) {
      const err = new Error(data?.error || `เกิดข้อผิดพลาด (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  // ---------------------------------------------------------------------------
  // ผู้ใช้ปัจจุบัน (เรียก API ครั้งเดียวต่อหน้า แล้วจำผลไว้)
  // ---------------------------------------------------------------------------
  let mePromise = null;
  KS.me = (refresh = false) => {
    if (!mePromise || refresh) mePromise = KS.api('/api/auth/me').then(d => d.user).catch(() => null);
    return mePromise;
  };

  /** ใช้ในหน้าที่ต้องล็อกอิน: ถ้ายังไม่ล็อกอินจะพาไปหน้า login แล้วกลับมาหน้าเดิม */
  KS.requireLogin = async () => {
    const user = await KS.me();
    if (!user) location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
    return user;
  };

  // ---------------------------------------------------------------------------
  // Toast แจ้งเตือนมุมล่าง
  // ---------------------------------------------------------------------------
  KS.toast = function (message, type = 'info') {
    let box = KS.$('#toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.className = 'fixed z-[80] bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const tone = { success: ['bg-sage', 'circle-check'], error: ['bg-danger', 'circle-alert'], info: ['bg-ink', 'info'] }[type] || ['bg-ink', 'info'];
    const el = document.createElement('div');
    el.className = `toast ${tone[0]} text-white rounded-2xl px-4 py-3 text-sm font-semibold flex items-start gap-2 shadow-block-sm`;
    el.innerHTML = `${KS.icon(tone[1], 'w-5 h-5 shrink-0')}<span>${KS.esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
  };

  /** แสดงข้อความ error ในกล่องของฟอร์ม */
  KS.formError = (el, message) => {
    if (!el) return;
    el.hidden = !message;
    el.innerHTML = message ? `${KS.icon('circle-alert', 'w-4 h-4 shrink-0 mt-0.5')}<span>${KS.esc(message)}</span>` : '';
  };

  /** ล็อกปุ่มระหว่างรอ API ป้องกันการกดซ้ำ */
  KS.busy = (btn, on, label) => {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `${KS.icon('refresh-cw', 'w-4 h-4 animate-spin')} ${label || 'กำลังดำเนินการ...'}`; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };

  // ---------------------------------------------------------------------------
  // สถานะคำสั่งซื้อ: สี ไอคอน และคำอธิบาย (ใช้ในหน้า profile / track / admin)
  // ---------------------------------------------------------------------------
  KS.STATUS = {
    Pending:   { th: 'รอตรวจสอบ', icon: 'clock', cls: 'bg-mustard-soft text-[#8A5300]', dot: '#F59E0B' },
    Confirmed: { th: 'ยืนยันแล้ว', icon: 'clipboard-check', cls: 'bg-cobalt-soft text-cobalt', dot: '#1D4ED8' },
    Packing:   { th: 'กำลังแพ็ก', icon: 'package', cls: 'bg-tangerine-soft text-[#B44A06]', dot: '#F97316' },
    Shipped:   { th: 'จัดส่งแล้ว', icon: 'truck', cls: 'bg-[#E9E3FF] text-[#5B3FD1]', dot: '#7C5CFA' },
    Completed: { th: 'สำเร็จ', icon: 'package-check', cls: 'bg-sage-soft text-[#06704D]', dot: '#10B981' },
    Cancelled: { th: 'ยกเลิก', icon: 'ban', cls: 'bg-danger-soft text-danger', dot: '#DC2626' },
  };
  KS.FLOW = ['Pending', 'Confirmed', 'Packing', 'Shipped', 'Completed'];
  KS.badge = s => {
    const m = KS.STATUS[s] || KS.STATUS.Pending;
    return `<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${m.cls}"><span class="w-1.5 h-1.5 rounded-full" style="background:${m.dot}"></span>${KS.esc(s)} · ${m.th}</span>`;
  };

  /** Timeline ติดตามพัสดุ: วาดแต่ละขั้น พร้อมเวลาจากประวัติสถานะ */
  KS.timeline = function (order) {
    const seen = {};
    for (const h of order.history || []) if (!seen[h.status]) seen[h.status] = h;
    if (order.status === 'Cancelled') {
      const c = seen.Cancelled;
      return `<div class="rounded-2xl bg-danger-soft text-danger p-4 flex gap-3 items-start">${KS.icon('ban', 'w-5 h-5 shrink-0')}
        <div><p class="font-bold">คำสั่งซื้อถูกยกเลิก</p><p class="text-sm">${KS.esc(c?.note || '')} ${c ? '· ' + KS.fmt.datetime(c.created_at) : ''}</p></div></div>`;
    }
    const cur = KS.FLOW.indexOf(order.status);
    return `<ol class="relative grid grid-cols-5 gap-1" aria-label="สถานะการจัดส่ง">
      ${KS.FLOW.map((s, i) => {
        const done = i <= cur;
        const m = KS.STATUS[s];
        return `<li class="relative flex flex-col items-center text-center">
          ${i > 0 ? `<span class="absolute top-5 right-1/2 w-full h-1 -z-0 ${i <= cur ? 'bg-ink' : 'bg-line'}"></span>` : ''}
          <span class="relative z-10 w-10 h-10 rounded-full grid place-items-center border-2 ${done ? 'bg-ink border-ink text-white' : 'bg-white border-line text-ink-soft'} ${i === cur ? 'ring-4 ring-cobalt/20' : ''}">${KS.icon(m.icon, 'w-5 h-5')}</span>
          <span class="mt-2 text-[11px] sm:text-xs font-bold ${done ? '' : 'text-ink-soft'}">${m.th}</span>
          <span class="text-[10px] sm:text-[11px] text-ink-soft">${seen[s] ? KS.fmt.datetime(seen[s].created_at) : ''}</span>
        </li>`;
      }).join('')}
    </ol>`;
  };

  // ---------------------------------------------------------------------------
  // การ์ดสินค้า (ใช้หน้าแรก หน้า shop และสินค้าแนะนำ) : กด swatch แล้วรูปเปลี่ยนตามสี
  // ---------------------------------------------------------------------------
  const CAT_TONE = { caps: 'bg-cobalt', 'bucket-hats': 'bg-tangerine', beanies: 'bg-sage', berets: 'bg-mustard' };
  KS.productCard = function (p) {
    const url = `/product-detail?slug=${encodeURIComponent(p.slug)}`;
    const low = p.stock > 0 && p.stock <= 5;
    return `<article class="product-card card overflow-hidden group fade-in" data-slug="${KS.esc(p.slug)}">
      <a href="${url}" class="block relative aspect-square overflow-hidden bg-mist" aria-label="${KS.esc(p.name)}">
        ${KS.img(p.colors[0]?.image_url || p.image_url, p.name, 'pc-img w-full h-full object-cover')}
        <span class="absolute top-3 left-3 ${CAT_TONE[p.category.slug] || 'bg-ink'} text-white text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">${KS.esc(p.category.name)}</span>
        ${p.stock === 0 ? '<span class="absolute top-3 right-3 bg-ink text-white text-[10px] font-bold rounded-full px-2.5 py-1">สินค้าหมด</span>'
          : low ? '<span class="absolute top-3 right-3 bg-mustard text-white text-[10px] font-bold rounded-full px-2.5 py-1">ใกล้หมด</span>' : ''}
      </a>
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display font-bold leading-tight"><a href="${url}" class="hover:text-cobalt">${KS.esc(p.name)}</a></h3>
          <p class="font-bold tabular shrink-0">${KS.fmt.money(p.price)}</p>
        </div>
        <p class="text-xs text-ink-soft mt-1 line-clamp-1">${KS.esc(p.material)}</p>
        <div class="flex items-center gap-2 mt-3" role="group" aria-label="เลือกสี">
          ${p.colors.map((c, i) => `<button type="button" class="swatch swatch-sm" style="background:${KS.esc(c.hex)}" aria-pressed="${i === 0}"
              title="${KS.esc(c.name)}" aria-label="สี ${KS.esc(c.name)}" data-img="${KS.esc(c.image_url)}"></button>`).join('')}
          <span class="text-[11px] text-ink-soft ml-auto">${p.sizes.join(' · ')}</span>
        </div>
      </div>
    </article>`;
  };

  /** ผูก event ให้ swatch ในการ์ดสินค้าทั้งหมดในพื้นที่ root (เปลี่ยนรูปเมื่อชี้/กด) */
  KS.bindCards = function (root = document) {
    root.addEventListener('click', e => {
      const sw = e.target.closest('.product-card .swatch');
      if (!sw) return;
      e.preventDefault();
      const card = sw.closest('.product-card');
      KS.$$('.swatch', card).forEach(s => s.setAttribute('aria-pressed', String(s === sw)));
      const img = KS.$('.pc-img', card);
      img.src = sw.dataset.img;
    });
    root.addEventListener('mouseover', e => {
      const sw = e.target.closest('.product-card .swatch');
      if (sw) KS.$('.pc-img', sw.closest('.product-card')).src = sw.dataset.img;
    });
  };

  KS.skeletonCards = n => Array.from({ length: n }, () =>
    `<div class="card overflow-hidden"><div class="aspect-square skeleton"></div><div class="p-4 space-y-2"><div class="h-4 w-2/3 rounded skeleton"></div><div class="h-3 w-1/3 rounded skeleton"></div></div></div>`).join('');

  // ---------------------------------------------------------------------------
  // Header + Footer (วาดลงใน <div id="site-header"> และ <div id="site-footer">)
  // ---------------------------------------------------------------------------
  const NAV = [
    ['/shop', 'ทั้งหมด'], ['/shop?category=caps', 'Caps'], ['/shop?category=bucket-hats', 'Bucket Hats'],
    ['/shop?category=beanies', 'Beanies'], ['/shop?category=berets', 'Berets'],
  ];

  function logo() {
    return `<a href="/" class="flex items-center gap-2 shrink-0" aria-label="K'Sante หน้าแรก">
      <span class="grid grid-cols-2 gap-0.5 w-7 h-7" aria-hidden="true">
        <span class="bg-cobalt rounded-tl-lg"></span><span class="bg-tangerine rounded-tr-lg"></span>
        <span class="bg-sage rounded-bl-lg"></span><span class="bg-mustard rounded-br-lg"></span></span>
      <span class="font-display font-bold text-xl tracking-tight">K'Sante</span></a>`;
  }

  function renderHeader() {
    const el = KS.$('#site-header');
    if (!el) return;
    const here = location.pathname + location.search;
    el.innerHTML = `
      <div class="bg-ink text-white text-xs font-semibold text-center py-2 px-4">
        ส่งฟรีทั่วไทยเมื่อช้อปครบ ${KS.fmt.money(CFG.freeShippingThreshold)} · เปลี่ยนไซซ์ได้ภายใน 14 วัน</div>
      <header class="sticky top-0 z-40 bg-canvas/90 backdrop-blur border-b border-line">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <button class="icon-btn lg:hidden" id="menu-open" aria-label="เปิดเมนู">${KS.icon('menu')}</button>
          ${logo()}
          <nav class="hidden lg:flex items-center gap-1 ml-6" aria-label="หมวดหมู่">
            ${NAV.map(([href, label]) => `<a href="${href}" class="px-3 py-2 rounded-full text-sm font-bold hover:bg-mist ${here === href ? 'bg-ink text-white hover:bg-ink' : ''}">${label}</a>`).join('')}
          </nav>
          <form action="/shop" method="get" class="hidden md:flex ml-auto items-center relative w-64" role="search">
            <label for="hdr-q" class="sr-only">ค้นหาสินค้า</label>
            <span class="absolute left-3 text-ink-soft">${KS.icon('search', 'w-4 h-4')}</span>
            <input id="hdr-q" name="q" class="input h-10 pl-9 rounded-full" placeholder="ค้นหาหมวก เช่น beanie" value="${KS.esc(KS.param('q') || '')}" maxlength="60">
          </form>
          <div class="flex items-center gap-1 ml-auto md:ml-2">
            <a href="/shop" class="icon-btn md:hidden" aria-label="ค้นหา">${KS.icon('search')}</a>
            <a href="/profile" class="icon-btn" id="hdr-account" aria-label="บัญชีของฉัน">${KS.icon('user')}</a>
            <button class="icon-btn relative" id="cart-open" aria-label="เปิดตะกร้าสินค้า">${KS.icon('shopping-bag')}
              <span id="cart-count" class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-tangerine text-white text-[11px] font-bold grid place-items-center" hidden>0</span></button>
          </div>
        </div>
      </header>
      <div id="mobile-menu" class="fixed inset-0 z-50" hidden>
        <div class="absolute inset-0 bg-ink/40" data-close></div>
        <nav class="absolute left-0 top-0 bottom-0 w-80 max-w-[85%] bg-white p-5 flex flex-col gap-1 modal-panel" aria-label="เมนูหลัก">
          <div class="flex items-center justify-between mb-4">${logo()}<button class="icon-btn" data-close aria-label="ปิดเมนู">${KS.icon('x')}</button></div>
          <form action="/shop" method="get" class="relative mb-3" role="search">
            <span class="absolute left-3 top-3 text-ink-soft">${KS.icon('search', 'w-4 h-4')}</span>
            <input name="q" class="input pl-9 rounded-full" placeholder="ค้นหาสินค้า" aria-label="ค้นหาสินค้า" maxlength="60"></form>
          ${NAV.map(([href, label]) => `<a href="${href}" class="px-3 py-3 rounded-xl font-bold hover:bg-mist">${label}</a>`).join('')}
          <hr class="my-3 border-line">
          <a href="/track-order" class="px-3 py-3 rounded-xl font-bold hover:bg-mist flex items-center gap-2">${KS.icon('truck', 'w-4 h-4')} ติดตามพัสดุ</a>
          <a href="/profile" class="px-3 py-3 rounded-xl font-bold hover:bg-mist flex items-center gap-2">${KS.icon('user', 'w-4 h-4')} บัญชีของฉัน</a>
        </nav>
      </div>`;
    const menu = KS.$('#mobile-menu');
    KS.$('#menu-open').addEventListener('click', () => { menu.hidden = false; });
    menu.addEventListener('click', e => { if (e.target.closest('[data-close]')) menu.hidden = true; });

    // แสดงชื่อผู้ใช้เมื่อล็อกอินแล้ว
    KS.me().then(user => {
      const a = KS.$('#hdr-account');
      if (user) {
        a.className = 'h-10 pl-1 pr-3 rounded-full hover:bg-mist flex items-center gap-2 text-sm font-bold';
        a.innerHTML = `<span class="w-8 h-8 rounded-full bg-cobalt text-white grid place-items-center text-xs">${KS.esc(user.full_name.slice(0, 1).toUpperCase())}</span><span class="hidden sm:inline max-w-24 truncate">${KS.esc(user.full_name.split(' ')[0])}</span>`;
      } else {
        a.href = '/login';
        a.setAttribute('aria-label', 'เข้าสู่ระบบ');
      }
    });
  }

  function renderFooter() {
    const el = KS.$('#site-footer');
    if (!el) return;
    el.innerHTML = `
      <footer class="mt-24 border-t border-line bg-white">
        <div class="grid grid-cols-4 h-2" aria-hidden="true"><span class="bg-cobalt"></span><span class="bg-tangerine"></span><span class="bg-sage"></span><span class="bg-mustard"></span></div>
        <div class="max-w-7xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>${logo()}<p class="mt-3 text-sm text-ink-soft leading-relaxed">หมวกและ Headwear สีสดใส ดีไซน์มินิมอล ออกแบบในกรุงเทพฯ ใส่ได้ทุกวัน</p></div>
          <div><p class="eyebrow text-ink-soft mb-3">ช้อป</p><ul class="space-y-2 text-sm font-semibold">
            ${NAV.map(([href, label]) => `<li><a href="${href}" class="hover:text-cobalt">${label}</a></li>`).join('')}</ul></div>
          <div><p class="eyebrow text-ink-soft mb-3">ช่วยเหลือ</p><ul class="space-y-2 text-sm font-semibold">
            <li><a href="/track-order" class="hover:text-cobalt">ติดตามพัสดุ</a></li>
            <li><a href="/profile" class="hover:text-cobalt">ประวัติคำสั่งซื้อ</a></li>
            <li><a href="/product-detail?slug=everyday-twill-cap#size-guide" class="hover:text-cobalt">ตารางไซซ์ (Size Guide)</a></li>
            <li><a href="mailto:${CFG.email}" class="hover:text-cobalt">${CFG.email}</a></li></ul></div>
          <div><p class="eyebrow text-ink-soft mb-3">ความเป็นส่วนตัว</p><ul class="space-y-2 text-sm font-semibold">
            <li><a href="/privacy-policy" class="hover:text-cobalt">นโยบายความเป็นส่วนตัว</a></li>
            <li><a href="/cookie-policy" class="hover:text-cobalt">นโยบายคุกกี้</a></li>
            <li><button type="button" id="footer-cookie-settings" class="hover:text-cobalt inline-flex items-center gap-1.5">${KS.icon('cookie', 'w-4 h-4')} ตั้งค่าคุกกี้ (Cookie Settings)</button></li></ul></div>
        </div>
        <div class="border-t border-line"><div class="max-w-7xl mx-auto px-4 py-5 text-xs text-ink-soft flex flex-col sm:flex-row gap-2 justify-between">
          <span>© ${new Date().getFullYear()} ${KS.esc(CFG.storeName)} สงวนลิขสิทธิ์</span><span>Powered by Cloudflare Pages + D1</span></div></div>
      </footer>`;
    KS.$('#footer-cookie-settings').addEventListener('click', () => KS.consent?.openSettings());
  }

  /** แปลง <span data-icon="ชื่อ"> ในไฟล์ HTML ให้เป็นไอคอน SVG */
  KS.hydrateIcons = (root = document) => {
    KS.$$('[data-icon]', root).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      el.insertAdjacentHTML('afterbegin', KS.icon(el.dataset.icon, el.dataset.cls || 'w-5 h-5'));
    });
  };

  renderHeader();
  renderFooter();
  KS.hydrateIcons();
})();
