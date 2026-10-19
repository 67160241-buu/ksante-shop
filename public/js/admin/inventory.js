// ============================================================================
// จัดการสต็อก: แก้จำนวนแต่ละสี/ไซซ์ (หลายแถวพร้อมกัน) แล้วกดบันทึกครั้งเดียว
// แถบสี: แดง = หมด, เหลือง = ใกล้หมด (<= 5), เขียว = ปกติ
// ============================================================================
(async function () {
  const { $, $$, esc } = KS;
  let filter = KS.param('filter') || '';
  let variants = [];
  const dirty = new Map();     // id -> จำนวนใหม่

  function card(label, value, tone) {
    return `<div class="card p-4"><p class="text-xs font-bold text-ink-soft flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:${tone}"></span>${label}</p>
      <p class="font-display font-bold text-2xl mt-1 tabular">${Number(value || 0).toLocaleString()}</p></div>`;
  }

  async function load() {
    $$('#filter-tabs [data-filter]').forEach(b => b.classList.toggle('chip-on', b.dataset.filter === filter));
    const q = $('#q').value.trim();
    const d = await KS.admin.api(`/api/admin/inventory?filter=${filter}&q=${encodeURIComponent(q)}`);
    variants = d.variants;
    $('#summary').innerHTML = card('ตัวเลือกทั้งหมด', d.summary.variants, '#1D4ED8') + card('จำนวนชิ้นในคลัง', d.summary.units, '#10B981')
      + card('ใกล้หมด (1-5)', d.summary.low_stock, '#F59E0B') + card('หมดสต็อก', d.summary.out_of_stock, '#DC2626');
    render();
  }

  function render() {
    $('#rows').innerHTML = variants.map(v => {
      const qty = dirty.has(v.id) ? dirty.get(v.id) : v.stock_quantity;
      return `<tr data-id="${v.id}" class="${dirty.has(v.id) ? 'bg-cobalt-soft/50' : ''} ${qty === 0 ? 'border-l-4 border-l-danger' : qty <= 5 ? 'border-l-4 border-l-mustard' : ''}">
        <td class="p-3"><a href="/admin/product-form?id=${v.product_id}" class="font-bold hover:text-cobalt">${esc(v.product_name)}</a>
          <span class="block text-xs text-ink-soft">${esc(v.category_name)}${v.is_active ? '' : ' · ปิดขาย'}</span></td>
        <td class="p-3"><span class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border border-line" style="background:${esc(v.color_hex)}"></span>${esc(v.color_name)} / <b>${esc(v.size)}</b></span></td>
        <td class="p-3 text-xs tabular">${esc(v.sku)}</td>
        <td class="p-3"><div class="flex items-center gap-2">${KS.admin.stockBar(qty)}${KS.admin.stockPill(qty)}</div></td>
        <td class="p-3"><input type="number" min="0" max="100000" class="input h-9 w-24 tabular font-bold" value="${qty}" data-qty aria-label="จำนวนสต็อก ${esc(v.sku)}"></td>
        <td class="p-3 whitespace-nowrap"><button class="btn btn-ghost btn-sm border border-line px-3" data-add="-1" aria-label="ลด 1">−1</button>
          <button class="btn btn-ghost btn-sm border border-line px-3" data-add="1" aria-label="เพิ่ม 1">+1</button>
          <button class="btn btn-ghost btn-sm border border-line px-3" data-add="10" aria-label="เพิ่ม 10">+10</button></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="p-8 text-center text-ink-soft">ไม่พบรายการ</td></tr>';
    $('#savebar').hidden = !dirty.size;
    $('#dirty-count').innerHTML = `แก้ไข ${dirty.size} รายการ<span class="hidden sm:inline"> (ยังไม่บันทึก)</span>`;
  }

  function setQty(id, n) {
    const v = variants.find(x => x.id === id);
    n = Math.max(0, Math.min(100000, Math.round(Number(n) || 0)));
    if (n === v.stock_quantity) dirty.delete(id); else dirty.set(id, n);
    render();
  }
  $('#rows').addEventListener('change', e => { if (e.target.matches('[data-qty]')) setQty(Number(e.target.closest('[data-id]').dataset.id), e.target.value); });
  $('#rows').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = Number(b.closest('[data-id]').dataset.id);
    const cur = dirty.has(id) ? dirty.get(id) : variants.find(x => x.id === id).stock_quantity;
    setQty(id, cur + Number(b.dataset.add));
  });
  $('#discard').addEventListener('click', () => { dirty.clear(); render(); });
  $('#save').addEventListener('click', async () => {
    const btn = $('#save');
    KS.busy(btn, true, 'กำลังบันทึก...');
    try {
      const { updated } = await KS.admin.api('/api/admin/inventory', { method: 'PATCH', body: { updates: [...dirty].map(([id, stock_quantity]) => ({ id, stock_quantity })) } });
      dirty.clear();
      KS.toast(`บันทึกสต็อกแล้ว ${updated} รายการ`, 'success');
      await load();
    } catch (err) { KS.toast(err.message, 'error'); }
    finally { KS.busy(btn, false); }
  });
  $('#filter-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    if (dirty.size && !confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่?')) return;
    dirty.clear(); filter = b.dataset.filter;
    history.replaceState(null, '', filter ? `?filter=${filter}` : location.pathname);
    load();
  });
  let t;
  $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (!dirty.size) load(); }, 250); });
  window.addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } });
  try { await load(); } catch (err) { KS.toast(err.message, 'error'); }
})();
