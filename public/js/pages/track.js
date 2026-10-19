// หน้าติดตามพัสดุ: ค้นหาด้วยเลขคำสั่งซื้อ + อีเมล/เบอร์โทร แล้วแสดง Timeline และเลขพัสดุ
(function () {
  const { $, esc, fmt } = KS;
  const form = $('#track-form');

  function render(o) {
    $('#track-result').innerHTML = `<div class="card-block p-6 fade-in">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><p class="text-xs text-ink-soft">เลขคำสั่งซื้อ</p><p class="font-display font-bold text-2xl tabular">${esc(o.order_number)}</p>
          <p class="text-xs text-ink-soft mt-1">สั่งเมื่อ ${fmt.datetime(o.created_at)} · ${o.item_count} ชิ้น · ${fmt.money(o.total_amount)}</p></div>
        ${KS.badge(o.status)}</div>
      <div class="mt-8 overflow-x-auto"><div class="min-w-[480px]">${KS.timeline(o)}</div></div>
      <div class="mt-8 rounded-2xl ${o.tracking_number ? 'bg-cobalt-soft' : 'bg-mist'} p-4 flex flex-wrap items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-white grid place-items-center text-cobalt">${KS.icon('truck')}</span>
        <div class="flex-1"><p class="text-xs text-ink-soft">หมายเลขพัสดุ (Tracking Number)</p>
          <p class="font-bold tabular">${o.tracking_number ? esc(o.tracking_number) : 'จะแสดงเมื่อร้านส่งพัสดุแล้ว'}</p></div>
        ${o.tracking_number ? `<button type="button" class="btn btn-cobalt btn-sm" data-copy="${esc(o.tracking_number)}">${KS.icon('copy', 'w-3.5 h-3.5')} คัดลอกเลขพัสดุ</button>` : ''}
      </div>
      <h2 class="font-bold mt-8">ประวัติสถานะ</h2>
      <ol class="mt-3 space-y-3 border-l-2 border-line pl-5">${[...o.history].reverse().map(h => `<li class="relative">
        <span class="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white" style="background:${KS.STATUS[h.status]?.dot || '#111318'}"></span>
        <p class="text-sm font-bold">${esc(h.status)} · ${esc(KS.STATUS[h.status]?.th || '')}</p><p class="text-xs text-ink-soft">${esc(h.note || '')} · ${fmt.datetime(h.created_at)}</p></li>`).join('')}</ol>
      <h2 class="font-bold mt-8">รายการสินค้า</h2>
      <ul class="mt-2 text-sm divide-y divide-line">${o.items.map(i => `<li class="py-2 flex justify-between gap-3"><span>${esc(i.product_name)} <span class="text-ink-soft">(${esc(i.variant_label)}) × ${i.quantity}</span></span><span class="tabular font-bold">${fmt.money(i.price * i.quantity)}</span></li>`).join('')}</ul>
    </div>`;
  }

  async function search(number, contact) {
    KS.formError($('#track-error'), '');
    if (!/^KS\d{12}$/i.test(number)) return KS.formError($('#track-error'), 'เลขคำสั่งซื้อต้องเป็น KS ตามด้วยตัวเลข 12 หลัก');
    if (!contact) return KS.formError($('#track-error'), 'กรุณากรอกอีเมลหรือเบอร์โทรที่ใช้สั่งซื้อ');
    const btn = $('#track-btn');
    KS.busy(btn, true, 'กำลังค้นหา...');
    try {
      const { order } = await KS.api(`/api/orders/track?number=${encodeURIComponent(number)}&contact=${encodeURIComponent(contact)}`);
      render(order);
      history.replaceState(null, '', `?number=${encodeURIComponent(order.order_number)}`);
    } catch (err) {
      $('#track-result').innerHTML = '';
      KS.formError($('#track-error'), err.message);
    } finally { KS.busy(btn, false); }
  }

  $('#track-result').addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); KS.toast('คัดลอกเลขพัสดุแล้ว นำไปค้นในเว็บของบริษัทขนส่งได้', 'success'); } catch { KS.toast('คัดลอกไม่ได้ กรุณาคัดลอกเอง', 'error'); }
  });

  form.addEventListener('submit', e => { e.preventDefault(); search(form.number.value.trim().toUpperCase(), form.contact.value.trim()); });
  const n = KS.param('number'), c = KS.param('contact');
  if (n) form.number.value = n;
  if (c) form.contact.value = c;
  if (n && c) search(n.toUpperCase(), c);
})();
