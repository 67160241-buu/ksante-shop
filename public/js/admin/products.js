// รายการสินค้า (ค้นหา/กรอง/ลบ) + จัดการหมวดหมู่ (เพิ่ม/เปลี่ยนชื่อ/ลบ)
(async function () {
  const { $, esc, fmt, img } = KS;
  let products = [];
  let categories = [];

  async function loadCats() {
    ({ categories } = await KS.admin.api('/api/admin/categories'));
    const sel = $('#cat-filter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    sel.value = cur;
    $('#cats').innerHTML = categories.map(c => `<li class="py-2.5 flex items-center gap-2" data-cat="${c.id}">
      <span class="flex-1"><b>${esc(c.name)}</b> <span class="text-xs text-ink-soft">/${esc(c.slug)} · ${c.product_count} สินค้า</span></span>
      <button class="icon-btn w-8 h-8" data-rename aria-label="เปลี่ยนชื่อ ${esc(c.name)}">${KS.icon('pencil', 'w-4 h-4')}</button>
      <button class="icon-btn w-8 h-8 text-danger disabled:opacity-30" data-del ${c.product_count ? 'disabled title="มีสินค้าอยู่ ลบไม่ได้"' : ''} aria-label="ลบ ${esc(c.name)}">${KS.icon('trash2', 'w-4 h-4')}</button></li>`).join('');
  }

  async function loadProducts() {
    const q = $('#q').value.trim();
    const cat = $('#cat-filter').value;
    $('#rows').innerHTML = '<tr><td colspan="7" class="p-8 text-center text-ink-soft">กำลังโหลด...</td></tr>';
    ({ products } = await KS.admin.api(`/api/admin/products?q=${encodeURIComponent(q)}&category_id=${encodeURIComponent(cat)}`));
    $('#rows').innerHTML = products.map(p => {
      const low = p.variants.filter(v => v.stock <= 5).length;
      return `<tr class="hover:bg-mist/40">
        <td class="p-3"><div class="flex items-center gap-3"><span class="w-12 h-12 rounded-xl overflow-hidden bg-mist shrink-0">${img(p.image_url, p.name, 'w-full h-full object-cover')}</span>
          <span><a href="/admin/product-form?id=${p.id}" class="font-bold hover:text-cobalt">${esc(p.name)}</a><span class="block text-xs text-ink-soft">/${esc(p.slug)}</span></span></div></td>
        <td class="p-3">${esc(p.category.name)}</td>
        <td class="p-3 text-right font-bold tabular">${fmt.money(p.price)}</td>
        <td class="p-3"><div class="flex items-center gap-2">${KS.admin.stockBar(p.stock, 200)}<span class="tabular font-bold">${p.stock}</span></div>
          ${low ? `<span class="text-[11px] font-bold text-[#8A5300]">${low} ตัวเลือกใกล้หมด/หมด</span>` : ''}</td>
        <td class="p-3"><div class="flex -space-x-1">${p.colors.map(c => `<span class="w-4 h-4 rounded-full border-2 border-white" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join('')}</div>
          <span class="text-[11px] text-ink-soft">${p.variants.length} ตัวเลือก</span></td>
        <td class="p-3">${p.is_active ? '<span class="rounded-full bg-sage-soft text-[#06704D] text-[11px] font-bold px-2 py-0.5">เปิดขาย</span>' : '<span class="rounded-full bg-mist text-ink-soft text-[11px] font-bold px-2 py-0.5">ปิดขาย</span>'}</td>
        <td class="p-3 text-right whitespace-nowrap"><a href="/admin/product-form?id=${p.id}" class="icon-btn w-8 h-8" aria-label="แก้ไข ${esc(p.name)}">${KS.icon('pencil', 'w-4 h-4')}</a>
          <button class="icon-btn w-8 h-8 text-danger" data-delete="${p.id}" aria-label="ลบ ${esc(p.name)}">${KS.icon('trash2', 'w-4 h-4')}</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="p-8 text-center text-ink-soft">ไม่พบสินค้า</td></tr>';
  }

  $('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-delete]');
    if (!b) return;
    const p = products.find(x => x.id === Number(b.dataset.delete));
    if (!confirm(`ลบสินค้า "${p.name}" และตัวเลือกทั้งหมด ${p.variants.length} รายการ?\nประวัติคำสั่งซื้อเดิมจะยังอยู่ แต่จะไม่ลิงก์กับสินค้านี้แล้ว\n(ถ้าแค่ต้องการหยุดขาย ให้ปิด "เปิดขาย" ในหน้าแก้ไขแทน)`)) return;
    try { await KS.admin.api(`/api/admin/products/${p.id}`, { method: 'DELETE' }); KS.toast('ลบสินค้าแล้ว', 'success'); loadProducts(); loadCats(); }
    catch (err) { KS.toast(err.message, 'error'); }
  });

  $('#cats').addEventListener('click', async e => {
    const li = e.target.closest('[data-cat]');
    if (!li) return;
    const c = categories.find(x => x.id === Number(li.dataset.cat));
    try {
      if (e.target.closest('[data-rename]')) {
        const name = prompt('ชื่อหมวดหมู่ใหม่', c.name);
        if (!name || name === c.name) return;
        const slug = prompt('slug (ใช้ใน URL เช่น caps)', c.slug);
        if (slug === null) return;
        await KS.admin.api(`/api/admin/categories/${c.id}`, { method: 'PUT', body: { name, slug } });
        KS.toast('บันทึกหมวดหมู่แล้ว', 'success');
      } else if (e.target.closest('[data-del]')) {
        if (!confirm(`ลบหมวดหมู่ "${c.name}"?`)) return;
        await KS.admin.api(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
        KS.toast('ลบหมวดหมู่แล้ว', 'success');
      } else return;
      await loadCats(); loadProducts();
    } catch (err) { KS.toast(err.message, 'error'); }
  });

  $('#cat-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await KS.admin.api('/api/admin/categories', { method: 'POST', body: { name: e.target.name.value.trim() } });
      e.target.reset(); KS.toast('เพิ่มหมวดหมู่แล้ว', 'success'); loadCats();
    } catch (err) { KS.toast(err.message, 'error'); }
  });

  let t;
  $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadProducts, 250); });
  $('#cat-filter').addEventListener('change', loadProducts);
  try { await loadCats(); await loadProducts(); } catch (err) { KS.toast(err.message, 'error'); }
})();
