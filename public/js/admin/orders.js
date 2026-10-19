// ============================================================================
// จัดการคำสั่งซื้อ: แท็บกรองสถานะ, ค้นหา, เปิดรายละเอียด, อัปเดตสถานะ + เลขพัสดุ
// กติกาสถานะ (ตรวจซ้ำที่เซิร์ฟเวอร์): เดินหน้าอย่างเดียว, Shipped ต้องมีเลขพัสดุ,
// ยกเลิกได้ก่อนส่งของ และระบบคืนสต็อกให้อัตโนมัติ
// ============================================================================
(async function () {
  const { $, esc, fmt, img } = KS;
  const params = new URLSearchParams(location.search);
  let state = { status: params.get('status') || '', q: params.get('q') || '', page: 1 };
  const FLOW = KS.FLOW;
  const drawer = $('#drawer');
  $('#search').q.value = state.q;

  async function load() {
    const qs = new URLSearchParams({ ...(state.status && { status: state.status }), ...(state.q && { q: state.q }), page: state.page });
    history.replaceState(null, '', '?' + new URLSearchParams({ ...(state.status && { status: state.status }), ...(state.q && { q: state.q }) }));
    $('#rows').innerHTML = '<tr><td colspan="7" class="p-8 text-center text-ink-soft">กำลังโหลด...</td></tr>';
    let d;
    try { d = await KS.admin.api('/api/admin/orders?' + qs); } catch (err) { KS.toast(err.message, 'error'); return; }
    const all = Object.values(d.status_counts).reduce((a, b) => a + b, 0);
    $('#status-tabs').innerHTML = [['', 'ทั้งหมด', all], ...Object.keys(KS.STATUS).map(s => [s, `${s} · ${KS.STATUS[s].th}`, d.status_counts[s] || 0])]
      .map(([s, label, n]) => `<button class="chip shrink-0 ${state.status === s ? 'chip-on' : ''}" data-status="${s}">${s ? `<span class="w-2 h-2 rounded-full" style="background:${KS.STATUS[s].dot}"></span>` : ''}${label}
        <span class="rounded-full ${state.status === s ? 'bg-white/20' : 'bg-mist'} px-1.5 tabular">${n}</span></button>`).join('');
    $('#rows').innerHTML = d.orders.map(o => `<tr class="hover:bg-mist/40 cursor-pointer" data-open="${o.id}" tabindex="0">
      <td class="p-3 font-bold tabular">${esc(o.order_number)}</td>
      <td class="p-3"><span class="font-semibold">${esc(o.customer_name)}</span><span class="block text-xs text-ink-soft">${esc(o.phone)} · ${o.user_id ? 'สมาชิก' : 'ลูกค้าทั่วไป'}</span></td>
      <td class="p-3 text-xs text-ink-soft whitespace-nowrap">${fmt.datetime(o.created_at)}</td>
      <td class="p-3 text-xs">${{ promptpay: 'PromptPay', bank_transfer: 'โอนธนาคาร', cod: 'ปลายทาง' }[o.payment_method]}</td>
      <td class="p-3 text-right font-bold tabular">${fmt.money(o.total_amount)}<span class="block text-[11px] text-ink-soft font-normal">${o.item_count} ชิ้น</span></td>
      <td class="p-3">${KS.badge(o.status)}</td><td class="p-3 text-xs tabular">${esc(o.tracking_number || '-')}</td></tr>`).join('')
      || '<tr><td colspan="7" class="p-8 text-center text-ink-soft">ไม่พบคำสั่งซื้อ</td></tr>';
    $('#pager').innerHTML = `<span class="text-ink-soft">ทั้งหมด ${d.total} รายการ · หน้า ${d.page}/${d.pages}</span>
      <span class="flex gap-2"><button class="btn btn-outline btn-sm" data-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>${KS.icon('chevron-left', 'w-4 h-4')} ก่อนหน้า</button>
      <button class="btn btn-outline btn-sm" data-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>ถัดไป ${KS.icon('chevron-right', 'w-4 h-4')}</button></span>`;
  }

  /** สถานะที่เลือกได้จากสถานะปัจจุบัน (ตรงกับกติกาฝั่งเซิร์ฟเวอร์) */
  function nextOptions(cur) {
    if (cur === 'Completed' || cur === 'Cancelled') return [cur];
    const fwd = FLOW.slice(FLOW.indexOf(cur));
    return ['Pending', 'Confirmed', 'Packing'].includes(cur) ? [...fwd, 'Cancelled'] : fwd;
  }

  async function openOrder(id) {
    drawer.hidden = false;
    $('#detail').innerHTML = '<div class="p-8"><div class="h-8 w-1/2 rounded skeleton"></div><div class="h-40 rounded skeleton mt-4"></div></div>';
    let o;
    try { ({ order: o } = await KS.admin.api(`/api/admin/orders/${id}`)); } catch (err) { $('#detail').innerHTML = `<p class="p-8 text-danger font-bold">${esc(err.message)}</p>`; return; }
    const a = o.shipping_address;
    const final = o.status === 'Completed' || o.status === 'Cancelled';
    $('#detail').innerHTML = `
      <div class="sticky top-0 bg-white border-b border-line px-6 h-16 flex items-center justify-between z-10">
        <div><p class="font-display font-bold text-lg tabular">${esc(o.order_number)}</p><p class="text-[11px] text-ink-soft">${fmt.datetime(o.created_at)}</p></div>
        <button class="icon-btn" data-close aria-label="ปิด">${KS.icon('x')}</button></div>
      <div class="p-6 space-y-5">
        <div class="flex flex-wrap items-center gap-2">${KS.badge(o.status)}<span class="text-xs text-ink-soft">${esc(o.payment_label)}</span></div>
        <div class="card p-4 overflow-x-auto"><div class="min-w-[440px]">${KS.timeline(o)}</div></div>

        <form id="status-form" class="card-block p-5 space-y-3">
          <h3 class="font-bold">อัปเดตสถานะ / เลขพัสดุ</h3>
          <div class="grid sm:grid-cols-2 gap-3">
            <div><label class="label" for="st">สถานะ</label><select id="st" name="status" class="input" ${final ? 'disabled' : ''}>
              ${nextOptions(o.status).map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s} · ${KS.STATUS[s].th}</option>`).join('')}</select></div>
            <div><label class="label" for="tn">เลขพัสดุ (Tracking)</label><input id="tn" name="tracking_number" class="input uppercase" maxlength="40" value="${esc(o.tracking_number || '')}" placeholder="เช่น TH1234567890" ${o.status === 'Cancelled' ? 'disabled' : ''}></div>
            <div class="sm:col-span-2"><label class="label" for="nt">หมายเหตุในประวัติ (ไม่บังคับ)</label><input id="nt" name="note" class="input" maxlength="200" placeholder="เช่น ส่งทาง Kerry Express"></div>
          </div>
          <p id="cancel-warn" class="text-xs font-bold text-danger" hidden>การยกเลิกจะคืนสต็อกทุกรายการในออเดอร์นี้ และย้อนกลับไม่ได้</p>
          <div id="st-error" class="rounded-xl bg-danger-soft text-danger text-sm font-semibold p-3 flex gap-2" hidden></div>
          <button class="btn btn-primary w-full" ${o.status === 'Cancelled' ? 'disabled' : ''}>${KS.icon('save', 'w-4 h-4')} บันทึก</button>
        </form>

        <div class="card p-5"><h3 class="font-bold">รายการสินค้า</h3>
          <ul class="divide-y divide-line mt-2">${o.items.map(i => `<li class="py-3 flex gap-3 items-center"><span class="w-12 h-12 rounded-xl overflow-hidden bg-mist shrink-0">${img(i.image_url, i.product_name, 'w-full h-full object-cover')}</span>
            <span class="flex-1 text-sm"><b>${esc(i.product_name)}</b><span class="block text-xs text-ink-soft">${esc(i.variant_label)} · ${fmt.money(i.price)} × ${i.quantity}</span></span>
            <span class="font-bold tabular text-sm">${fmt.money(i.price * i.quantity)}</span></li>`).join('')}</ul>
          <div class="text-sm space-y-1 border-t border-line pt-3">
            <div class="flex justify-between"><span class="text-ink-soft">ยอดสินค้า</span><span class="tabular">${fmt.money(o.subtotal)}</span></div>
            <div class="flex justify-between"><span class="text-ink-soft">ค่าจัดส่ง/ธรรมเนียม</span><span class="tabular">${fmt.money(o.shipping_fee)}</span></div>
            <div class="flex justify-between font-bold"><span>รวม</span><span class="tabular">${fmt.money(o.total_amount)}</span></div></div></div>

        <div class="card p-5 text-sm space-y-1.5"><h3 class="font-bold mb-2">ลูกค้าและที่อยู่จัดส่ง</h3>
          <p><b>${esc(o.customer_name)}</b> ${o.user_id ? '<span class="text-xs text-cobalt font-bold">สมาชิก</span>' : '<span class="text-xs text-ink-soft">ลูกค้าทั่วไป</span>'}</p>
          <p>${KS.icon('phone', 'w-4 h-4 inline -mt-0.5')} ${esc(o.phone)} · ${KS.icon('mail', 'w-4 h-4 inline -mt-0.5')} ${esc(o.customer_email)}</p>
          <p>${KS.icon('map-pin', 'w-4 h-4 inline -mt-0.5')} ${esc(a.address_line)} ${esc(a.district)} ${esc(a.province)} ${esc(a.postal_code)}</p>
          ${o.note ? `<p class="rounded-xl bg-mustard-soft p-3 mt-2"><b>หมายเหตุจากลูกค้า:</b> ${esc(o.note)}</p>` : ''}</div>

        <div class="card p-5"><h3 class="font-bold">ประวัติสถานะ</h3>
          <ol class="mt-3 space-y-2 text-sm">${[...o.history].reverse().map(h => `<li class="flex gap-3"><span class="w-2 h-2 rounded-full mt-1.5 shrink-0" style="background:${KS.STATUS[h.status]?.dot}"></span>
            <span><b>${esc(h.status)}</b> · ${esc(h.note || '')}<span class="block text-xs text-ink-soft">${fmt.datetime(h.created_at)}</span></span></li>`).join('')}</ol></div>
      </div>`;
    const f = $('#status-form');
    f.status.addEventListener('change', () => { $('#cancel-warn').hidden = f.status.value !== 'Cancelled'; });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('button.btn');
      KS.formError($('#st-error'), '');
      if (f.status.value === 'Cancelled' && !confirm('ยืนยันยกเลิกคำสั่งซื้อและคืนสต็อก?')) return;
      KS.busy(btn, true, 'กำลังบันทึก...');
      try {
        await KS.admin.api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status: f.status.value, tracking_number: f.tracking_number.value.trim(), note: f.note.value.trim() } });
        KS.toast('อัปเดตคำสั่งซื้อแล้ว', 'success');
        openOrder(o.id);
        load();
      } catch (err) { KS.busy(btn, false); KS.formError($('#st-error'), err.message); }
    });
  }

  $('#status-tabs').addEventListener('click', e => { const b = e.target.closest('[data-status]'); if (b) { state = { ...state, status: b.dataset.status, page: 1 }; load(); } });
  $('#search').addEventListener('submit', e => { e.preventDefault(); state = { ...state, q: e.target.q.value.trim(), page: 1 }; load(); });
  $('#pager').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) { state.page = Number(b.dataset.page); load(); } });
  $('#rows').addEventListener('click', e => { const tr = e.target.closest('[data-open]'); if (tr) openOrder(tr.dataset.open); });
  $('#rows').addEventListener('keydown', e => { const tr = e.target.closest('[data-open]'); if (tr && e.key === 'Enter') openOrder(tr.dataset.open); });
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) drawer.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') drawer.hidden = true; });

  await load();
  if (params.get('open')) openOrder(params.get('open'));
})();
