-- ============================================================================
-- อัปเดตฐานข้อมูลที่ใช้งานอยู่แล้ว ให้รองรับการอัปโหลดรูปจากหน้าแอดมิน
-- (ไม่ลบข้อมูลเดิม รันซ้ำได้)
--   npx wrangler d1 execute ksante-db --remote --file=./migrations/0002_images.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS images (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mime         TEXT    NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
  data         BLOB    NOT NULL,
  size_bytes   INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
