import axios from 'axios';
import { sendWAMessage, initWA } from './WANotifier';

export class Notifier {
  private static botToken = process.env.TELEGRAM_BOT_TOKEN;
  private static chatId = process.env.TELEGRAM_CHAT_ID;
  private static waInitialized = false;

  /**
   * Kirim notifikasi ke semua channel (Telegram + WhatsApp)
   */
  public static async sendTelegram(message: string) {
    console.log(`\n🔔 [ALERT]: ${message}\n`);

    // --- TELEGRAM ---
    if (this.botToken && this.botToken !== 'token_bot_dari_botfather' && this.chatId) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await axios.post(url, {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown'
        });
      } catch (e: any) {
        console.error(`⚠️ Gagal kirim Telegram: ${e.message}`);
      }
    }

    // --- WHATSAPP ---
    const waTarget = process.env.WA_TARGET_NUMBER;
    if (waTarget) {
      if (!this.waInitialized) {
        this.waInitialized = true;
        initWA().catch(() => {});
      }
      sendWAMessage(message);
    }
  }
}
