// Dashboard: ตัวเลขสรุป + กราฟยอดขาย 14 วัน + สถานะออเดอร์ + สต็อกต่ำ
(async function () {
  const { $, esc, fmt } = KS;
  let m;
  try { m = await KS.admin.api('/api/admin/metrics'); }
  catch (err) { $('#kpis').innerHTML = `<p class="col-span-full text-danger font-bold">${esc(err.message)}</p>`; return; }

  const kpi = (label, value, icon, tone, sub) => `<div class="card p-5 relative overflow-hidden">
    <span class="absolute right-4 top-4 w-10 h-10 rounded-xl grid place-items-center ${tone}">${KS.icon(icon, 'w-5 h-5')}</span>
    <p class="text-xs font-bold text-ink-soft">${label}</p><p class="font-display font-bold text-3xl mt-2 tabular">${value}</p><p class="text-xs text-ink-soft mt-1">${sub}</p></div>`;
  $('#kpis').innerHTML = [
    kpi('ยอดขายรวม (Total Revenue)', fmt.money(m.revenue), 'trending-up', 'bg-cobalt-soft text-cobalt', 'ไม่รวมออเดอร์ที่ยกเลิก'),
    kpi('คำสั่งซื้อทั้งหมด', m.orders.toLocaleString(), 'receipt', 'bg-tangerine-soft text-tangerine', `รอตรวจสอบ ${m.pending_orders} รายการ`),
    kpi('สินค้าทั้งหมด', m.products, 'tag', 'bg-sage-soft text-sage', `เปิดขาย ${m.active_products} รายการ`),
    kpi(`สต็อกต่ำ (≤ ${m.low_stock_threshold} ใบ)`, m.low_stock_count, 'triangle-alert', 'bg-mustard-soft text-[#8A5300]', 'ตัวเลือกสี/ไซซ์ที่ต้องเติม'),
  ].join('');

  // กราฟแท่ง 14 วัน (วาดด้วย HTML ล้วน)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 7 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
    const row = m.daily.find(r => r.day === d);
    days.push({ d, revenue: row?.revenue || 0, orders: row?.orders || 0 });
  }
  const max = Math.max(...days.map(d => d.revenue), 1);
  $('#chart').innerHTML = `<div class="h-full flex items-end gap-1.5" role="img" aria-label="กราฟยอดขาย 14 วันล่าสุด">${days.map(d => `
    <div class="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
      <span class="absolute -top-1 opacity-0 group-hover:opacity-100 bg-ink text-white text-[10px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap transition">${fmt.money(d.revenue)} · ${d.orders} ออเดอร์</span>
      <span class="w-full rounded-t-md ${d.revenue ? 'bg-cobalt group-hover:bg-tangerine' : 'bg-mist'} transition" style="height:${Math.max(2, (d.revenue / max) * 85)}%"></span>
      <span class="text-[10px] text-ink-soft">${Number(d.d.slice(8))}</span></div>`).join('')}</div>`;

  const total = Object.values(m.by_status).reduce((a, b) => a + b, 0) || 1;
  $('#by-status').innerHTML = Object.keys(KS.STATUS).map(s => {
    const n = m.by_status[s] || 0;
    return `<a href="/admin/orders?status=${s}" class="block hover:opacity-80"><div class="flex justify-between text-sm"><span class="font-semibold">${s} · ${KS.STATUS[s].th}</span><span class="font-bold tabular">${n}</span></div>
      <div class="stock-bar mt-1.5"><span style="width:${(n / total) * 100}%;background:${KS.STATUS[s].dot}"></span></div></a>`;
  }).join('');

  $('#recent').innerHTML = m.recent_orders.map(o => `<tr><td class="py-2.5 pr-3"><a class="font-bold hover:text-cobalt tabular" href="/admin/orders?open=${o.id}">${esc(o.order_number)}</a></td>
    <td class="py-2.5 pr-3">${esc(o.customer_name)}</td><td class="py-2.5 pr-3 text-ink-soft text-xs">${fmt.datetime(o.created_at)}</td>
    <td class="py-2.5 pr-3">${KS.badge(o.status)}</td><td class="py-2.5 text-right font-bold tabular">${fmt.money(o.total_amount)}</td></tr>`).join('')
    || '<tr><td class="py-6 text-center text-ink-soft">ยังไม่มีคำสั่งซื้อ</td></tr>';

  $('#low').innerHTML = m.low_stock.map(v => `<li class="py-2 flex items-center gap-3"><span class="w-3 h-3 rounded-full border border-line shrink-0" style="background:${esc(v.color_hex)}"></span>
    <span class="flex-1 min-w-0"><span class="block font-semibold truncate">${esc(v.name)}</span><span class="text-xs text-ink-soft">${esc(v.color_name)} / ${esc(v.size)} · ${esc(v.sku)}</span></span>
    ${KS.admin.stockPill(v.stock_quantity)}<span class="font-bold tabular w-6 text-right">${v.stock_quantity}</span></li>`).join('')
    || '<li class="py-6 text-center text-ink-soft">สต็อกเพียงพอทุกรายการ</li>';

  $('#top').innerHTML = m.top_products.map((t, i) => `<li class="flex items-center gap-3"><span class="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold text-white" style="background:${['#1D4ED8', '#F97316', '#10B981', '#F59E0B', '#111318'][i]}">${i + 1}</span>
    <span class="flex-1 font-semibold">${esc(t.product_name)}</span><span class="text-ink-soft">${t.units} ชิ้น</span><span class="font-bold tabular w-24 text-right">${fmt.money(t.revenue)}</span></li>`).join('')
    || '<li class="text-ink-soft">ยังไม่มีข้อมูล</li>';

  $('#traffic').innerHTML = [['การเข้าชม', m.analytics_7d.views], ['ผู้เข้าชม', m.analytics_7d.visitors], ['บันทึกความยินยอม', m.consent_records]]
    .map(([l, v]) => `<div class="rounded-xl bg-mist p-3"><p class="font-display font-bold text-2xl tabular">${v}</p><p class="text-[11px] text-ink-soft">${l}</p></div>`).join('');
})();
