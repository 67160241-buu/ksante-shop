// ============================================================================
// ฟอร์มเพิ่ม/แก้ไขสินค้า (/admin/product-form หรือ ?id=)
// ตัวเลือกสี x ขนาดแก้ได้ในตาราง: แถวใหม่ = เพิ่ม, แถวที่ลบ = ลบ, แถวเดิม = อัปเดต (บันทึกทั้งหมดแบบ Atomic)
// ============================================================================
(async function () {
  const { $, $$, esc } = KS;
  const form = $('#product-form');
  const id = Number(KS.param('id')) || null;
  const SIZES = ['S', 'M', 'L', 'XL'];
  let rows = [];         // { id?, color_name, color_hex, size, sku, stock_quantity, image_url }

  const { categories } = await KS.admin.api('/api/admin/categories');
  form.category_id.innerHTML = categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  function renderRows() {
    $('#variants').innerHTML = rows.map((r, i) => `<tr data-i="${i}" class="border-t border-line">
      <td class="p-1.5"><input class="input h-9 w-28" data-k="color_name" value="${esc(r.color_name)}" placeholder="Cobalt" aria-label="ชื่อสี แถว ${i + 1}"></td>
      <td class="p-1.5"><div class="flex items-center gap-1"><input type="color" class="w-9 h-9 rounded-lg border border-line p-0.5" data-k="color_hex" value="${esc(r.color_hex)}" aria-label="เลือกสี แถว ${i + 1}">
        <span class="text-[11px] text-ink-soft tabular w-14">${esc(r.color_hex)}</span></div></td>
      <td class="p-1.5"><input class="input h-9 w-16 uppercase" data-k="size" value="${esc(r.size)}" list="size-list" aria-label="ไซซ์ แถว ${i + 1}"></td>
      <td class="p-1.5"><input class="input h-9 w-44 uppercase" data-k="sku" value="${esc(r.sku || '')}" aria-label="SKU แถว ${i + 1}"></td>
      <td class="p-1.5"><div class="flex items-center gap-2"><input class="input h-9 w-20 tabular" type="number" min="0" data-k="stock_quantity" value="${r.stock_quantity}" aria-label="สต็อก แถว ${i + 1}">
        ${KS.admin.stockPill(Number(r.stock_quantity) || 0)}</div></td>
      <td class="p-1.5"><input class="input h-9 w-56" data-k="image_url" value="${esc(r.image_url || '')}" placeholder="ใช้รูปหลักถ้าเว้นว่าง" aria-label="URL รูป แถว ${i + 1}"></td>
      <td class="p-1.5"><button type="button" class="icon-btn w-8 h-8 text-danger" data-remove aria-label="ลบแถว ${i + 1}">${KS.icon('trash2', 'w-4 h-4')}</button></td></tr>`).join('')
      + `<datalist id="size-list">${SIZES.map(s => `<option value="${s}">`).join('')}</datalist>`;
    if (!rows.length) $('#variants').innerHTML = '<tr><td colspan="7" class="p-6 text-center text-ink-soft">ยังไม่มีตัวเลือก กด "สร้างสีใหม่ครบ 4 ไซซ์" เพื่อเริ่ม</td></tr>';
    $('#total-stock').textContent = rows.reduce((s, r) => s + (Number(r.stock_quantity) || 0), 0);
  }

  $('#variants').addEventListener('input', e => {
    const tr = e.target.closest('[data-i]');
    const k = e.target.dataset.k;
    if (!tr || !k) return;
    const r = rows[Number(tr.dataset.i)];
    r[k] = k === 'stock_quantity' ? e.target.value : e.target.value;
    if (k === 'color_hex') e.target.nextElementSibling.textContent = e.target.value.toUpperCase();
    if (k === 'stock_quantity') $('#total-stock').textContent = rows.reduce((s, x) => s + (Number(x.stock_quantity) || 0), 0);
  });
  $('#variants').addEventListener('change', e => { if (e.target.dataset.k === 'stock_quantity') renderRows(); });
  $('#variants').addEventListener('click', e => {
    if (!e.target.closest('[data-remove]')) return;
    rows.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
    renderRows();
  });
  $('#add-variant').addEventListener('click', () => {
    const last = rows[rows.length - 1];
    rows.push({ color_name: last?.color_name || '', color_hex: last?.color_hex || '#1D4ED8', size: '', sku: '', stock_quantity: 0, image_url: last?.image_url || '' });
    renderRows();
  });
  $('#gen-variants').addEventListener('click', () => {
    const name = prompt('ชื่อสีใหม่ (เช่น Cobalt)');
    if (!name) return;
    const hex = (prompt('รหัสสี #RRGGBB', '#1D4ED8') || '#1D4ED8').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) return KS.toast('รหัสสีต้องเป็นรูปแบบ #RRGGBB', 'error');
    for (const s of SIZES) if (!rows.some(r => r.color_name.toLowerCase() === name.toLowerCase() && r.size === s)) rows.push({ color_name: name, color_hex: hex, size: s, sku: '', stock_quantity: 10, image_url: '' });
    renderRows();
  });

  form.image_url.addEventListener('input', () => { $('#preview').src = form.image_url.value || '/img/hat-fallback.svg'; });

  // โหลดข้อมูลเดิม (โหมดแก้ไข)
  if (id) {
    try {
      const { product: p } = await KS.admin.api(`/api/admin/products/${id}`);
      $('#form-title').textContent = `แก้ไข: ${p.name}`;
      document.title = `แก้ไข ${p.name} | K'Sante Admin`;
      form.name.value = p.name; form.slug.value = p.slug; form.category_id.value = p.category.id; form.base_price.value = p.price;
      form.material.value = p.material; form.description.value = p.description; form.image_url.value = p.image_url; form.is_active.checked = p.is_active;
      $('#preview').src = p.image_url;
      rows = p.variants.map(v => ({ id: v.id, color_name: v.color_name, color_hex: v.color_hex, size: v.size, sku: v.sku, stock_quantity: v.stock, image_url: v.image_url === p.image_url ? '' : v.image_url }));
      $('#delete').hidden = false;
    } catch (err) { KS.toast(err.message, 'error'); }
  } else {
    rows = SIZES.map(s => ({ color_name: 'Cobalt', color_hex: '#1D4ED8', size: s, sku: '', stock_quantity: 10, image_url: '' }));
  }
  renderRows();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#save');
    KS.formError($('#form-error'), '');
    if (!form.name.value.trim() || !form.base_price.value || !form.image_url.value.trim()) return KS.formError($('#form-error'), 'กรุณากรอกชื่อ ราคา และ URL รูปภาพหลัก');
    KS.busy(btn, true, 'กำลังบันทึก...');
    const body = {
      name: form.name.value.trim(), slug: form.slug.value.trim(), category_id: Number(form.category_id.value), base_price: Number(form.base_price.value),
      material: form.material.value.trim(), description: form.description.value.trim(), image_url: form.image_url.value.trim(), is_active: form.is_active.checked,
      variants: rows.map(r => ({ ...r, stock_quantity: Number(r.stock_quantity) || 0 })),
    };
    try {
      const { product } = await KS.admin.api(id ? `/api/admin/products/${id}` : '/api/admin/products', { method: id ? 'PUT' : 'POST', body });
      KS.toast('บันทึกสินค้าแล้ว', 'success');
      if (!id) location.replace(`/admin/product-form?id=${product.id}`);
      else { KS.busy(btn, false); rows = product.variants.map(v => ({ id: v.id, color_name: v.color_name, color_hex: v.color_hex, size: v.size, sku: v.sku, stock_quantity: v.stock, image_url: v.image_url === product.image_url ? '' : v.image_url })); renderRows(); form.slug.value = product.slug; }
    } catch (err) { KS.busy(btn, false); KS.formError($('#form-error'), err.message); }
  });

  $('#delete').addEventListener('click', async () => {
    if (!confirm('ลบสินค้านี้และตัวเลือกทั้งหมด? ประวัติคำสั่งซื้อเดิมจะยังอยู่')) return;
    try { await KS.admin.api(`/api/admin/products/${id}`, { method: 'DELETE' }); location.replace('/admin/products'); }
    catch (err) { KS.toast(err.message, 'error'); }
  });
})();
