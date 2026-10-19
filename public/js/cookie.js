// ============================================================================
// Cookie Consent ตาม PDPA
//  - แสดงแบนเนอร์ครั้งแรกที่เข้าเว็บ มี 3 ปุ่ม: ยอมรับทั้งหมด / ปฏิเสธที่ไม่จำเป็น / ตั้งค่าคุกกี้
//  - Necessary เปิดเสมอ, Analytics / Preferences / Marketing ค่าเริ่มต้น "ปิด"
//  - บันทึกค่าใน localStorage (ks_consent) และ cookie ks_consent (ให้ฝั่ง API ตรวจซ้ำได้)
//  - ส่งหลักฐานการยินยอมไปเก็บในตาราง cookie_consents
//  - ไม่บันทึกข้อมูลประเภทใดจนกว่าจะได้รับความยินยอมประเภทนั้น (ผ่าน KS.consent.allowed())
//  - ถอนความยินยอมได้ตลอดผ่านปุ่ม "ตั้งค่าคุกกี้" ใน Footer ระบบจะลบข้อมูลของประเภทที่ปิดทันที
// ============================================================================
(function () {
  const KS = window.KS;
  const CFG = window.KS_CONFIG;
  const KEY = 'ks_consent';
  const CATS = [
    { key: 'necessary', title: 'คุกกี้ที่จำเป็น (Necessary)', locked: true,
      desc: 'ใช้ให้เว็บไซต์ทำงานได้ เช่น ตะกร้าสินค้า การเข้าสู่ระบบ และการจำค่าความยินยอมนี้ ปิดไม่ได้' },
    { key: 'analytics', title: 'คุกกี้เพื่อการวิเคราะห์ (Analytics)',
      desc: 'นับจำนวนการเข้าชมแต่ละหน้าแบบไม่ระบุตัวตน เพื่อนำมาปรับปรุงร้าน เก็บในระบบของ K\'Sante เองเท่านั้น' },
    { key: 'preferences', title: 'คุกกี้เพื่อการตั้งค่า (Preferences)',
      desc: 'จำตัวกรองและการเรียงสินค้าล่าสุด และรายการสินค้าที่คุณเพิ่งดู เพื่อให้กลับมาช้อปต่อได้สะดวก' },
    { key: 'marketing', title: 'คุกกี้เพื่อการตลาด (Marketing)',
      desc: 'จำแคมเปญที่พาคุณมาที่เว็บไซต์ (เช่น ลิงก์ที่มี utm_source) เพื่อวัดผลโฆษณา ไม่แชร์ข้อมูลให้บุคคลภายนอก' },
  ];
  // ข้อมูลที่ต้องลบเมื่อผู้ใช้ปิดแต่ละประเภท
  const STORAGE_OF = { analytics: ['ks_aid'], preferences: ['ks_pref_shop', 'ks_recent'], marketing: ['ks_utm'] };

  const readStore = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const writeStore = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };
  const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

  /** รหัสผู้เยี่ยมชมสำหรับบันทึกหลักฐานความยินยอม (จัดเป็นข้อมูลที่จำเป็น) */
  function visitorId() {
    let id = readStore('ks_vid');
    if (!/^[a-f0-9]{32}$/.test(id || '')) { id = randomId(); writeStore('ks_vid', id); }
    return id;
  }

  function current() {
    try {
      const c = JSON.parse(readStore(KEY));
      if (c && c.version === CFG.cookieConsentVersion) return c;
    } catch { /* ignore */ }
    return null;
  }

  function setCookie(c) {
    const v = `v${c.version}.a${+c.analytics}.p${+c.preferences}.m${+c.marketing}`;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `ks_consent=${v}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
  }

  function save(choice) {
    const c = { necessary: true, analytics: !!choice.analytics, preferences: !!choice.preferences, marketing: !!choice.marketing,
      version: CFG.cookieConsentVersion, date: new Date().toISOString() };
    writeStore(KEY, JSON.stringify(c));
    setCookie(c);
    // ลบข้อมูลของประเภทที่ไม่ได้รับอนุญาต (กรณีถอนความยินยอม)
    for (const [cat, keys] of Object.entries(STORAGE_OF)) if (!c[cat]) keys.forEach(k => writeStore(k, null));
    if (!c.marketing) document.cookie = 'ks_utm=; Path=/; Max-Age=0; SameSite=Lax';
    // ส่งหลักฐานไปบันทึกที่ server (ถ้าล้มเหลวก็ไม่กระทบการใช้งาน)
    KS.api('/api/consent', { method: 'POST', body: { visitor_id: visitorId(), consent: c, version: c.version } }).catch(() => {});
    hideBanner();
    closeSettings();
    runGranted(c);
    document.dispatchEvent(new CustomEvent('consent:change', { detail: c }));
    KS.toast('บันทึกการตั้งค่าคุกกี้แล้ว', 'success');
  }

  KS.consent = {
    get: current,
    /** ใช้ก่อนบันทึกข้อมูลที่ไม่จำเป็นทุกครั้ง เช่น KS.consent.allowed('preferences') */
    allowed: cat => cat === 'necessary' || !!current()?.[cat],
    openSettings,
  };

  // ---------------------------------------------------------------------------
  // แบนเนอร์
  // ---------------------------------------------------------------------------
  function showBanner() {
    if (KS.$('#cookie-banner')) return;
    const el = document.createElement('section');
    el.id = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'การใช้คุกกี้');
    el.className = 'fixed z-[90] inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md card-block p-5 modal-panel';
    el.innerHTML = `
      <div class="flex gap-3"><span class="w-10 h-10 rounded-xl bg-mustard-soft text-[#8A5300] grid place-items-center shrink-0">${KS.icon('cookie')}</span>
        <div><h2 class="font-display font-bold">เว็บไซต์นี้ใช้คุกกี้</h2>
        <p class="text-sm text-ink-soft mt-1 leading-relaxed">เราใช้คุกกี้ที่จำเป็นเพื่อให้ตะกร้าและการเข้าสู่ระบบทำงานได้ และขอความยินยอมสำหรับคุกกี้วิเคราะห์ ตั้งค่า และการตลาด
        อ่านเพิ่มเติมที่ <a href="/cookie-policy" class="link">นโยบายคุกกี้</a></p></div></div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        <button class="btn btn-primary btn-sm" data-cc="accept">ยอมรับทั้งหมด</button>
        <button class="btn btn-outline btn-sm" data-cc="reject">ปฏิเสธที่ไม่จำเป็น</button>
        <button class="btn btn-ghost btn-sm border border-line" data-cc="settings">ตั้งค่าคุกกี้</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-cc]')?.dataset.cc;
      if (a === 'accept') save({ analytics: true, preferences: true, marketing: true });
      if (a === 'reject') save({ analytics: false, preferences: false, marketing: false });
      if (a === 'settings') openSettings();
    });
  }
  function hideBanner() { KS.$('#cookie-banner')?.remove(); }

  // ---------------------------------------------------------------------------
  // หน้าต่างตั้งค่า (Cookie Settings)
  // ---------------------------------------------------------------------------
  function openSettings() {
    closeSettings();
    const c = current() || { analytics: false, preferences: false, marketing: false };
    const el = document.createElement('div');
    el.id = 'cookie-settings';
    el.className = 'fixed inset-0 z-[95] grid place-items-center p-4';
    el.innerHTML = `
      <div class="absolute inset-0 bg-ink/50" data-cs-close></div>
      <form class="relative card-block w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 modal-panel" role="dialog" aria-modal="true" aria-labelledby="cs-title">
        <div class="flex items-start justify-between gap-4">
          <div><p class="eyebrow text-cobalt">Cookie Settings</p><h2 id="cs-title" class="font-display font-bold text-xl mt-1">ตั้งค่าความยินยอมคุกกี้</h2></div>
          <button type="button" class="icon-btn -mr-2 -mt-1" data-cs-close aria-label="ปิด">${KS.icon('x')}</button></div>
        <p class="text-sm text-ink-soft mt-2">เลือกเปิดหรือปิดได้ตามต้องการ และเปลี่ยนใจได้ทุกเมื่อจากปุ่ม "ตั้งค่าคุกกี้" ด้านล่างของทุกหน้า</p>
        <div class="mt-5 divide-y divide-line border-y border-line">
          ${CATS.map(cat => `<label class="flex items-start gap-4 py-4 ${cat.locked ? '' : 'cursor-pointer'}">
            <span class="flex-1"><span class="block font-bold text-sm">${cat.title}</span><span class="block text-xs text-ink-soft mt-1 leading-relaxed">${cat.desc}</span>
              ${cat.locked ? '<span class="inline-block mt-2 text-[11px] font-bold text-sage">เปิดใช้งานเสมอ</span>' : ''}</span>
            <span class="switch"><input type="checkbox" name="${cat.key}" ${cat.locked || c[cat.key] ? 'checked' : ''} ${cat.locked ? 'disabled' : ''} aria-label="${cat.title}"><span></span></span>
          </label>`).join('')}
        </div>
        <div class="flex flex-col sm:flex-row gap-2 mt-5">
          <button type="submit" class="btn btn-primary flex-1">บันทึกการตั้งค่า</button>
          <button type="button" class="btn btn-outline" data-cs="accept">ยอมรับทั้งหมด</button>
          <button type="button" class="btn btn-ghost border border-line" data-cs="reject">ปฏิเสธทั้งหมด</button></div>
        <p class="text-xs text-ink-soft mt-4">รายละเอียดคุกกี้แต่ละตัวดูได้ที่ <a href="/cookie-policy" class="link">นโยบายคุกกี้</a> และ <a href="/privacy-policy" class="link">นโยบายความเป็นส่วนตัว</a></p>
      </form>`;
    document.body.appendChild(el);
    const form = KS.$('form', el);
    form.addEventListener('submit', e => {
      e.preventDefault();
      save({ analytics: form.analytics.checked, preferences: form.preferences.checked, marketing: form.marketing.checked });
    });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-cs-close]')) closeSettings();
      const a = e.target.closest('[data-cs]')?.dataset.cs;
      if (a === 'accept') save({ analytics: true, preferences: true, marketing: true });
      if (a === 'reject') save({ analytics: false, preferences: false, marketing: false });
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
    form.querySelector('input:not([disabled])').focus();
  }
  function closeSettings() { KS.$('#cookie-settings')?.remove(); }

  // ---------------------------------------------------------------------------
  // สิ่งที่ทำงาน "หลังได้รับความยินยอม" เท่านั้น
  // ---------------------------------------------------------------------------
  function runGranted(c) {
    // Analytics: สร้างรหัสวิเคราะห์ แล้วนับการเข้าชมหน้านี้ (ครั้งเดียวต่อหน้า)
    if (c.analytics && !runGranted.viewSent) {
      let aid = readStore('ks_aid');
      if (!/^[a-f0-9]{32}$/.test(aid || '')) { aid = randomId(); writeStore('ks_aid', aid); }
      runGranted.viewSent = true;
      KS.api('/api/events', { method: 'POST', body: { visitor_id: aid, event: 'page_view', path: location.pathname } }).catch(() => {});
    }
    // Marketing: จำแหล่งที่มาของแคมเปญจาก ?utm_source= ไว้ 30 วัน
    if (c.marketing) {
      const src = new URLSearchParams(location.search).get('utm_source');
      if (src && /^[\w.-]{1,40}$/.test(src)) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `ks_utm=${encodeURIComponent(src)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
        // ถ้ายอมรับ Analytics ด้วย จะนับว่าแคมเปญนี้พาผู้เยี่ยมชมมา 1 ครั้ง
        if (c.analytics) KS.api('/api/events', { method: 'POST', body: { visitor_id: readStore('ks_aid'), event: `campaign:${src}`, path: location.pathname } }).catch(() => {});
      }
    }
  }

  const c = current();
  if (c) {
    setCookie(c);          // ต่ออายุ cookie ให้ตรงกับค่าที่บันทึกไว้
    runGranted(c);
  } else {
    showBanner();
  }
})();
