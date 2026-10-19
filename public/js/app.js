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

  /** ผสมสีกับสีขาว: ใช้ทำพื้นหลังอ่อน ๆ ตามสีสินค้า (amount 0 = สีเดิม, 1 = ขาว) */
  KS.tint = (hex, amount = 0.86) => {
    const n = parseInt(String(hex || '#1D4ED8').replace('#', ''), 16) || 0;
    const mix = c => Math.round(c + (255 - c) * amount);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
  };

  /** รูปทรงหมวกแต่ละหมวดเป็น SVG (กล่อง 120x80) ใช้ในรูปสำรองและการ์ดหมวดหมู่ */
  KS.hatShape = function (cat, main, shade) {
    switch (cat) {
      case 'caps': return `
        <path d="M58 57 C80 54 106 56 116 63 C108 71 80 71 56 66 Z" fill="${main}"/><path d="M58 57 C80 54 106 56 116 63 C108 71 80 71 56 66 Z" fill="${shade}"/>
        <path d="M18 60 C18 28 38 12 61 12 C84 12 100 28 100 60 Z" fill="${main}"/>
        <path d="M61 13 C55 28 53 44 55 60 M61 13 C70 28 76 44 78 60" stroke="${shade}" stroke-width="1.6" fill="none"/>
        <circle cx="61" cy="12" r="3.4" fill="${main}"/><circle cx="61" cy="12" r="3.4" fill="${shade}"/>`;
      case 'bucket-hats': return `
        <ellipse cx="60" cy="58" rx="56" ry="13" fill="${main}"/><ellipse cx="60" cy="58" rx="56" ry="13" fill="${shade}"/>
        <path d="M30 56 L37 18 Q60 8 83 18 L90 56 Q60 64 30 56 Z" fill="${main}"/>
        <path d="M33 44 Q60 52 87 44" stroke="${shade}" stroke-width="5" fill="none"/>
        <path d="M37 18 Q60 8 83 18" stroke="${shade}" stroke-width="1.5" fill="none"/>`;
      case 'beanies': return `
        <path d="M24 56 C24 22 40 8 60 8 C80 8 96 22 96 56 Z" fill="${main}"/>
        ${[34, 42, 50, 58, 66, 74, 82].map(x => `<path d="M${x} ${x < 60 ? 20 + (60 - x) / 3 : 20 + (x - 60) / 3} L${x} 54" stroke="${shade}" stroke-width="1.4"/>`).join('')}
        <rect x="18" y="50" width="84" height="20" rx="5" fill="${main}"/><rect x="18" y="50" width="84" height="20" rx="5" fill="${shade}"/>
        ${[24, 32, 40, 48, 56, 64, 72, 80, 88, 96].map(x => `<path d="M${x} 52 L${x} 68" stroke="${main}" stroke-width="2" opacity=".6"/>`).join('')}`;
      default: return `
        <rect x="57" y="10" width="6" height="12" rx="3" fill="${main}"/>
        <ellipse cx="60" cy="40" rx="54" ry="22" fill="${main}" transform="rotate(-6 60 40)"/>
        <path d="M24 52 Q60 70 96 50" stroke="${shade}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <ellipse cx="44" cy="32" rx="18" ry="6" fill="#fff" opacity=".18" transform="rotate(-10 44 32)"/>`;
    }
  };

  /** ภาพวาดหมวกบนพื้นสีอ่อน: แสดงแทนเมื่อโหลดรูปจริงไม่ได้ (เช่น ออฟไลน์ หรือเครือข่ายบล็อก Unsplash) */
  KS.hatIllustration = function (cat, hex = '#1D4ED8') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${KS.tint(hex)}"/>
      <circle cx="300" cy="110" r="70" fill="${KS.tint(hex, 0.7)}"/><ellipse cx="200" cy="318" rx="128" ry="14" fill="rgba(17,19,24,.10)"/>
      <g transform="translate(60 110) scale(2.35)">${KS.hatShape(cat, hex, 'rgba(17,19,24,.22)')}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  /** เมื่อรูปโหลดไม่ได้: เปลี่ยนเป็นภาพวาดหมวกตามหมวดและสี (อ่านจาก data-cat / data-hex) */
  KS.imgFail = el => {
    el.onerror = null;
    el.src = KS.hatIllustration(el.dataset.cat || 'caps', el.dataset.hex || '#1D4ED8');
  };

  /** แท็กรูปสินค้า: opts = { cat: slug หมวด, hex: สีสินค้า } ใช้วาดภาพสำรองให้ตรงทรงและสี */
  KS.img = (src, alt, cls = '', opts = {}) => {
    const cat = opts.cat || 'caps';
    const hex = opts.hex || '#1D4ED8';
    return `<img src="${KS.esc(src || KS.hatIllustration(cat, hex))}" alt="${KS.esc(alt)}" class="${cls}" loading="lazy" decoding="async"
      data-cat="${KS.esc(cat)}" data-hex="${KS.esc(hex)}" onerror="KS.imgFail(this)">`;
  };

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
      box.className = 'fixed z-[80] top-20 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const tone = { success: ['bg-sage', 'check'], error: ['bg-danger', 'circle-alert'], info: ['bg-cobalt', 'info'] }[type] || ['bg-cobalt', 'info'];
    const el = document.createElement('div');
    el.className = 'toast pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl bg-ink text-white pl-3 pr-4 py-2.5 shadow-xl';
    el.innerHTML = `<span class="w-7 h-7 shrink-0 rounded-full grid place-items-center ${tone[0]}">${KS.icon(tone[1], 'w-4 h-4')}</span><span class="text-sm font-medium flex-1">${KS.esc(message)}</span>`;
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
  // การ์ดสินค้า (ใช้หน้าแรก หน้า shop และสินค้าแนะนำ)
  //   - กด swatch แล้วรูปและสีพื้นหลังเปลี่ยนตามสี
  //   - ปุ่ม "+ เพิ่ม" ใส่ตะกร้าทันที (เลือกไซซ์ M ถ้ามี ไม่งั้นไซซ์แรกที่ยังมีของ)
  // ---------------------------------------------------------------------------
  KS.CAT = {
    caps: { label: 'Caps', short: 'Caps', hex: '#1D4ED8' },
    'bucket-hats': { label: 'Bucket Hats', short: 'Buckets', hex: '#F97316' },
    beanies: { label: 'Beanies', short: 'Beanies', hex: '#10B981' },
    berets: { label: 'Berets', short: 'Berets', hex: '#F59E0B' },
  };
  const CARD_PRODUCTS = new Map();     // slug -> ข้อมูลสินค้า (ใช้ตอนกดเพิ่มลงตะกร้า)

  KS.productCard = function (p) {
    CARD_PRODUCTS.set(p.slug, p);
    const c0 = p.colors.find(c => c.stock > 0) || p.colors[0] || { hex: '#1D4ED8', name: '' };
    const url = `/product-detail?slug=${encodeURIComponent(p.slug)}`;
    const low = p.stock > 0 && p.stock <= 5;
    const isNew = p.created_at && (Date.now() - new Date(p.created_at.replace(' ', 'T') + 'Z')) < 1000 * 60 * 60 * 24 * 30;
    const badge = p.stock === 0 ? '' : low ? ['ใกล้หมด', 'bg-mustard text-ink'] : isNew ? ['New Drop', 'bg-cobalt text-white'] : '';
    return `<article class="product-card group relative flex flex-col bg-white border border-line rounded-3xl overflow-hidden fade-in" data-slug="${KS.esc(p.slug)}">
      <a href="${url}" class="pc-link block relative aspect-[4/5] overflow-hidden" style="background:${KS.tint(c0.hex)}" aria-label="${KS.esc(p.name)}">
        ${KS.img(c0.image_url || p.image_url, p.name, 'pc-img absolute inset-0 w-full h-full object-cover', { cat: p.category.slug, hex: c0.hex })}
        ${badge ? `<span class="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${badge[1]}">${badge[0]}</span>` : ''}
        ${p.stock === 0 ? '<span class="absolute inset-x-3 bottom-3 rounded-full bg-ink/85 text-white text-center text-[11px] font-semibold uppercase tracking-widest py-1.5">สินค้าหมด</span>' : ''}
      </a>
      <div class="flex flex-col gap-2 p-4 flex-1">
        <div class="flex items-center gap-1.5" role="group" aria-label="เลือกสี">
          ${p.colors.map(c => `<button type="button" class="swatch swatch-sm" style="background:${KS.esc(c.hex)}" aria-pressed="${c.name === c0.name}"
              title="${KS.esc(c.name)}" aria-label="สี ${KS.esc(c.name)}" data-color="${KS.esc(c.name)}" data-hex="${KS.esc(c.hex)}" data-img="${KS.esc(c.image_url)}"></button>`).join('')}
          <span class="ml-auto text-[11px] font-semibold uppercase tracking-[.12em] text-ink-soft">${KS.esc(KS.CAT[p.category.slug]?.short || p.category.name)}</span>
        </div>
        <h3 class="font-display font-bold text-[17px] leading-tight"><a href="${url}" class="hover:text-cobalt">${KS.esc(p.name)}</a></h3>
        <p class="text-xs text-ink-soft line-clamp-1">${KS.esc(p.material)}</p>
        <div class="mt-auto pt-2 flex items-center justify-between gap-2">
          <span class="font-display font-bold text-lg tabular">${KS.fmt.money(p.price)}</span>
          <button type="button" class="pc-add press h-10 px-3.5 rounded-full bg-ink text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-cobalt disabled:bg-mist disabled:text-ink-soft"
            ${p.stock === 0 ? 'disabled' : ''} aria-label="เพิ่ม ${KS.esc(p.name)} ลงตะกร้า">${KS.icon('plus', 'w-3.5 h-3.5')} เพิ่ม</button>
        </div>
      </div>
    </article>`;
  };

  /** เลือก swatch: เปลี่ยนรูป สีพื้นหลัง และลิงก์ไปหน้าสินค้าให้ตรงสี */
  function pickSwatch(sw) {
    const card = sw.closest('.product-card');
    KS.$$('.swatch', card).forEach(s => s.setAttribute('aria-pressed', String(s === sw)));
    const img = KS.$('.pc-img', card);
    img.dataset.hex = sw.dataset.hex;
    img.onerror = () => KS.imgFail(img);
    img.src = sw.dataset.img || KS.hatIllustration(img.dataset.cat, sw.dataset.hex);
    const link = KS.$('.pc-link', card);
    link.style.background = KS.tint(sw.dataset.hex);
    link.href = `/product-detail?slug=${encodeURIComponent(card.dataset.slug)}&color=${encodeURIComponent(sw.dataset.color)}`;
  }

  /** ผูก event ของการ์ดสินค้าทั้งหมดในพื้นที่ root */
  KS.bindCards = function (root = document) {
    root.addEventListener('click', e => {
      const sw = e.target.closest('.product-card .swatch');
      if (sw) { e.preventDefault(); pickSwatch(sw); return; }
      const add = e.target.closest('.product-card .pc-add');
      if (!add || !KS.cart) return;
      const card = add.closest('.product-card');
      const p = CARD_PRODUCTS.get(card.dataset.slug);
      const color = KS.$('.swatch[aria-pressed="true"]', card)?.dataset.color;
      const inColor = p.variants.filter(v => v.color_name === color && v.stock > 0);
      const pool = inColor.length ? inColor : p.variants.filter(v => v.stock > 0);
      const v = pool.find(x => x.size === 'M') || pool[0];
      if (!v) { KS.toast('สินค้านี้หมดแล้ว', 'error'); return; }
      if (KS.cart.add(p, v, 1)) {
        KS.toast(`เพิ่ม ${p.name} (${v.color_name} / ${v.size}) แล้ว เปลี่ยนไซซ์ได้ในหน้าสินค้า`, 'success');
        KS.cart.open();
      }
    });
  };

  KS.skeletonCards = n => Array.from({ length: n }, () =>
    `<div class="card overflow-hidden"><div class="aspect-[4/5] skeleton"></div><div class="p-4 space-y-2"><div class="h-4 w-2/3 rounded skeleton"></div><div class="h-3 w-1/3 rounded skeleton"></div></div></div>`).join('');

  // ---------------------------------------------------------------------------
  // Header + Footer (วาดลงใน <div id="site-header"> และ <div id="site-footer">)
  //   - แถบประกาศวิ่ง (marquee) ด้านบนสุด
  //   - เมนูแบบแท็บทรงแคปซูล: จอใหญ่อยู่ในแถบหัว, จอมือถืออยู่แถวที่สองใต้โลโก้ (เลื่อนซ้าย-ขวาได้)
  // ---------------------------------------------------------------------------
  const NAV = [
    ['/', 'หน้าแรก', 'house'], ['/shop', 'สินค้าทั้งหมด', 'layout-grid'], ['/shop?category=caps', 'Caps'], ['/shop?category=bucket-hats', 'Bucket Hats'],
    ['/shop?category=beanies', 'Beanies'], ['/shop?category=berets', 'Berets'], ['/track-order', 'ติดตามพัสดุ', 'truck'],
  ];
  const MARQUEE = [
    `ส่งฟรีเมื่อช้อปครบ ${KS.fmt.money(CFG.freeShippingThreshold)}`, 'Caps · Bucket Hats · Beanies · Berets',
    'เปลี่ยนไซซ์ได้ภายใน 14 วัน', 'จ่ายด้วย PromptPay / โอน / ปลายทาง', 'Designed in Bangkok',
  ];

  function logo() {
    return `<a href="/" class="press flex items-center gap-2 shrink-0 font-display font-bold text-[22px] tracking-tight" aria-label="K'Sante หน้าแรก">
      <span class="grid grid-cols-2 gap-[3px]" aria-hidden="true">
        <span class="w-2.5 h-2.5 rounded-[3px] bg-cobalt"></span><span class="w-2.5 h-2.5 rounded-full bg-tangerine"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-sage"></span><span class="w-2.5 h-2.5 rounded-[3px] bg-mustard"></span></span>
      K'SANTE</a>`;
  }

  /** เมนูที่ตรงกับหน้าปัจจุบัน */
  function activeNav() {
    const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    const cat = KS.param('category');
    if (path === '/shop') return cat && !cat.includes(',') ? `/shop?category=${cat}` : '/shop';
    if (path === '/product-detail') return '';
    return path;
  }

  function renderHeader() {
    const el = KS.$('#site-header');
    if (!el) return;
    const here = activeNav();
    const tab = ([href, label, icon]) => `<a href="${href}" class="press shrink-0 h-10 px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${here === href ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink hover:bg-mist'}"
      ${here === href ? 'aria-current="page"' : ''}>${icon ? KS.icon(icon, 'w-4 h-4 lg:hidden') : ''}${label}</a>`;
    el.innerHTML = `
      <div class="bg-ink text-white overflow-hidden h-9 flex items-center" aria-label="ประกาศจากร้าน">
        <div class="flex shrink-0 animate-marquee whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.2em]">
          ${[0, 1].map(n => `<span class="flex" ${n ? 'aria-hidden="true"' : ''}>${MARQUEE.map(m => `<span class="px-6 flex items-center gap-6">${KS.esc(m)}<span class="w-1.5 h-1.5 rounded-full bg-tangerine"></span></span>`).join('')}</span>`).join('')}
        </div>
      </div>
      <header class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-line">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          ${logo()}
          <nav class="hidden lg:flex items-center gap-1 ml-6" aria-label="เมนูหลัก">${NAV.slice(0, 6).map(tab).join('')}</nav>
          <div class="ml-auto flex items-center gap-1">
            <form action="/shop" method="get" class="hidden xl:flex items-center relative w-56 mr-1" role="search">
              <label for="hdr-q" class="sr-only">ค้นหาสินค้า</label>
              <span class="absolute left-3.5 text-ink-soft">${KS.icon('search', 'w-4 h-4')}</span>
              <input id="hdr-q" name="q" class="input h-11 pl-10 rounded-full" placeholder="ค้นหาหมวก" value="${KS.esc(KS.param('q') || '')}" maxlength="60">
            </form>
            <a href="/shop?focus=search" class="press xl:hidden w-11 h-11 rounded-full grid place-items-center hover:bg-mist" aria-label="ค้นหา">${KS.icon('search')}</a>
            <a href="/track-order" class="press hidden lg:grid w-11 h-11 rounded-full place-items-center hover:bg-mist" aria-label="ติดตามพัสดุ" title="ติดตามพัสดุ">${KS.icon('truck')}</a>
            <a href="/profile" class="press w-11 h-11 rounded-full grid place-items-center hover:bg-mist" id="hdr-account" aria-label="บัญชีของฉัน">${KS.icon('user')}</a>
            <button class="press relative h-11 pl-3 pr-4 rounded-full bg-ink text-white flex items-center gap-2 text-sm font-bold hover:bg-cobalt" id="cart-open" aria-label="เปิดตะกร้าสินค้า">
              ${KS.icon('shopping-bag', 'w-[18px] h-[18px]')}<span id="cart-count" class="tabular">0</span></button>
          </div>
        </div>
        <nav class="lg:hidden border-t border-line" aria-label="เมนูหลัก (มือถือ)">
          <div id="mobile-tabs" class="relative max-w-7xl mx-auto px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto no-scrollbar">${NAV.map(tab).join('')}</div>
        </nav>
      </header>`;
    // เลื่อนแท็บที่เลือกอยู่ให้เห็นบนจอมือถือ
    const centerTab = () => {
      const row = KS.$('#mobile-tabs');
      const cur = row && KS.$('[aria-current="page"]', row);
      if (cur) row.scrollLeft = cur.offsetLeft - (row.clientWidth - cur.offsetWidth) / 2;
    };
    window.addEventListener('load', centerTab);
    setTimeout(centerTab, 300);       // รอ Tailwind สร้างสไตล์ก่อนคำนวณตำแหน่ง

    // แสดงตัวอักษรย่อของชื่อเมื่อล็อกอินแล้ว
    KS.me().then(user => {
      const a = KS.$('#hdr-account');
      if (user) {
        a.innerHTML = `<span class="w-8 h-8 rounded-full bg-cobalt text-white text-xs font-bold grid place-items-center">${KS.esc(user.full_name.slice(0, 1).toUpperCase())}</span>`;
        a.title = user.full_name;
      } else {
        a.href = '/login';
        a.setAttribute('aria-label', 'เข้าสู่ระบบ');
      }
    });
  }

  function renderFooter() {
    const el = KS.$('#site-footer');
    if (!el) return;
    const col = (title, items) => `<div><p class="text-[11px] font-bold uppercase tracking-[.18em] text-ink-soft">${title}</p><ul class="mt-4 space-y-3">${items}</ul></div>`;
    el.innerHTML = `
      <footer class="mt-24 bg-white border-t border-line">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-12">
          <div class="md:col-span-5">
            <p class="font-display font-bold text-2xl">K'SANTE STUDIO</p>
            <p class="mt-3 text-sm text-ink-soft max-w-sm leading-relaxed">หมวกและ Headwear สีสดใส ดีไซน์มินิมอล ตัดเย็บเป็นล็อตเล็ก ออกแบบในกรุงเทพฯ ใส่ได้ทุกวัน</p>
            <div class="mt-5 flex gap-2" aria-hidden="true">${['bg-cobalt', 'bg-tangerine', 'bg-sage', 'bg-mustard'].map(c => `<span class="w-8 h-8 rounded-lg ${c}"></span>`).join('')}</div>
            <p class="mt-5 text-sm text-ink-soft">${KS.esc(CFG.address)} · <a href="mailto:${KS.esc(CFG.email)}" class="hover:text-cobalt">${KS.esc(CFG.email)}</a></p>
          </div>
          <div class="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            ${col('ช้อป', NAV.slice(1, 6).map(([href, label]) => `<li><a href="${href}" class="hover:text-cobalt">${label}</a></li>`).join(''))}
            ${col('ช่วยเหลือ', `
              <li><a href="/track-order" class="hover:text-cobalt">ติดตามพัสดุ</a></li>
              <li><a href="/profile" class="hover:text-cobalt">บัญชีและประวัติคำสั่งซื้อ</a></li>
              <li><a href="/product-detail?slug=everyday-twill-cap#size-guide" class="hover:text-cobalt">ตารางไซซ์ (Size Guide)</a></li>
              <li><a href="/cart" class="hover:text-cobalt">ตะกร้าสินค้า</a></li>`)}
            ${col('ความเป็นส่วนตัว', `
              <li><a href="/privacy-policy" class="hover:text-cobalt">นโยบายความเป็นส่วนตัว</a></li>
              <li><a href="/cookie-policy" class="hover:text-cobalt">นโยบายคุกกี้</a></li>
              <li><button type="button" id="footer-cookie-settings" class="hover:text-cobalt inline-flex items-center gap-1.5 text-left">${KS.icon('cookie', 'w-4 h-4')} ตั้งค่าคุกกี้ (Cookie Settings)</button></li>`)}
          </div>
        </div>
        <div class="border-t border-line">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
            <span>© ${new Date().getFullYear()} ${KS.esc(CFG.storeName)} ราคาเป็นเงินบาท รวม VAT แล้ว</span>
            <span class="flex items-center gap-2">${KS.icon('shield-check', 'w-3.5 h-3.5')} Powered by Cloudflare Pages + D1</span>
          </div>
        </div>
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
