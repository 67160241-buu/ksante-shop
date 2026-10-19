// เข้าสู่ระบบผู้ดูแล: สำเร็จแล้วไปหน้าที่ขอไว้ (?next=) หรือ Dashboard
(function () {
  const { $ } = KS;
  KS.hydrateIcons();
  const next = (() => { const n = KS.param('next') || '/admin/'; return /^\/admin(\/|$)/.test(n) ? n : '/admin/'; })();
  if (KS.param('denied')) $('#denied').hidden = false;
  const form = $('#admin-login');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button.btn');
    KS.formError($('#form-error'), '');
    if (!form.email.value.trim() || !form.password.value) return KS.formError($('#form-error'), 'กรุณากรอกอีเมลและรหัสผ่าน');
    KS.busy(btn, true, 'กำลังตรวจสอบ...');
    try {
      await KS.api('/api/auth/admin-login', { method: 'POST', body: { email: form.email.value.trim(), password: form.password.value } });
      location.replace(next);
    } catch (err) { KS.busy(btn, false); KS.formError($('#form-error'), err.message); }
  });
})();
