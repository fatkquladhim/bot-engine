#!/bin/bash
# ⚠️  HAPUS SEMUA DATA LAMA + SETUP DATABASE BARU
# Jalankan di VPS: bash scripts/reset-db-full.sh
set -e

echo "🚨 RESET DATABASE TOTAL"
echo "========================"
echo ""
echo "⚠️  PERINGATAN: Semua data trade, analysis, chat history akan HILANG!"
read -p "Ketik 'RESET' untuk lanjut: " confirm
if [ "$confirm" != "RESET" ]; then
  echo "❌ Dibatalkan."
  exit 1
fi

echo ""
echo "📦 Step 1: Install pgvector (kalau belum ada)..."
apt install -y postgresql-16-pgvector 2>/dev/null || apt install -y postgresql-15-pgvector 2>/dev/null || {
  echo "⚠️ pgvector not in apt, building from source..."
  cd /tmp
  git clone --depth 1 https://github.com/pgvector/pgvector.git 2>/dev/null || true
  cd pgvector
  make && make install 2>/dev/null || echo "   (maybe already installed)"
}

echo ""
echo "🗑️  Step 2: Drop & recreate database..."
sudo -u postgres psql <<'SQL'
DROP DATABASE IF EXISTS botdb;
DROP USER IF EXISTS botuser;
CREATE USER botuser WITH PASSWORD 'fatquladhim123!';
CREATE DATABASE botdb OWNER botuser;
GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;
\c botdb
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO botuser;
SQL

echo ""
echo "🔧 Step 3: Push Prisma schema..."
cd /root/bot-trade
npx prisma generate
npx prisma db push

echo ""
echo "👤 Step 4: Buat default user..."
cat <<'SEED' > /tmp/seed.sql
INSERT INTO public.users (id, email, "displayName", "createdAt", "updatedAt")
VALUES ('default_system_user', 'bot@system.local', 'System Bot', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SEED
sudo -u postgres psql -d botdb -f /tmp/seed.sql

echo ""
echo "✅ RESET SELESAI!"
echo ""
echo "Cek database:"
echo "  sudo -u postgres psql -d botdb -c '\dt'"
echo "  sudo -u postgres psql -d botdb -c 'SELECT * FROM users;'"
