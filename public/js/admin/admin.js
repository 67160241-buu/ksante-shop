// ============================================================================
// Admin Portal : ส่วนกลางของทุกหน้าแอดมิน (เมนูด้านข้าง, ตรวจ session, ออกจากระบบ)
// การป้องกันจริงอยู่ฝั่งเซิร์ฟเวอร์: functions/admin/_middleware.js และ functions/api/admin/_middleware.js
// สคริปต์นี้ใช้ต่อจาก app.js (ใช้ KS.api, KS.icon, KS.fmt ร่วมกัน)
// ============================================================================
(function () {
  const KS = window.KS;
  const { $, esc } = KS;
  const NAV = [
    ['/admin/', 'layout-dashboard', 'Dashboard'],
    ['/admin/orders', 'clipboard-list', 'คำสั่งซื้อ'],
    ['/admin/products', 'tag', 'สินค้า'],
    ['/admin/inventory', 'boxes', 'สต็อกสินค้า'],
  ];

  KS.admin = {};

  /** ข้อมูลแอดมินที่ล็อกอินอยู่ (ถ้า session หมดอายุ -> กลับหน้า login) */
  KS.admin.me = KS.api('/api/admin/me').then(d => d.user).catch(err => {
    if (err.status === 401 || err.status === 403) location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search));
    return null;
  });

  /** เรียก API แอดมิน: ถ้าได้ 401 (หมดอายุ) จะพาไปหน้า login */
  KS.admin.api = async (path, opts) => {
    try { return await KS.api(path, opts); }
    catch (err) {
      if (err.status === 401) location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search));
      throw err;
    }
  };

  /** แถบสีสต็อก: แดง = หมด, เหลือง = ใกล้หมด (<= 5), เขียว = ปกติ */
  KS.admin.stockBar = (qty, max = 40) => {
    const color = qty === 0 ? '#DC2626' : qty <= 5 ? '#F59E0B' : '#10B981';
    const pct = qty === 0 ? 100 : Math.max(8, Math.min(100, Math.round((qty / max) * 100)));
    return `<div class="stock-bar w-24" title="${qty} ชิ้น"><span style="width:${pct}%;background:${color}"></span></div>`;
  };
  KS.admin.stockPill = qty => qty === 0 ? '<span class="rounded-full bg-danger-soft text-danger text-[11px] font-bold px-2 py-0.5">หมด</span>'
    : qty <= 5 ? `<span class="rounded-full bg-mustard-soft text-[#8A5300] text-[11px] font-bold px-2 py-0.5">ใกล้หมด</span>`
    : '<span class="rounded-full bg-sage-soft text-[#06704D] text-[11px] font-bold px-2 py-0.5">ปกติ</span>';

  function renderShell() {
    const here = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    const active = href => here === href || (href !== '/admin/' && here.startsWith(href)) || (href === '/admin/products' && here === '/admin/product-form');
    $('#admin-nav').innerHTML = `
      <div class="h-16 flex items-center gap-2 px-5 border-b border-white/10">
        <span class="grid grid-cols-2 gap-0.5 w-7 h-7"><span class="bg-cobalt rounded-tl-lg"></span><span class="bg-tangerine rounded-tr-lg"></span><span class="bg-sage rounded-bl-lg"></span><span class="bg-mustard rounded-br-lg"></span></span>
        <span class="font-display font-bold text-lg">K'Sante <span class="text-white/50 font-sans text-xs font-semibold">Admin</span></span></div>
      <nav class="p-3 space-y-1" aria-label="เมนูแอดมิน">
        ${NAV.map(([href, icon, label]) => `<a href="${href}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${active(href) ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/10 hover:text-white'}">${KS.icon(icon, 'w-4 h-4')} ${label}</a>`).join('')}
        <hr class="border-white/10 my-3">
        <a href="/" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white">${KS.icon('store', 'w-4 h-4')} ดูหน้าร้าน</a>
      </nav>
      <div class="mt-auto p-4 border-t border-white/10">
        <p id="admin-name" class="text-sm font-bold truncate">...</p><p id="admin-email" class="text-xs text-white/50 truncate"></p>
        <button id="admin-logout" class="mt-3 w-full btn btn-sm bg-white/10 text-white hover:bg-danger">${KS.icon('log-out', 'w-4 h-4')} ออกจากระบบ</button></div>`;
    $('#admin-logout').addEventListener('click', async () => {
      await KS.api('/api/auth/admin-logout', { method: 'POST' }).catch(() => {});
      location.replace('/admin/login');
    });
    $('#admin-menu')?.addEventListener('click', () => $('#admin-nav').classList.toggle('-translate-x-full'));
    KS.admin.me.then(u => { if (u) { $('#admin-name').textContent = u.full_name; $('#admin-email').textContent = u.email; } });
  }

  if ($('#admin-nav')) renderShell();
  KS.hydrateIcons();

  /** escape helper สำหรับสคริปต์แอดมิน */
  KS.admin.esc = esc;
})();
