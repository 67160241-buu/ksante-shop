// ============================================================================
// หน้าร้านค้า: ค้นหา + กรองตามหมวดหมู่ / ขนาด / สี / ช่วงราคา / มีสินค้า + เรียงลำดับ
// ตัวกรองทั้งหมดอยู่ใน URL (แชร์ลิงก์ได้ และกดย้อนกลับได้)
// ถ้าผู้ใช้ยอมรับคุกกี้ Preferences จะจำตัวกรองล่าสุดไว้ให้ครั้งหน้า
// ============================================================================
(async function () {
  const { $, $$, api, esc, productCard, skeletonCards, bindCards } = KS;
  const PREF_KEY = 'ks_pref_shop';
  const CAT_LABEL = { caps: 'Caps', 'bucket-hats': 'Bucket Hats', beanies: 'Beanies', berets: 'Berets' };
  const PRICES = [['', '', 'ทุกราคา'], ['0', '999', 'ต่ำกว่า ฿1,000'], ['1000', '1499', '฿1,000 - ฿1,499'], ['1500', '', '฿1,500 ขึ้นไป']];
  let facets = { colors: [], sizes: [] };
  let categories = [];

  // ---- state <-> URL ----
  function readState() {
    const p = new URLSearchParams(location.search);
    const list = k => (p.get(k) || '').split(',').map(s => s.trim()).filter(Boolean);
    return { q: p.get('q') || '', category: list('category'), size: list('size'), color: list('color'),
      min: p.get('min') || '', max: p.get('max') || '', in_stock: p.get('in_stock') === '1', sort: p.get('sort') || 'featured' };
  }
  function toQuery(s) {
    const p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.category.length) p.set('category', s.category.join(','));
    if (s.size.length) p.set('size', s.size.join(','));
    if (s.color.length) p.set('color', s.color.join(','));
    if (s.min) p.set('min', s.min);
    if (s.max) p.set('max', s.max);
    if (s.in_stock) p.set('in_stock', '1');
    if (s.sort && s.sort !== 'featured') p.set('sort', s.sort);
    return p.toString();
  }

  let state = readState();
  // ไม่มีพารามิเตอร์ใน URL -> ใช้ค่าที่จำไว้ (ต้องยอมรับ Preferences ก่อน)
  if (!location.search && KS.consent?.allowed('preferences')) {
    try { const saved = JSON.parse(localStorage.getItem(PREF_KEY)); if (saved) { state = { ...state, ...saved, q: '' }; history.replaceState(null, '', '?' + toQuery(state)); } } catch { /* ignore */ }
  }

  function update(patch, push = true) {
    state = { ...state, ...patch };
    const qs = toQuery(state);
    if (push) history.pushState(null, '', qs ? '?' + qs : location.pathname);
    if (KS.consent?.allowed('preferences')) {
      const { q, ...rest } = state;
      try { localStorage.setItem(PREF_KEY, JSON.stringify(rest)); } catch { /* ignore */ }
    }
    load();
  }

  const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  // ---- แผงตัวกรอง ----
  function filtersHtml() {
    const priceKey = `${state.min}-${state.max}`;
    return `
      <div><p class="eyebrow text-ink-soft mb-3">หมวดหมู่</p><div class="space-y-1">
        ${categories.map(c => `<label class="flex items-center gap-3 py-1.5 cursor-pointer text-sm font-semibold">
          <input type="checkbox" class="w-4 h-4 accent-ink" data-f="category" value="${esc(c.slug)}" ${state.category.includes(c.slug) ? 'checked' : ''}>
          <span class="flex-1">${esc(c.name)}</span><span class="text-xs text-ink-soft">${c.product_count}</span></label>`).join('')}
      </div></div>
      <div><p class="eyebrow text-ink-soft mb-3">ขนาด (รอบศีรษะ)</p><div class="grid grid-cols-4 gap-2">
        ${facets.sizes.map(s => `<button type="button" class="chip justify-center ${state.size.includes(s) ? 'chip-on' : ''}" data-f="size" data-v="${esc(s)}" aria-pressed="${state.size.includes(s)}">${esc(s)}</button>`).join('')}
      </div><p class="text-[11px] text-ink-soft mt-2">S 54-55 · M 56-57 · L 58-59 · XL 60-61 ซม.</p></div>
      <div><p class="eyebrow text-ink-soft mb-3">สี</p><div class="flex flex-wrap gap-2.5">
        ${facets.colors.map(c => `<button type="button" class="swatch" style="background:${esc(c.hex)}" data-f="color" data-v="${esc(c.name)}" aria-pressed="${state.color.includes(c.name)}" title="${esc(c.name)}" aria-label="สี ${esc(c.name)}"></button>`).join('')}
      </div></div>
      <div><p class="eyebrow text-ink-soft mb-3">ราคา</p><div class="space-y-1">
        ${PRICES.map(([mn, mx, label]) => `<label class="flex items-center gap-3 py-1.5 cursor-pointer text-sm font-semibold">
          <input type="radio" name="price-${Math.random().toString(36).slice(2, 6)}" class="w-4 h-4 accent-ink" data-f="price" data-min="${mn}" data-max="${mx}" ${priceKey === `${mn}-${mx}` ? 'checked' : ''}> ${label}</label>`).join('')}
      </div></div>
      <label class="flex items-center justify-between gap-3 text-sm font-semibold cursor-pointer">แสดงเฉพาะที่มีสินค้า
        <span class="switch"><input type="checkbox" data-f="in_stock" ${state.in_stock ? 'checked' : ''}><span></span></span></label>`;
  }

  function renderFilters() {
    $('#filters').innerHTML = filtersHtml();
    $('#filters-mobile').innerHTML = filtersHtml();
    // ชิปตัวกรองที่ใช้อยู่ (กดเพื่อลบ)
    const chips = [
      ...(state.q ? [['q', state.q, `"${state.q}"`]] : []),
      ...state.category.map(v => ['category', v, CAT_LABEL[v] || v]),
      ...state.size.map(v => ['size', v, `ไซซ์ ${v}`]),
      ...state.color.map(v => ['color', v, v]),
      ...(state.min || state.max ? [['price', '', PRICES.find(p => p[0] === state.min && p[1] === state.max)?.[2] || 'ช่วงราคา']] : []),
      ...(state.in_stock ? [['in_stock', '', 'มีสินค้า']] : []),
    ];
    $('#active-filters').innerHTML = chips.map(([k, v, label]) =>
      `<button class="chip chip-on" data-rm="${k}" data-v="${esc(v)}" aria-label="ลบตัวกรอง ${esc(label)}">${esc(label)} ${KS.icon('x', 'w-3.5 h-3.5')}</button>`).join('')
      + (chips.length > 1 ? '<button class="text-xs font-bold underline px-2" data-rm="all">ล้างทั้งหมด</button>' : '');
    $('#q').value = state.q;
    $('#sort').value = state.sort;
    const title = state.category.length === 1 ? CAT_LABEL[state.category[0]] || 'สินค้า' : state.q ? `ผลการค้นหา "${state.q}"` : 'สินค้าทั้งหมด';
    $('#shop-title').textContent = title;
    document.title = `${title} | K'Sante`;
  }

  function onFilter(e) {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    const f = el.dataset.f;
    if (f === 'category') update({ category: toggle(state.category, el.value) });
    if (f === 'size' || f === 'color') update({ [f]: toggle(state[f], el.dataset.v) });
    if (f === 'price') update({ min: el.dataset.min, max: el.dataset.max });
    if (f === 'in_stock') update({ in_stock: el.checked });
  }
  ['#filters', '#filters-mobile'].forEach(sel => {
    $(sel).addEventListener('change', e => { if (e.target.matches('input')) onFilter(e); });
    $(sel).addEventListener('click', e => { if (e.target.closest('button[data-f]')) onFilter(e); });
  });
  $('#active-filters').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const k = b.dataset.rm;
    if (k === 'all') return update({ q: '', category: [], size: [], color: [], min: '', max: '', in_stock: false });
    if (k === 'q') update({ q: '' });
    else if (k === 'price') update({ min: '', max: '' });
    else if (k === 'in_stock') update({ in_stock: false });
    else update({ [k]: state[k].filter(x => x !== b.dataset.v) });
  });
  $('#clear-all').addEventListener('click', () => update({ q: '', category: [], size: [], color: [], min: '', max: '', in_stock: false }));
  $('#sort').addEventListener('change', e => update({ sort: e.target.value }));
  $('#shop-search').addEventListener('submit', e => { e.preventDefault(); update({ q: $('#q').value.trim() }); });
  window.addEventListener('popstate', () => { state = readState(); load(); });

  const drawer = $('#filters-drawer');
  $('#filters-open').addEventListener('click', () => { drawer.hidden = false; });
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) drawer.hidden = true; });

  // ---- โหลดสินค้า ----
  let reqId = 0;
  async function load() {
    const my = ++reqId;
    renderFilters();
    $('#grid').innerHTML = skeletonCards(6);
    $('#empty').hidden = true;
    try {
      const qs = toQuery(state);
      const data = await api('/api/products' + (qs ? '?' + qs : ''));
      if (my !== reqId) return;               // มีคำขอใหม่กว่าแล้ว ไม่ต้องแสดงผลเก่า
      const firstFacets = !facets.colors.length;
      facets = data.facets;
      if (firstFacets) renderFilters();
      $('#grid').innerHTML = data.products.map(productCard).join('');
      $('#empty').hidden = data.products.length > 0;
      $('#shop-count').textContent = `${data.count} สินค้า`;
    } catch (err) {
      $('#grid').innerHTML = `<p class="col-span-full text-danger font-bold">${esc(err.message)}</p>`;
    }
  }

  bindCards($('#grid'));
  try { categories = (await api('/api/categories')).categories; } catch { categories = []; }
  load();
})();
