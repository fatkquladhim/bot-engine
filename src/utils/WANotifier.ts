import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

let client: Client | null = null;
let isReady = false;
let pendingMessages: string[] = [];
let initPromise: Promise<void> | null = null;

export async function initWA(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    client.on('qr', (qr) => {
      console.log('\n========================================');
      console.log('  SCAN QR CODE INI DENGAN WHATSAPP ANDA');
      console.log('  Buka WA > Setelan > Perangkat Tertaut');
      console.log('========================================\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      isReady = true;
      console.log('✅ [WA] WhatsApp terhubung!');
      // Kirim pesan yang tertunda
      for (const msg of pendingMessages) {
        sendWAMessage(msg);
      }
      pendingMessages = [];
      resolve();
    });

    client.on('disconnected', (reason) => {
      isReady = false;
      console.log(`⚠️ [WA] WhatsApp terputus: ${reason}. Reconnect dalam 30 detik...`);
      setTimeout(() => initWA(), 30000);
    });

    client.on('auth_failure', (msg) => {
      console.error(`❌ [WA] Auth failure: ${msg}. Hapus folder .wwebjs_auth lalu scan ulang.`);
      isReady = false;
    });

    client.initialize().catch((err) => {
      console.error(`❌ [WA] Gagal initialize: ${err.message}`);
      initPromise = null;
      resolve();
    });
  });

  return initPromise;
}

export async function sendWAMessage(message: string): Promise<void> {
  const target = process.env.WA_TARGET_NUMBER;

  if (!target) {
    console.log('⚠️ [WA] WA_TARGET_NUMBER tidak diatur di .env');
    return;
  }

  if (!isReady || !client) {
    pendingMessages.push(message);
    return;
  }

  try {
    const formatted = `${process.env.WA_TARGET_NAME || 'Bot'}\n\n${message}`;
    const chatId = target.includes('@c.us') ? target : `${target}@c.us`;
    await client.sendMessage(chatId, formatted);
  } catch (e: any) {
    console.error(`⚠️ [WA] Gagal kirim pesan: ${e.message}`);
  }
}
