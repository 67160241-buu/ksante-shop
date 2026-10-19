// หน้าตะกร้าสินค้าแบบเต็มหน้า: ตรวจราคาและสต็อกกับเซิร์ฟเวอร์ แล้วแสดงปัญหาของแต่ละรายการ
(async function () {
  const { $, esc, fmt } = KS;
  const CFG = window.KS_CONFIG;
  let problems = [];

  function render() {
    const items = KS.cart.items();
    const list = $('#cart-list');
    const summary = $('#cart-summary');
    if (!items.length) {
      list.innerHTML = `<li class="py-16 text-center"><p class="font-display font-bold text-2xl">ตะกร้ายังว่างอยู่</p>
        <p class="text-ink-soft mt-2">ดูหมวกที่เข้ากับสไตล์คุณได้ที่หน้าร้าน</p><a href="/shop" class="btn btn-primary mt-5">เลือกซื้อสินค้า</a></li>`;
      summary.hidden = true;
      return;
    }
    summary.hidden = false;
    list.innerHTML = items.map(i => KS.cartLine(i, problems.find(p => p.variant_id === i.variant_id && i.quantity > p.available))).join('');
    const sub = KS.cart.subtotal();
    const ship = sub >= CFG.freeShippingThreshold ? 0 : CFG.shippingFee;
    const blocked = items.some(i => problems.find(p => p.variant_id === i.variant_id && i.quantity > p.available));
    summary.innerHTML = `<h2 class="font-display font-bold text-lg">สรุปยอด</h2>
      ${KS.freeShipBar(sub)}
      <div class="text-sm space-y-1.5">
        <div class="flex justify-between"><span class="text-ink-soft">สินค้า (${KS.cart.count()} ชิ้น)</span><span class="font-bold tabular">${fmt.money(sub)}</span></div>
        <div class="flex justify-between"><span class="text-ink-soft">ค่าจัดส่ง</span><span class="font-bold tabular">${ship ? fmt.money(ship) : 'ฟรี'}</span></div>
        <div class="flex justify-between text-lg pt-2 border-t border-line"><span class="font-bold">รวม</span><span class="font-display font-bold tabular">${fmt.money(sub + ship)}</span></div></div>
      ${blocked ? '<p class="text-xs font-bold text-danger">กรุณาลดจำนวนสินค้าที่เกินสต็อกก่อนชำระเงิน</p>' : ''}
      <a href="/checkout" class="btn btn-tangerine w-full h-12 ${blocked ? 'pointer-events-none opacity-40' : ''}">ดำเนินการชำระเงิน ${KS.icon('arrow-right', 'w-4 h-4')}</a>
      <a href="/shop" class="btn btn-ghost w-full">เลือกซื้อสินค้าต่อ</a>`;
  }

  KS.bindCartList($('#cart-list'), render);
  document.addEventListener('cart:change', render);
  try {
    const res = await KS.cart.validate();
    problems = res.problems || [];
    const gone = problems.filter(p => p.reason === 'unavailable');
    if (gone.length) KS.toast(`นำสินค้าที่เลิกจำหน่ายออก ${gone.length} รายการ`, 'info');
  } catch (err) {
    KS.toast(err.message, 'error');
  }
  render();
})();
