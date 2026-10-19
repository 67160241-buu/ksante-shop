// ทุก API ใต้ /api/admin/* ต้องเป็นแอดมินเท่านั้น (ลูกค้าจะได้ 401/403)
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequest(context) {
  context.data.admin = await requireAdmin(context.request, context.env);
  return context.next();
}
