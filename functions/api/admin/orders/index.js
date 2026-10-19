// GET /api/admin/orders : รายการออเดอร์ทั้งหมด ?status=Pending&q=คำค้น&page=1
import { json } from '../../../_lib/http.js';
import { STATUSES } from '../../../_lib/orders.js';

const PAGE_SIZE = 20;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const where = ['1 = 1'];
  const binds = [];
  const status = url.searchParams.get('status');
  if (STATUSES.includes(status)) { where.push('o.status = ?'); binds.push(status); }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.phone LIKE ? OR o.tracking_number LIKE ?)');
    binds.push(...Array(5).fill(`%${q}%`));
  }
  const page = Math.max(parseInt(url.searchParams.get('page'), 10) || 1, 1);
  const w = where.join(' AND ');
  const [list, count, counts] = await env.DB.batch([
    env.DB.prepare(`SELECT o.*, (SELECT SUM(quantity) FROM order_items i WHERE i.order_id = o.id) AS item_count
                      FROM orders o WHERE ${w} ORDER BY o.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`).bind(...binds),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE ${w}`).bind(...binds),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
  ]);
  return json({
    ok: true,
    orders: list.results.map(o => ({ ...o, shipping_address: JSON.parse(o.shipping_address || '{}') })),
    total: count.results[0].n,
    page,
    pages: Math.max(Math.ceil(count.results[0].n / PAGE_SIZE), 1),
    status_counts: Object.fromEntries(counts.results.map(r => [r.status, r.n])),
  });
}
