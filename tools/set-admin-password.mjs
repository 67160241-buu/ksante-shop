// ============================================================================
// เปลี่ยนรหัสผ่านแอดมิน (หรือบัญชีใดก็ได้) โดยสร้างไฟล์ SQL สำหรับรันบน D1
// ใช้ฟังก์ชัน hashPassword ตัวเดียวกับระบบจริง (PBKDF2-SHA256 100,000 รอบ)
//
// วิธีใช้:
//   node tools/set-admin-password.mjs admin@ksante.com "รหัสผ่านใหม่"
//   npx wrangler d1 execute ksante-db --remote --file=./admin-password.sql
//   (แล้วลบไฟล์ admin-password.sql ทิ้ง)
// ============================================================================
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../functions/_lib/crypto.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('วิธีใช้: node tools/set-admin-password.mjs <email> <รหัสผ่านใหม่>');
  process.exit(1);
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข');
  process.exit(1);
}
const { hash, salt } = await hashPassword(password);
const safeEmail = email.replace(/'/g, "''");
writeFileSync('admin-password.sql',
  `UPDATE users SET password_hash = '${hash}', salt = '${salt}' WHERE email = '${safeEmail}';\n`);
console.log('สร้างไฟล์ admin-password.sql แล้ว รันต่อด้วย:');
console.log('  npx wrangler d1 execute ksante-db --remote --file=./admin-password.sql');
