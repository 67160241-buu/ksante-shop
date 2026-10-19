// หน้าเนื้อหาคงที่ (นโยบาย / 404): แสดงสถานะความยินยอมปัจจุบันในหน้านโยบายคุกกี้
(function () {
  const el = document.getElementById('consent-status');
  if (!el) return;
  function render() {
    const c = KS.consent.get();
    if (!c) { el.innerHTML = 'สถานะปัจจุบัน: <b>ยังไม่ได้เลือก</b> (คุกกี้ที่ไม่จำเป็นปิดอยู่ทั้งหมด)'; return; }
    const on = v => (v ? '<b class="text-sage">เปิด</b>' : '<b class="text-danger">ปิด</b>');
    el.innerHTML = `สถานะปัจจุบันของคุณ (บันทึกเมื่อ ${new Date(c.date).toLocaleString('th-TH')}): จำเป็น <b class="text-sage">เปิด</b> · Analytics ${on(c.analytics)} · Preferences ${on(c.preferences)} · Marketing ${on(c.marketing)}`;
  }
  render();
  document.addEventListener('consent:change', render);
})();
