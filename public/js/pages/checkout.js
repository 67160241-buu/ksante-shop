// ============================================================================
// หน้าชำระเงิน
// 1) ตรวจตะกร้ากับสต็อกจริง  2) กรอกข้อมูลอัตโนมัติถ้าล็อกอินอยู่  3) ส่งคำสั่งซื้อไป /api/orders
// ถ้าสต็อกไม่พอ (เช่นมีคนซื้อตัดหน้า) เซิร์ฟเวอร์จะตอบ 409 และเราจะแสดงรายการที่มีปัญหา
// ============================================================================
(async function () {
  const { $, esc, fmt, img } = KS;
  const CFG = window.KS_CONFIG;
  const form = $('#checkout-form');
  const PROVINCES = ['กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร',
    'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน',
    'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี',
    'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
    'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี',
    'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'];
  $('#provinces').innerHTML = PROVINCES.map(p => `<option value="${p}">`).join('');
  $('#cod-note').textContent = `ชำระเงินสดกับพนักงานส่งของ มีค่าธรรมเนียม ${fmt.money(CFG.codFee)}`;

  if (!KS.cart.items().length) { location.replace('/cart'); return; }

  let problems = [];
  function renderSummary() {
    const items = KS.cart.items();
    $('#co-lines').innerHTML = items.map(i => {
      const pr = problems.find(p => p.variant_id === i.variant_id && i.quantity > p.available);
      return `<li class="flex gap-3 py-3"><span class="relative w-14 h-14 rounded-xl overflow-hidden bg-mist shrink-0">${img(i.image_url, i.name, 'w-full h-full object-cover', { cat: i.category, hex: i.color_hex })}
        <span class="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-ink text-white text-[10px] font-bold grid place-items-center px-1">${i.quantity}</span></span>
        <span class="flex-1 min-w-0 text-sm"><span class="block font-bold truncate">${esc(i.name)}</span><span class="block text-xs text-ink-soft">${esc(i.color_name)} / ${esc(i.size)}</span>
        ${pr ? `<span class="block text-xs font-bold text-danger">${esc(pr.message)}</span>` : ''}</span>
        <span class="text-sm font-bold tabular">${fmt.money(i.price * i.quantity)}</span></li>`;
    }).join('');
    const sub = KS.cart.subtotal();
    const ship = sub >= CFG.freeShippingThreshold ? 0 : CFG.shippingFee;
    const cod = form.payment_method.value === 'cod' ? CFG.codFee : 0;
    $('#co-totals').innerHTML = `<div class="flex justify-between"><span class="text-ink-soft">ยอดสินค้า</span><span class="font-bold tabular">${fmt.money(sub)}</span></div>
      <div class="flex justify-between"><span class="text-ink-soft">ค่าจัดส่ง</span><span class="font-bold tabular">${ship ? fmt.money(ship) : 'ฟรี'}</span></div>
      ${cod ? `<div class="flex justify-between"><span class="text-ink-soft">ค่าธรรมเนียม COD</span><span class="font-bold tabular">${fmt.money(cod)}</span></div>` : ''}
      <div class="flex justify-between text-lg pt-2"><span class="font-bold">ยอดชำระ</span><span class="font-display font-bold tabular">${fmt.money(sub + ship + cod)}</span></div>`;
    $('#place-order').disabled = !items.length || items.some(i => problems.find(p => p.variant_id === i.variant_id && i.quantity > p.available));
  }
  form.addEventListener('change', e => { if (e.target.name === 'payment_method') renderSummary(); });

  try { problems = (await KS.cart.validate()).problems || []; } catch (err) { KS.toast(err.message, 'error'); }
  if (!KS.cart.items().length) { location.replace('/cart'); return; }
  renderSummary();

  // กรอกข้อมูลจากบัญชีให้อัตโนมัติ
  const user = await KS.me();
  if (user) {
    form.customer_name.value = user.full_name;
    form.customer_email.value = user.email;
    form.phone.value = user.phone || '';
    const a = user.default_address;
    if (a) { form.address_line.value = a.address_line; form.district.value = a.district; form.province.value = a.province; form.postal_code.value = a.postal_code; }
    $('#save-address-wrap').hidden = false;
  } else {
    $('#login-hint').hidden = false;
  }

  // ตรวจข้อมูลฝั่งหน้าเว็บก่อนส่ง (เซิร์ฟเวอร์ตรวจซ้ำอีกครั้งเสมอ)
  function validate() {
    const f = form;
    const rules = [
      [f.customer_name, v => v.length >= 2, 'กรุณากรอกชื่อผู้รับ'],
      [f.phone, v => /^0\d{8,9}$/.test(v.replace(/\D/g, '')), 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0'],
      [f.customer_email, v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'รูปแบบอีเมลไม่ถูกต้อง'],
      [f.address_line, v => v.length >= 5, 'กรุณากรอกที่อยู่'],
      [f.district, v => v.length >= 2, 'กรุณากรอกเขต/อำเภอ'],
      [f.province, v => v.length >= 2, 'กรุณากรอกจังหวัด'],
      [f.postal_code, v => /^\d{5}$/.test(v), 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'],
    ];
    for (const [el, ok, msg] of rules) {
      el.classList.remove('border-danger');
      if (!ok(el.value.trim())) { el.classList.add('border-danger'); el.focus(); return msg; }
    }
    return null;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = validate();
    KS.formError($('#co-error'), err);
    if (err) return;
    const btn = $('#place-order');
    KS.busy(btn, true, 'กำลังสร้างคำสั่งซื้อ...');
    try {
      const f = form;
      const { order } = await KS.api('/api/orders', { method: 'POST', body: {
        items: KS.cart.items().map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
        customer_name: f.customer_name.value.trim(), customer_email: f.customer_email.value.trim(), phone: f.phone.value.trim(),
        shipping_address: { address_line: f.address_line.value.trim(), district: f.district.value.trim(), province: f.province.value.trim(), postal_code: f.postal_code.value.trim() },
        payment_method: f.payment_method.value, note: f.note.value.trim(), save_address: !!f.save_address?.checked,
      } });
      KS.cart.clear();
      location.href = `/order-success?ref=${encodeURIComponent(order.public_ref)}`;
    } catch (ex) {
      KS.busy(btn, false);
      KS.formError($('#co-error'), ex.message);
      if (ex.status === 409) {               // สต็อกเปลี่ยน -> ดึงสต็อกล่าสุดมาแสดง
        try { problems = (await KS.cart.validate()).problems || []; } catch { /* ignore */ }
        renderSummary();
      }
    }
  });
})();
