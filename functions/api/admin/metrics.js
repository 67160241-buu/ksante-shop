// GET /api/admin/metrics : ตัวเลขสรุปสำหรับ Dashboard
import { json } from '../../_lib/http.js';
import { LOW_STOCK } from '../../_lib/catalog.js';

export async function onRequestGet({ env }) {
  const db = env.DB;
  const [totals, products, low, byStatus, daily, recent, top, views, consents] = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total_amount END), 0) AS revenue,
                       COUNT(*) AS orders,
                       SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending
                  FROM orders`),
    db.prepare('SELECT COUNT(*) AS total, SUM(is_active) AS active FROM products'),
    db.prepare(`SELECT v.id, v.sku, v.color_name, v.color_hex, v.size, v.stock_quantity, p.id AS product_id, p.name
                  FROM product_variants v JOIN products p ON p.id = v.product_id
                 WHERE v.stock_quantity <= ? ORDER BY v.stock_quantity, p.name`).bind(LOW_STOCK),
    db.prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status'),
    // ยอดขาย 14 วันล่าสุด (นับตามวันที่เวลาไทย)
    db.prepare(`SELECT date(created_at, '+7 hours') AS day, SUM(total_amount) AS revenue, COUNT(*) AS orders
                  FROM orders WHERE status <> 'Cancelled' AND created_at >= datetime('now', '-14 days')
                 GROUP BY day ORDER BY day`),
    db.prepare('SELECT id, order_number, customer_name, total_amount, status, created_at FROM orders ORDER BY id DESC LIMIT 6'),
    db.prepare(`SELECT i.product_name, SUM(i.quantity) AS units, SUM(i.quantity * i.price) AS revenue
                  FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled'
                 GROUP BY i.product_name ORDER BY units DESC LIMIT 5`),
    db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM analytics_events WHERE created_at >= datetime('now', '-7 days')`),
    db.prepare('SELECT COUNT(*) AS total FROM cookie_consents'),
  ]);
  return json({
    ok: true,
    revenue: totals.results[0].revenue,
    orders: totals.results[0].orders,
    pending_orders: totals.results[0].pending || 0,
    products: products.results[0].total,
    active_products: products.results[0].active || 0,
    low_stock_threshold: LOW_STOCK,
    low_stock_count: low.results.length,
    low_stock: low.results.slice(0, 12),
    by_status: Object.fromEntries(byStatus.results.map(r => [r.status, r.count])),
    daily: daily.results,
    recent_orders: recent.results,
    top_products: top.results,
    analytics_7d: views.results[0],
    consent_records: consents.results[0].total,
  });
}
