#!/bin/bash
# Setup Database di VPS IDCloudHost
# Jalankan: bash scripts/setup-vps-db.sh
set -e

echo "🚀 Setup Database VPS — IDCloudHost"
echo "===================================="

# 1. Install pgvector extension
echo "📦 Install pgvector..."
apt install -y postgresql-16-pgvector || apt install -y postgresql-14-pgvector || apt install -y postgresql-15-pgvector || {
  echo "❌ pgvector tidak ditemukan di repo, install manual..."
  cd /tmp
  git clone --depth 1 https://github.com/pgvector/pgvector.git
  cd pgvector
  make
  make install
}

# 2. Setup user & database
echo "👤 Setup user & database..."
sudo -u postgres psql -c "CREATE USER botuser WITH PASSWORD 'fatquladhim123!';" 2>/dev/null || echo "   User already exists"
sudo -u postgres psql -c "CREATE DATABASE botdb OWNER botuser;" 2>/dev/null || echo "   Database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;" 2>/dev/null

# 3. Enable pgvector on the database
echo "🔧 Enable pgvector extension..."
sudo -u postgres psql -d botdb -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Test connection
echo "🔍 Test connection..."
cd /root/bot-trade
npx prisma db push --accept-data-loss 2>&1 || {
  echo "⚠️ Prisma push gagal, coba generate dulu..."
  npx prisma generate
  npx prisma db push --accept-data-loss
}

# 5. Verify
echo ""
echo "✅ Selesei! Cek hasilnya:"
echo "   sudo -u postgres psql -d botdb -c '\dt'"
echo "   sudo -u postgres psql -d botdb -c 'SELECT * FROM public.analysis LIMIT 5;'"
