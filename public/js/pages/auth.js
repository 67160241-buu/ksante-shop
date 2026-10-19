// หน้าเข้าสู่ระบบ / สมัครสมาชิก (ใช้ไฟล์เดียวกัน) : สำเร็จแล้วกลับไปหน้าที่ส่งมา (?next=)
(async function () {
  const { $ } = KS;
  // ป้องกัน open redirect: อนุญาตเฉพาะ path ภายในเว็บเท่านั้น
  const next = (() => { const n = KS.param('next') || '/profile'; return /^\/(?!\/)/.test(n) ? n : '/profile'; })();
  const keepNext = a => { if (a && KS.param('next')) a.href += '?next=' + encodeURIComponent(next); };
  keepNext($('#to-register'));
  keepNext($('#to-login'));

  if (await KS.me()) { location.replace(next); return; }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-toggle-pw]');
    if (!b) return;
    const input = b.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = KS.icon(show ? 'eye-off' : 'eye', 'w-4 h-4');
    b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
  });

  const login = $('#login-form');
  if (login) login.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = login.querySelector('button.btn');
    KS.formError($('#form-error'), '');
    if (!login.email.value.trim() || !login.password.value) return KS.formError($('#form-error'), 'กรุณากรอกอีเมลและรหัสผ่าน');
    KS.busy(btn, true, 'กำลังเข้าสู่ระบบ...');
    try {
      await KS.api('/api/auth/login', { method: 'POST', body: { email: login.email.value.trim(), password: login.password.value } });
      location.replace(next);
    } catch (err) { KS.busy(btn, false); KS.formError($('#form-error'), err.message); }
  });

  const reg = $('#register-form');
  if (reg) reg.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = reg.querySelector('button.btn');
    const pw = reg.password.value;
    let msg = null;
    if (reg.full_name.value.trim().length < 2) msg = 'กรุณากรอกชื่อ-นามสกุล';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reg.email.value.trim())) msg = 'รูปแบบอีเมลไม่ถูกต้อง';
    else if (reg.phone.value && !/^0\d{8,9}$/.test(reg.phone.value.trim())) msg = 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0';
    else if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) msg = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข';
    else if (!reg.accept.checked) msg = 'กรุณายอมรับนโยบายความเป็นส่วนตัว';
    KS.formError($('#form-error'), msg);
    if (msg) return;
    KS.busy(btn, true, 'กำลังสร้างบัญชี...');
    try {
      await KS.api('/api/auth/register', { method: 'POST', body: { full_name: reg.full_name.value.trim(), email: reg.email.value.trim(), phone: reg.phone.value.trim(), password: pw } });
      location.replace(next);
    } catch (err) { KS.busy(btn, false); KS.formError($('#form-error'), err.message); }
  });
})();
