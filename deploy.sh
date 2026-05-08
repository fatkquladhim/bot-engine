#!/bin/bash
# deploy.sh — Setup Alpha Omega Bot di IDCloudHost Ubuntu 24.04
# Jalankan: bash deploy.sh

set -e
echo "🚀 Alpha Omega Bot — Auto Deploy Script"
echo "========================================"

# 1. Update system
echo "📦 Update system..."
apt update && apt upgrade -y

# 2. Install Node.js 20
echo "📦 Install Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install PM2
echo "📦 Install PM2..."
npm install -g pm2

# 4. Install git
apt install -y git

# 5. Clone repo
echo "📥 Clone repository..."
cd /root
git clone https://github.com/ullahasep19-sys/my-bot.git bot-trade
cd bot-trade

# 6. Install dependencies
echo "📦 Install dependencies..."
npm ci

# 7. Setup .env
echo ""
echo "⚙️  Setup Environment Variables"
echo "================================"
echo "Masukkan nilai untuk setiap variable:"
echo ""

read -p "INDODAX_API_KEY: " INDODAX_API_KEY
read -p "INDODAX_SECRET_KEY: " INDODAX_SECRET_KEY
read -p "DATABASE_URL: " DATABASE_URL
read -p "DIRECT_URL: " DIRECT_URL
read -p "SUMOPOD_API_KEY: " SUMOPOD_API_KEY
read -p "TELEGRAM_BOT_TOKEN (kosongkan jika tidak ada): " TELEGRAM_BOT_TOKEN
read -p "TELEGRAM_CHAT_ID (kosongkan jika tidak ada): " TELEGRAM_CHAT_ID

cat > .env << EOF
INDODAX_API_KEY=${INDODAX_API_KEY}
INDODAX_SECRET_KEY=${INDODAX_SECRET_KEY}

DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}

TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-token_bot_dari_botfather}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-id_telegram_anda}

SUMOPOD_API_KEY=${SUMOPOD_API_KEY}
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1

# COUNCIL OF THREE
SUMOPOD_FREE_MODELS=qwen/qwen3-30b-a3b-instruct-2507,nvidia/nemotron-3-nano-30b,openai/gpt-oss-20b
SUMOPOD_FALLBACK_MODELS=MiniMax-M2.7-highspeed,gemini/gemini-2.0-flash-lite,deepseek-v4-flash
SUMOPOD_MACRO_MODEL=deepseek-v4-pro
EOF

echo "✅ .env berhasil dibuat"

# 8. Generate Prisma
echo "🔧 Generate Prisma client..."
npx prisma generate

# 9. Build Next.js dashboard
echo "🔨 Build dashboard..."
npm run build

# 10. Start dengan PM2
echo "🚀 Starting services dengan PM2..."

# Bot trading (utama)
pm2 start "npm run bot -- autopilot" --name "alpha-omega-bot" --restart-delay=5000

# Dashboard Next.js
pm2 start "npm start" --name "alpha-omega-dashboard" -- -p 3000

# Save PM2 config
pm2 save

# Auto-start saat server reboot
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

echo ""
echo "✅ Deploy selesai!"
echo ""
echo "📊 Status services:"
pm2 list
echo ""
echo "🌐 Dashboard: http://$(curl -s ifconfig.me):3000"
echo ""
echo "📋 Perintah berguna:"
echo "  pm2 logs alpha-omega-bot      — lihat log bot"
echo "  pm2 restart alpha-omega-bot   — restart bot"
echo "  pm2 stop alpha-omega-bot      — stop bot"
echo "  pm2 monit                     — monitor realtime"
