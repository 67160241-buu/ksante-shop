// ============================================================================
// หน้ารายละเอียดสินค้า (/product-detail?slug=...)
// - กด swatch สี -> รูปหลักเปลี่ยน และสต็อกของแต่ละไซซ์อัปเดตตามสีนั้น
// - ไซซ์ที่หมดจะกดไม่ได้, จำนวนที่เลือกถูกจำกัดตามสต็อกจริง
// - ตารางสี x ไซซ์ แสดงสต็อกครบทุกตัวเลือก + Size Guide (cm / inch)
// ============================================================================
(async function () {
  const { $, $$, api, esc, img, fmt, productCard, bindCards } = KS;
  const root = $('#product-root');
  const slug = KS.param('slug');
  const LOW = 5;

  const guide = $('#size-guide');
  const openGuide = () => { guide.hidden = false; guide.querySelector('[data-close].icon-btn')?.focus(); };
  guide.addEventListener('click', e => { if (e.target.closest('[data-close]')) guide.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') guide.hidden = true; });

  if (!slug) { location.replace('/shop'); return; }

  let data;
  try {
    data = await api(`/api/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    root.innerHTML = `<div class="text-center py-20"><p class="font-display font-bold text-2xl">${esc(err.message)}</p><a href="/shop" class="btn btn-primary mt-6">กลับไปหน้าร้านค้า</a></div>`;
    return;
  }
  const p = data.product;
  document.title = `${p.name} | K'Sante`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', p.description.slice(0, 150));

  // เลือกสีแรกที่ยังมีของเป็นค่าเริ่มต้น
  // สีเริ่มต้น: สีที่เลือกมาจากการ์ดสินค้า (?color=) ถ้ายังมีของ ไม่งั้นสีแรกที่มีของ
  let color = (p.colors.find(c => c.name === KS.param('color') && c.stock > 0) || p.colors.find(c => c.stock > 0) || p.colors[0]).name;
  let size = null;
  let qty = 1;
  const variant = () => p.variants.find(v => v.color_name === color && v.size === size);
  const stockOf = (c, s) => p.variants.find(v => v.color_name === c && v.size === s)?.stock ?? 0;

  root.innerHTML = `
    <nav class="text-xs text-ink-soft" aria-label="breadcrumb"><a href="/" class="hover:text-ink">หน้าแรก</a> /
      <a href="/shop?category=${encodeURIComponent(p.category.slug)}" class="hover:text-ink">${esc(p.category.name)}</a> / <span class="text-ink font-bold">${esc(p.name)}</span></nav>
    <div class="grid lg:grid-cols-2 gap-10 mt-4">
      <div>
        <div id="main-wrap" class="relative aspect-square rounded-[2.25rem] overflow-hidden bg-mist">
          <div id="main-img" class="w-full h-full"></div>
          <span id="img-color" class="pill absolute top-4 left-4 bg-white/95"></span>
        </div>
        <div id="thumbs" class="grid grid-cols-4 gap-3 mt-3"></div>
      </div>
      <div>
        <p class="eyebrow text-cobalt">${esc(p.category.name)}</p>
        <h1 class="font-display font-bold text-4xl mt-2 leading-tight">${esc(p.name)}</h1>
        <p class="font-display font-bold text-3xl mt-3 tabular">${fmt.money(p.price)}</p>

        <div class="mt-6"><div class="flex justify-between"><p class="text-sm font-bold">สี: <span id="color-name"></span></p></div>
          <div id="swatches" class="flex flex-wrap gap-3 mt-3" role="group" aria-label="เลือกสี"></div></div>

        <div class="mt-6"><div class="flex items-center justify-between"><p class="text-sm font-bold">ไซซ์ (รอบศีรษะ)</p>
          <button type="button" id="open-guide" class="text-xs font-bold underline underline-offset-4 flex items-center gap-1">${KS.icon('ruler', 'w-3.5 h-3.5')} Size Guide</button></div>
          <div id="sizes" class="grid grid-cols-4 gap-2 mt-3" role="group" aria-label="เลือกไซซ์"></div>
          <p id="stock-line" class="text-sm font-semibold mt-3 min-h-5" aria-live="polite"></p></div>

        <div class="flex items-center gap-3 mt-6">
          <div class="inline-flex items-center h-12 rounded-full border-2 border-ink bg-white">
            <button type="button" id="dec" class="w-11 h-full grid place-items-center disabled:opacity-30" aria-label="ลดจำนวน">${KS.icon('minus', 'w-4 h-4')}</button>
            <span id="qty" class="w-8 text-center font-bold tabular" aria-live="polite">1</span>
            <button type="button" id="inc" class="w-11 h-full grid place-items-center disabled:opacity-30" aria-label="เพิ่มจำนวน">${KS.icon('plus', 'w-4 h-4')}</button>
          </div>
          <button type="button" id="add" class="btn btn-primary h-12 flex-1">${KS.icon('shopping-bag', 'w-4 h-4')} ใส่ตะกร้า</button>
        </div>
        <button type="button" id="buy" class="btn btn-tangerine h-12 w-full mt-3">ซื้อเลย</button>

        <div class="mt-8 divide-y divide-line border-y border-line">
          <details class="py-4 group" open><summary class="font-bold cursor-pointer flex justify-between items-center list-none">รายละเอียดสินค้า <span class="group-open:rotate-180 transition">${KS.icon('chevron-down', 'w-4 h-4')}</span></summary>
            <p class="text-sm text-ink-soft mt-3 leading-relaxed">${esc(p.description)}</p></details>
          <details class="py-4 group" open><summary class="font-bold cursor-pointer flex justify-between items-center list-none">เนื้อผ้าและการดูแล <span class="group-open:rotate-180 transition">${KS.icon('chevron-down', 'w-4 h-4')}</span></summary>
            <dl class="text-sm mt-3 grid grid-cols-[110px_1fr] gap-y-2"><dt class="text-ink-soft">วัสดุ</dt><dd class="font-semibold">${esc(p.material)}</dd>
              <dt class="text-ink-soft">การดูแล</dt><dd class="font-semibold">ซักมือด้วยน้ำเย็น ห้ามบิด ผึ่งในที่ร่ม คงรูปทรงขณะตาก</dd>
              <dt class="text-ink-soft">สต็อกรวม</dt><dd class="font-semibold">${p.stock} ชิ้น</dd></dl></details>
          <details class="py-4 group" open><summary class="font-bold cursor-pointer flex justify-between items-center list-none">ตารางสีและสต็อก <span class="group-open:rotate-180 transition">${KS.icon('chevron-down', 'w-4 h-4')}</span></summary>
            <div class="overflow-x-auto mt-3"><table class="w-full text-sm" id="color-table"></table></div></details>
        </div>
      </div>
    </div>
    ${data.related.length ? `<section class="mt-20" aria-labelledby="rel-title"><h2 id="rel-title" class="font-display font-bold text-2xl">สินค้าในหมวดเดียวกัน</h2>
      <div id="related" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">${data.related.map(productCard).join('')}</div></section>` : ''}`;

  $('#open-guide').addEventListener('click', openGuide);
  if (location.hash === '#size-guide') openGuide();
  if ($('#related')) bindCards($('#related'));

  // ตารางสี x ไซซ์
  $('#color-table').innerHTML = `<thead><tr class="bg-mist"><th class="p-2.5 text-left rounded-l-xl">สี</th>${p.sizes.map((s, i) => `<th class="p-2.5 text-center ${i === p.sizes.length - 1 ? 'rounded-r-xl' : ''}">${esc(s)}</th>`).join('')}</tr></thead>
    <tbody class="divide-y divide-line">${p.colors.map(c => `<tr><td class="p-2.5"><span class="flex items-center gap-2 font-semibold"><span class="w-4 h-4 rounded-full border border-line" style="background:${esc(c.hex)}"></span>${esc(c.name)}
      <span class="text-[11px] text-ink-soft font-normal">${esc(c.hex)}</span></span></td>
      ${p.sizes.map(s => { const n = stockOf(c.name, s); return `<td class="p-2.5 text-center tabular font-bold ${n === 0 ? 'text-danger' : n <= LOW ? 'text-[#8A5300]' : 'text-sage'}">${n === 0 ? 'หมด' : n}</td>`; }).join('')}</tr>`).join('')}</tbody>`;

  function render() {
    const c = p.colors.find(x => x.name === color);
    $('#main-img').innerHTML = img(c.image_url, `${p.name} สี ${c.name}`, 'w-full h-full object-cover fade-in', { cat: p.category.slug, hex: c.hex });
    $('#main-wrap').style.background = KS.tint(c.hex);
    $('#img-color').innerHTML = `<span class="w-3 h-3 rounded-full" style="background:${esc(c.hex)}"></span>${esc(c.name)}`;
    $('#color-name').textContent = c.name;
    $('#thumbs').innerHTML = p.colors.map(x => `<button type="button" class="press aspect-square rounded-2xl overflow-hidden border-2 ${x.name === color ? 'border-ink' : 'border-transparent hover:border-line'}" style="background:${KS.tint(x.hex)}" data-color="${esc(x.name)}" aria-label="ดูรูปสี ${esc(x.name)}">${img(x.image_url, x.name, 'w-full h-full object-cover', { cat: p.category.slug, hex: x.hex })}</button>`).join('');
    $('#swatches').innerHTML = p.colors.map(x => `<button type="button" class="swatch w-9 h-9 relative" style="background:${esc(x.hex)};width:36px;height:36px" data-color="${esc(x.name)}" aria-pressed="${x.name === color}" title="${esc(x.name)}" aria-label="สี ${esc(x.name)}${x.stock === 0 ? ' (หมด)' : ''}">
      ${x.stock === 0 ? '<span class="absolute inset-0 grid place-items-center"><span class="block w-full h-0.5 bg-danger rotate-45"></span></span>' : ''}</button>`).join('');
    $('#sizes').innerHTML = p.sizes.map(s => {
      const n = stockOf(color, s);
      return `<button type="button" class="h-14 rounded-xl border-2 text-sm font-bold flex flex-col items-center justify-center transition
        ${s === size ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'} disabled:opacity-35 disabled:line-through disabled:hover:border-line"
        data-size="${esc(s)}" ${n === 0 ? 'disabled' : ''} aria-pressed="${s === size}">${esc(s)}
        <span class="text-[10px] font-semibold ${s === size ? 'text-white/70' : n <= LOW ? 'text-[#8A5300]' : 'text-ink-soft'}">${n === 0 ? 'หมด' : n <= LOW ? `เหลือ ${n}` : 'มีสินค้า'}</span></button>`;
    }).join('');

    const v = variant();
    const line = $('#stock-line');
    if (!size) line.innerHTML = '<span class="text-ink-soft">กรุณาเลือกไซซ์</span>';
    else if (v.stock <= LOW) line.innerHTML = `<span class="text-[#8A5300] flex items-center gap-1.5">${KS.icon('triangle-alert', 'w-4 h-4')} ใกล้หมด เหลือเพียง ${v.stock} ชิ้น</span>`;
    else line.innerHTML = `<span class="text-sage flex items-center gap-1.5">${KS.icon('circle-check', 'w-4 h-4')} มีสินค้าพร้อมส่ง (${v.stock} ชิ้น) · SKU ${esc(v.sku)}</span>`;

    const max = v ? Math.min(v.stock, 20) : 1;
    qty = Math.min(Math.max(qty, 1), Math.max(max, 1));
    $('#qty').textContent = qty;
    $('#dec').disabled = qty <= 1;
    $('#inc').disabled = !v || qty >= max;
    $('#add').disabled = $('#buy').disabled = !p.stock;
  }

  root.addEventListener('click', e => {
    const c = e.target.closest('[data-color]');
    if (c) {
      color = c.dataset.color;
      if (size && stockOf(color, size) === 0) size = null;   // ไซซ์เดิมหมดในสีใหม่ -> ให้เลือกใหม่
      render();
    }
    const s = e.target.closest('[data-size]');
    if (s && !s.disabled) { size = s.dataset.size; render(); }
  });
  $('#dec').addEventListener('click', () => { qty--; render(); });
  $('#inc').addEventListener('click', () => { qty++; render(); });

  function addToCart() {
    if (!size) {
      KS.toast('กรุณาเลือกไซซ์ก่อน', 'error');
      $('#sizes').classList.add('animate-pulse');
      setTimeout(() => $('#sizes').classList.remove('animate-pulse'), 900);
      return false;
    }
    const ok = KS.cart.add(p, variant(), qty);
    if (ok) KS.toast(`เพิ่ม ${p.name} (${color} / ${size}) ลงตะกร้าแล้ว`, 'success');
    return ok;
  }
  $('#add').addEventListener('click', () => { if (addToCart()) KS.cart.open(); });
  $('#buy').addEventListener('click', () => { if (addToCart()) location.href = '/checkout'; });

  render();

  // จำสินค้าที่เพิ่งดู (เฉพาะเมื่อยอมรับคุกกี้ Preferences)
  if (KS.consent?.allowed('preferences')) {
    try {
      const list = (JSON.parse(localStorage.getItem('ks_recent')) || []).filter(r => r.slug !== p.slug);
      list.unshift({ slug: p.slug, name: p.name, image_url: p.image_url });
      localStorage.setItem('ks_recent', JSON.stringify(list.slice(0, 8)));
    } catch { /* ignore */ }
  }
})();
