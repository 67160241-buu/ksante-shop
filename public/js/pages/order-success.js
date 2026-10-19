// หน้ายืนยันคำสั่งซื้อ (/order-success?ref=...) : แสดงเลขออเดอร์ และวิธีชำระเงินตามที่เลือก
(async function () {
  const { $, esc, fmt, img } = KS;
  const CFG = window.KS_CONFIG;
  const root = $('#success-root');
  const ref = KS.param('ref');
  if (!ref) { location.replace('/'); return; }

  let order;
  try { ({ order } = await KS.api(`/api/orders/ref/${encodeURIComponent(ref)}`)); }
  catch (err) { root.innerHTML = `<div class="card p-10 text-center"><p class="font-bold">${esc(err.message)}</p><a href="/" class="btn btn-primary mt-4">กลับหน้าแรก</a></div>`; return; }

  const a = order.shipping_address;
  const pay = {
    promptpay: `<div class="grid sm:grid-cols-[200px_1fr] gap-6 items-center">
        <div id="qr" class="bg-white p-3 rounded-2xl border-2 border-ink aspect-square"></div>
        <div><p class="font-bold text-lg">สแกนจ่ายด้วย PromptPay</p><p class="text-sm text-ink-soft mt-1">เปิดแอปธนาคาร เลือกสแกน QR แล้วตรวจสอบยอด <b class="text-ink">${fmt.money(order.total_amount)}</b></p>
          <p id="qr-note" class="text-xs mt-3 rounded-xl p-3"></p></div></div>`,
    bank_transfer: `<div><p class="font-bold text-lg">โอนเงินเข้าบัญชีร้าน</p>
        <dl class="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm"><dt class="text-ink-soft">ธนาคาร</dt><dd class="font-bold">${esc(CFG.bank.name)}</dd>
          <dt class="text-ink-soft">ชื่อบัญชี</dt><dd class="font-bold">${esc(CFG.bank.accountName)}</dd>
          <dt class="text-ink-soft">เลขที่บัญชี</dt><dd class="font-bold tabular flex items-center gap-2">${esc(CFG.bank.accountNo)}
            <button class="text-cobalt" data-copy="${esc(CFG.bank.accountNo.replace(/-/g, ''))}" aria-label="คัดลอกเลขบัญชี">${KS.icon('copy', 'w-4 h-4')}</button></dd>
          <dt class="text-ink-soft">ยอดโอน</dt><dd class="font-bold tabular">${fmt.money(order.total_amount)}</dd></dl>
        <p class="text-xs text-ink-soft mt-3">โอนแล้วส่งสลิปพร้อมเลขคำสั่งซื้อมาที่ ${esc(CFG.email)} ร้านจะยืนยันภายใน 24 ชั่วโมง</p></div>`,
    cod: `<div><p class="font-bold text-lg">เก็บเงินปลายทาง</p><p class="text-sm text-ink-soft mt-1">เตรียมเงินสด <b class="text-ink">${fmt.money(order.total_amount)}</b> ให้พนักงานส่งของเมื่อได้รับสินค้า (รวมค่าธรรมเนียม COD แล้ว)</p></div>`,
  }[order.payment_method];

  root.innerHTML = `
    <div class="card-block p-5 sm:p-8 text-center fade-in">
      <span class="w-16 h-16 mx-auto rounded-full bg-sage text-white grid place-items-center">${KS.icon('check', 'w-8 h-8')}</span>
      <h1 class="font-display font-bold text-2xl sm:text-3xl mt-4">ขอบคุณสำหรับคำสั่งซื้อ!</h1>
      <p class="text-ink-soft mt-2">เก็บเลขคำสั่งซื้อนี้ไว้ ใช้คู่กับอีเมล <b class="break-all">${esc(order.customer_email)}</b> เพื่อติดตามพัสดุได้ทุกเมื่อ</p>
      <p class="mt-5 inline-flex flex-wrap justify-center items-center gap-x-3 gap-y-1 rounded-2xl bg-mist px-5 py-3"><span class="text-xs text-ink-soft whitespace-nowrap w-full sm:w-auto">เลขคำสั่งซื้อ</span>
        <span class="font-display font-bold text-xl sm:text-2xl tabular" id="order-number">${esc(order.order_number)}</span>
        <button class="text-cobalt" data-copy="${esc(order.order_number)}" aria-label="คัดลอกเลขคำสั่งซื้อ">${KS.icon('copy', 'w-5 h-5')}</button></p>
      <div class="mt-4">${KS.badge(order.status)}</div>
    </div>
    <div class="card p-6 mt-4">${pay}</div>
    <div class="card p-6 mt-4">
      <h2 class="font-display font-bold text-lg">รายการสินค้า</h2>
      <ul class="divide-y divide-line mt-2">${order.items.map(i => `<li class="flex gap-3 py-3"><span class="w-14 h-14 rounded-xl overflow-hidden bg-mist shrink-0">${img(i.image_url, i.product_name, 'w-full h-full object-cover')}</span>
        <span class="flex-1 text-sm"><b class="block">${esc(i.product_name)}</b><span class="text-xs text-ink-soft">${esc(i.variant_label)} × ${i.quantity}</span></span>
        <span class="text-sm font-bold tabular">${fmt.money(i.price * i.quantity)}</span></li>`).join('')}</ul>
      <div class="text-sm space-y-1 border-t border-line pt-3">
        <div class="flex justify-between"><span class="text-ink-soft">ยอดสินค้า</span><span class="tabular">${fmt.money(order.subtotal)}</span></div>
        <div class="flex justify-between"><span class="text-ink-soft">ค่าจัดส่ง/ธรรมเนียม</span><span class="tabular">${order.shipping_fee ? fmt.money(order.shipping_fee) : 'ฟรี'}</span></div>
        <div class="flex justify-between font-bold text-base"><span>ยอดชำระ</span><span class="tabular">${fmt.money(order.total_amount)}</span></div></div>
      <p class="text-sm text-ink-soft mt-4">${KS.icon('map-pin', 'w-4 h-4 inline -mt-0.5')} จัดส่งถึง ${esc(order.customer_name)} · ${esc(a.address_line)} ${esc(a.district)} ${esc(a.province)} ${esc(a.postal_code)} · ${esc(order.phone)}</p>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 mt-6">
      <a href="/track-order?number=${encodeURIComponent(order.order_number)}&contact=${encodeURIComponent(order.customer_email)}" class="btn btn-primary flex-1">${KS.icon('truck', 'w-4 h-4')} ติดตามคำสั่งซื้อ</a>
      <a href="/shop" class="btn btn-outline flex-1">เลือกซื้อสินค้าต่อ</a></div>`;

  if (order.payment_method === 'promptpay') {
    const real = window.KS_PROMPTPAY($('#qr'), order.total_amount, order.order_number);
    const note = $('#qr-note');
    note.className += real ? ' bg-sage-soft text-[#06704D]' : ' bg-mustard-soft text-[#8A5300]';
    note.textContent = real ? 'QR นี้มียอดเงินกำหนดไว้แล้ว ชำระเสร็จร้านจะยืนยันคำสั่งซื้อให้'
      : 'QR จำลองสำหรับสาธิต (ร้านยังไม่ได้ตั้งค่า promptpayId ใน js/config.js) สแกนแล้วจะไม่มีการตัดเงินจริง';
  }
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); KS.toast('คัดลอกแล้ว', 'success'); } catch { KS.toast('คัดลอกไม่ได้ กรุณาคัดลอกเอง', 'error'); }
  });
})();
