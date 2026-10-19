// ============================================================================
// หน้าบัญชีของฉัน: ประวัติคำสั่งซื้อ (พร้อม Timeline), แก้ไขโปรไฟล์, ที่อยู่เริ่มต้น, เปลี่ยนรหัสผ่าน
// ============================================================================
(async function () {
  const { $, $$, esc, fmt, img } = KS;
  let user = await KS.requireLogin();
  if (!user) return;

  $('#hello').textContent = `สวัสดี, ${user.full_name.split(' ')[0]}`;

  // ---- แท็บ ----
  function showTab(name) {
    $$('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('chip-on', on); b.setAttribute('aria-selected', on); });
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
    history.replaceState(null, '', name === 'orders' ? location.pathname : '#' + name);
  }
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  if (['profile', 'address', 'security'].includes(location.hash.slice(1))) showTab(location.hash.slice(1));

  // ---- คำสั่งซื้อ ----
  async function loadOrders() {
    try {
      const { orders } = await KS.api('/api/orders');
      if (!orders.length) {
        $('#orders').innerHTML = `<div class="card p-10 text-center"><p class="font-display font-bold text-xl">ยังไม่มีคำสั่งซื้อ</p>
          <a href="/shop" class="btn btn-primary mt-4">เริ่มช้อปเลย</a></div>`;
        return;
      }
      $('#orders').innerHTML = `<div class="space-y-4">${orders.map(o => `
        <details class="card overflow-hidden group" ${o === orders[0] ? 'open' : ''}>
          <summary class="p-5 flex flex-wrap items-center gap-4 cursor-pointer list-none hover:bg-mist/50">
            <div class="flex -space-x-3">${o.items.slice(0, 3).map(i => `<span class="w-12 h-12 rounded-xl overflow-hidden border-2 border-white bg-mist">${img(i.image_url, i.product_name, 'w-full h-full object-cover')}</span>`).join('')}</div>
            <div class="flex-1 min-w-40"><p class="font-bold tabular">${esc(o.order_number)}</p><p class="text-xs text-ink-soft">${fmt.datetime(o.created_at)} · ${o.item_count} ชิ้น · ${esc(o.payment_label)}</p></div>
            ${KS.badge(o.status)}<p class="font-display font-bold tabular w-24 text-right">${fmt.money(o.total_amount)}</p>
            <span class="group-open:rotate-180 transition">${KS.icon('chevron-down', 'w-4 h-4')}</span></summary>
          <div class="border-t border-line p-5 space-y-6">
            <div class="overflow-x-auto"><div class="min-w-[460px]">${KS.timeline(o)}</div></div>
            <div class="grid md:grid-cols-2 gap-6">
              <ul class="text-sm divide-y divide-line">${o.items.map(i => `<li class="py-2 flex justify-between gap-3">
                <span>${i.slug ? `<a class="font-bold hover:text-cobalt" href="/product-detail?slug=${encodeURIComponent(i.slug)}">${esc(i.product_name)}</a>` : `<b>${esc(i.product_name)}</b>`}
                <span class="text-ink-soft">(${esc(i.variant_label)}) × ${i.quantity}</span></span><span class="tabular">${fmt.money(i.price * i.quantity)}</span></li>`).join('')}
                <li class="py-2 flex justify-between text-ink-soft"><span>ค่าจัดส่ง/ธรรมเนียม</span><span class="tabular">${o.shipping_fee ? fmt.money(o.shipping_fee) : 'ฟรี'}</span></li></ul>
              <div class="text-sm space-y-2">
                <p><span class="text-ink-soft">เลขพัสดุ:</span> <b class="tabular">${o.tracking_number ? esc(o.tracking_number) : 'ยังไม่จัดส่ง'}</b></p>
                <p><span class="text-ink-soft">จัดส่งถึง:</span> ${esc(o.customer_name)} · ${esc(o.shipping_address.address_line)} ${esc(o.shipping_address.district)} ${esc(o.shipping_address.province)} ${esc(o.shipping_address.postal_code)}</p>
                <div class="flex flex-wrap gap-2 pt-2">
                  <a href="/order-success?ref=${encodeURIComponent(o.public_ref)}" class="btn btn-outline btn-sm">${KS.icon('receipt', 'w-4 h-4')} ดูวิธีชำระเงิน</a>
                  ${o.status === 'Pending' ? `<button class="btn btn-danger btn-sm" data-cancel="${esc(o.order_number)}">${KS.icon('ban', 'w-4 h-4')} ยกเลิกคำสั่งซื้อ</button>` : ''}
                </div></div></div>
          </div></details>`).join('')}</div>`;
    } catch (err) {
      $('#orders').innerHTML = `<p class="text-danger font-bold">${esc(err.message)}</p>`;
    }
  }
  $('#orders').addEventListener('click', async e => {
    const b = e.target.closest('[data-cancel]');
    if (!b) return;
    if (!confirm(`ยืนยันยกเลิกคำสั่งซื้อ ${b.dataset.cancel}? สินค้าจะถูกคืนเข้าสต็อก`)) return;
    KS.busy(b, true, 'กำลังยกเลิก...');
    try {
      await KS.api(`/api/orders/${encodeURIComponent(b.dataset.cancel)}/cancel`, { method: 'POST' });
      KS.toast('ยกเลิกคำสั่งซื้อแล้ว', 'success');
      loadOrders();
    } catch (err) { KS.busy(b, false); KS.toast(err.message, 'error'); }
  });
  loadOrders();

  // ---- ฟอร์มโปรไฟล์ / ที่อยู่ ----
  function fillForms() {
    $('#pf_name').value = user.full_name;
    $('#pf_email').value = user.email;
    $('#pf_phone').value = user.phone || '';
    const a = user.default_address || {};
    $('#ad_line').value = a.address_line || '';
    $('#ad_district').value = a.district || '';
    $('#ad_province').value = a.province || '';
    $('#ad_postal').value = a.postal_code || '';
    $('#address-clear').hidden = !user.default_address;
  }
  fillForms();

  async function saveProfile(form, address) {
    const btn = form.querySelector('button.btn-primary');
    const err = form.querySelector('.form-error');
    KS.formError(err, '');
    KS.busy(btn, true, 'กำลังบันทึก...');
    try {
      ({ user } = await KS.api('/api/auth/me', { method: 'PUT', body: {
        full_name: $('#pf_name').value.trim(), phone: $('#pf_phone').value.trim(), default_address: address,
      } }));
      fillForms();
      KS.me(true);
      KS.toast('บันทึกข้อมูลแล้ว', 'success');
    } catch (ex) { KS.formError(err, ex.message); }
    finally { KS.busy(btn, false); }
  }
  $('#profile-form').addEventListener('submit', e => { e.preventDefault(); saveProfile(e.target, user.default_address); });
  $('#address-form').addEventListener('submit', e => {
    e.preventDefault();
    saveProfile(e.target, { address_line: $('#ad_line').value.trim(), district: $('#ad_district').value.trim(), province: $('#ad_province').value.trim(), postal_code: $('#ad_postal').value.trim() });
  });
  $('#address-clear').addEventListener('click', () => { if (confirm('ลบที่อยู่เริ่มต้น?')) saveProfile($('#address-form'), null); });

  $('#password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button.btn-primary');
    const err = f.querySelector('.form-error');
    KS.formError(err, '');
    KS.busy(btn, true, 'กำลังเปลี่ยนรหัสผ่าน...');
    try {
      await KS.api('/api/auth/password', { method: 'PUT', body: { current_password: f.current_password.value, new_password: f.new_password.value } });
      f.reset();
      KS.toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
    } catch (ex) { KS.formError(err, ex.message); }
    finally { KS.busy(btn, false); }
  });

  $('#logout').addEventListener('click', async () => {
    await KS.api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  });
})();
