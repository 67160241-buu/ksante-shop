// ============================================================================
// หน้าแรก: ดึงสินค้าและหมวดหมู่จาก API แล้ววาด Hero, แท็บสินค้ายอดนิยม และการ์ดหมวดหมู่
// ============================================================================
(async function () {
  const { $, $$, api, esc, img, productCard, bindCards, fmt } = KS;
  const CATS = ['caps', 'bucket-hats', 'beanies', 'berets'];

  // แถบคำวิ่งสีส้ม (ทำ 2 ชุดต่อกันเพื่อให้วิ่งวนได้ต่อเนื่อง)
  const words = ['Caps', 'Bucket Hats', 'Beanies', 'Berets', 'Designed in Bangkok', 'Dyed loud', 'Built to last'];
  $('#band').innerHTML = [0, 1].map(() => `<span class="flex">${words.map(w =>
    `<span class="px-6 flex items-center gap-6">${esc(w)} ${KS.icon('sparkles', 'w-[18px] h-[18px]')}</span>`).join('')}</span>`).join('');
  $('#perk-free').textContent = fmt.money(KS_CONFIG.freeShippingThreshold);

  // สมาชิกที่ล็อกอินแล้ว: เปลี่ยนปุ่มเป็นไปหน้าบัญชี
  KS.me().then(user => {
    if (user) $('#perk-actions').innerHTML = `<a href="/profile" class="btn btn-tangerine btn-lg">${KS.icon('user', 'w-[18px] h-[18px]')} ไปที่บัญชีของฉัน</a>
      <a href="/track-order" class="btn btn-outline btn-lg">${KS.icon('truck', 'w-[18px] h-[18px]')} ติดตามพัสดุ</a>`;
  });

  $('#trend').innerHTML = Array.from({ length: 4 }, () => `<div class="snap-start shrink-0 w-[70%] sm:w-[44%] md:w-[31%] lg:w-[23.5%]">${KS.skeletonCards(1)}</div>`).join('');
  bindCards($('#trend'));

  let all = [];
  let cats = [];
  try {
    const [c, p] = await Promise.all([api('/api/categories'), api('/api/products?sort=featured')]);
    cats = c.categories;
    all = p.products;
  } catch (err) {
    $('#trend').innerHTML = `<p class="text-danger font-bold">${esc(err.message)}</p>`;
    return;
  }

  // ---- ตัวเลขเด่นใน Hero ----
  $('[data-stat="products"]').textContent = all.length;
  $('[data-stat="colors"]').textContent = new Set(all.flatMap(p => p.colors.map(c => c.name.toLowerCase()))).size;

  // ---- Hero: สินค้าเด่น = หมวกแก๊ปตัวแรกที่มีของ ----
  const hero = all.find(p => p.category.slug === 'caps' && p.stock > 0) || all[0];
  if (hero) {
    const c = hero.colors.find(x => x.stock > 0) || hero.colors[0];
    const url = `/product-detail?slug=${encodeURIComponent(hero.slug)}&color=${encodeURIComponent(c.name)}`;
    const main = $('#hero-main');
    main.href = url;
    main.style.background = KS.tint(c.hex);
    main.innerHTML = `${img(c.image_url, hero.name, 'w-full h-full object-cover', { cat: hero.category.slug, hex: c.hex })}
      <span class="pill absolute top-4 left-4 bg-white/95"><span class="w-2 h-2 rounded-full" style="background:${esc(c.hex)}"></span> In focus: ${esc(c.name)}</span>
      <span class="pill absolute top-4 right-4 hidden sm:inline-flex bg-ink text-white">${KS.icon('truck', 'w-3.5 h-3.5')} ส่งฟรีเมื่อครบ ${fmt.money(KS_CONFIG.freeShippingThreshold)}</span>`;
    const card = $('#hero-featured');
    card.hidden = false;
    card.innerHTML = `
      <div class="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[.14em]"><span class="text-tangerine">Featured piece</span><span class="tabular">${fmt.money(hero.price)}</span></div>
      <a href="${url}" class="mt-2 block w-full aspect-[4/3] rounded-2xl overflow-hidden" style="background:${KS.tint(c.hex)}">${img(c.image_url, hero.name, 'w-full h-full object-cover', { cat: hero.category.slug, hex: c.hex })}</a>
      <div class="mt-3 flex items-center justify-between gap-2 px-1">
        <div class="min-w-0"><p class="font-display font-bold leading-tight truncate">${esc(hero.name)}</p><p class="text-xs text-ink-soft truncate">${esc(hero.material)}</p></div>
        <a href="${url}" class="press w-11 h-11 shrink-0 rounded-full bg-cobalt text-white grid place-items-center hover:bg-ink" aria-label="ดู ${esc(hero.name)}">${KS.icon('arrow-up-right', 'w-[18px] h-[18px]')}</a>
      </div>`;
  }

  // ---- แท็บสินค้ายอดนิยม ----
  let tab = 'all';
  const count = slug => all.filter(p => p.category.slug === slug).length;
  function renderTrend() {
    $('#trend-tabs').innerHTML = `<button type="button" role="tab" class="press shrink-0 h-11 px-5 rounded-full border text-sm font-bold ${tab === 'all' ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-ink'}"
        aria-selected="${tab === 'all'}" data-tab="all">ทั้งหมด <span class="opacity-60 ml-1">${all.length}</span></button>`
      + CATS.map(slug => {
        const on = tab === slug;
        const hex = KS.CAT[slug].hex;
        return `<button type="button" role="tab" class="press shrink-0 h-11 px-5 rounded-full border text-sm font-bold flex items-center gap-2 ${on ? 'text-white border-transparent' : 'bg-white border-line hover:border-ink'}"
          style="${on ? `background:${hex}` : ''}" aria-selected="${on}" data-tab="${slug}"><span class="w-2.5 h-2.5 rounded-full" style="background:${on ? '#fff' : hex}"></span>${KS.CAT[slug].short}</button>`;
      }).join('');
    const list = (tab === 'all' ? all : all.filter(p => p.category.slug === tab)).slice(0, 8);
    $('#trend').innerHTML = list.map(p => `<div class="snap-start shrink-0 w-[70%] sm:w-[44%] md:w-[31%] lg:w-[23.5%]">${productCard(p)}</div>`).join('');
    $('#trend').scrollTo({ left: 0 });
    const a = $('#trend-all');
    a.href = tab === 'all' ? '/shop' : `/shop?category=${tab}`;
    a.innerHTML = `ดู${tab === 'all' ? 'หมวกทั้งหมด' : ' ' + KS.CAT[tab].label + ' ทั้งหมด'} ${KS.icon('arrow-right', 'w-4 h-4')}`;
  }
  $('#trend-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; renderTrend(); } });
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => {
    const t = $('#trend');
    t.scrollBy({ left: Number(b.dataset.scroll) * t.clientWidth * 0.8, behavior: 'smooth' });
  }));
  renderTrend();

  // ---- การ์ดหมวดหมู่สีทึบ พร้อมภาพหมวกสีขาว ----
  $('#categories').innerHTML = CATS.map(slug => {
    const cat = cats.find(c => c.slug === slug);
    const n = cat ? cat.product_count : count(slug);
    return `<a href="/shop?category=${slug}" class="press group relative aspect-square sm:aspect-[4/5] rounded-[2rem] overflow-hidden p-5 flex flex-col justify-between" style="background:${KS.CAT[slug].hex}">
      <span class="text-white/80 text-[11px] font-bold uppercase tracking-[.18em]">${n} styles</span>
      <svg viewBox="0 0 120 80" class="absolute right-[-8%] top-[22%] w-[78%] opacity-95 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" aria-hidden="true">${KS.hatShape(slug, 'rgba(255,255,255,.96)', 'rgba(17,19,24,.16)')}</svg>
      <span class="relative font-display font-bold uppercase text-white text-2xl sm:text-3xl tracking-tight flex items-center justify-between">${esc(KS.CAT[slug].short)} ${KS.icon('arrow-up-right', 'w-[22px] h-[22px]')}</span></a>`;
  }).join('');

  // ---- สินค้าที่เพิ่งดู: อ่านได้เฉพาะเมื่อยอมรับคุกกี้ Preferences ----
  function renderRecent() {
    const wrap = $('#recent-wrap');
    let list = [];
    if (KS.consent?.allowed('preferences')) { try { list = JSON.parse(localStorage.getItem('ks_recent')) || []; } catch { list = []; } }
    wrap.hidden = !list.length;
    $('#recent').innerHTML = list.map(r => {
      const p = all.find(x => x.slug === r.slug);
      return `<a href="/product-detail?slug=${encodeURIComponent(r.slug)}" class="card w-44 shrink-0 overflow-hidden hover:border-ink">
        <span class="block aspect-square" style="background:${KS.tint(p?.colors[0]?.hex || '#1D4ED8')}">${img(r.image_url, r.name, 'w-full h-full object-cover', { cat: p?.category.slug || 'caps', hex: p?.colors[0]?.hex })}</span>
        <span class="block p-3 text-xs font-bold truncate">${esc(r.name)}</span></a>`;
    }).join('');
  }
  renderRecent();
  document.addEventListener('consent:change', renderRecent);
})();
